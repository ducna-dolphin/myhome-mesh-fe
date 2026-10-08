import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOCK_CONTRACTS } from '@/shared/api/mock';
import { createQueryWrapper } from '@/shared/test';
import {
  connectedDeviceSchema,
  countConnectedDevices,
  filterConnectedDevices,
  normalizeMac,
  updateConnectedDeviceInputSchema,
} from '../model/connected-device-schema';
import { connectedDeviceApi } from './connected-device-api';
import {
  connectedDeviceKeys,
  useBlockConnectedDeviceMutation,
  useConnectedDevicesQuery,
  useUpdateConnectedDeviceMutation,
} from './connected-device-queries';
import { connectedDeviceFixtures } from './mock-handlers';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;
const TV = '58:2F:40:11:22:33';
const PHONE = '3A:1F:00:AB:CD:EF';
const MESH = 'A4:F4:C2:00:00:03';
const CAMERA = '7C:49:EB:12:34:56';
const noSelf = { selfMacAddress: null, selfIpAddress: null };

/** Moves the mock clock forward (commands settle by elapsed time). */
function later(ms: number) {
  const target = Date.now() + ms;
  if (vi.isFakeTimers()) vi.setSystemTime(target);
  else vi.useFakeTimers({ toFake: ['Date'], now: target });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('connected-device model', () => {
  it('parses fixtures: 10 devices, 5 connected, 1 blocked, 4 disconnected', () => {
    const devices = connectedDeviceFixtures.map((device) => connectedDeviceSchema.parse(device));
    expect(countConnectedDevices(devices)).toEqual({ ALL: 10, CONNECTED: 5, BLOCKED: 1 });
    expect(devices.filter((device) => device.status === 'DISCONNECTED')).toHaveLength(4);
    expect(filterConnectedDevices(devices, 'BLOCKED').map((device) => device.macAddress)).toEqual([CAMERA]);
  });

  it('tolerates name: null (review R-02)', () => {
    const parsed = connectedDeviceSchema.parse({ ...connectedDeviceFixtures[1], name: null });
    expect(parsed.name).toBeNull();
  });

  it('validates name/icon updates', () => {
    expect(updateConnectedDeviceInputSchema.safeParse({}).success).toBe(false);
    expect(updateConnectedDeviceInputSchema.safeParse({ name: 'x'.repeat(33) }).success).toBe(false);
    expect(updateConnectedDeviceInputSchema.safeParse({ name: null }).success).toBe(true);
    expect(updateConnectedDeviceInputSchema.safeParse({ icon: 'FRIDGE' }).success).toBe(false);
  });

  it('normalizes MACs and scopes keys', () => {
    expect(normalizeMac('aa-bb-cc-dd-ee-ff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(connectedDeviceKeys.list('SN', 'BLOCKED')).toEqual([
      'device',
      'SN',
      'connected-devices',
      'list',
      'BLOCKED',
    ]);
    expect(connectedDeviceKeys.detail('SN', 'aa:bb:cc:dd:ee:ff')).toEqual([
      'device',
      'SN',
      'connected-devices',
      'detail',
      'AA:BB:CC:DD:EE:FF',
    ]);
  });
});

describe('connected-device API (MSW)', () => {
  it('filters by status on the server', async () => {
    expect((await connectedDeviceApi.list(SERIAL, 'CONNECTED')).data).toHaveLength(5);
    expect((await connectedDeviceApi.detail(SERIAL, TV.toLowerCase())).data.name).toBe('Samsung Smart TV');
  });

  it('blocks asynchronously (202 → CONFIRMED) and answers 200 when already blocked', async () => {
    const command = await connectedDeviceApi.block(SERIAL, TV, noSelf, 'b1');
    expect(command.state).toBe('SENT');
    later(2_100);
    expect((await connectedDeviceApi.detail(SERIAL, TV)).data.status).toBe('BLOCKED');
    await expect(connectedDeviceApi.block(SERIAL, CAMERA, noSelf, 'b2')).resolves.toMatchObject({
      state: 'CONFIRMED',
    });
  });

  it('refuses to block Mesh nodes or the phone itself (DEVICE_NOT_BLOCKABLE)', async () => {
    await expect(connectedDeviceApi.block(SERIAL, MESH, noSelf, 'b3')).rejects.toMatchObject({
      code: 'DEVICE_NOT_BLOCKABLE',
    });
    await expect(
      connectedDeviceApi.block(SERIAL, PHONE, { selfMacAddress: null, selfIpAddress: '192.168.1.23' }, 'b4'),
    ).rejects.toMatchObject({ code: 'DEVICE_NOT_BLOCKABLE' });
  });

  it('unblocks and removes (block + hide)', async () => {
    await expect(connectedDeviceApi.unblock(SERIAL, TV, 'u0')).resolves.toMatchObject({ state: 'CONFIRMED' });
    const unblock = await connectedDeviceApi.unblock(SERIAL, CAMERA, 'u1');
    expect(unblock.state).toBe('SENT');
    later(2_100);
    expect((await connectedDeviceApi.detail(SERIAL, CAMERA)).data.status).toBe('DISCONNECTED');

    const removal = await connectedDeviceApi.remove(SERIAL, TV, noSelf, 'r1');
    expect(removal.type).toBe('CLIENT_BLOCK');
    later(2_100);
    const all = await connectedDeviceApi.list(SERIAL);
    expect(all.data.map((device) => device.macAddress)).not.toContain(TV);
  });

  it('renames and resets the name with an empty value', async () => {
    await expect(
      connectedDeviceApi.update(SERIAL, TV, { name: 'TV phòng khách', icon: 'TV' }, 'n1'),
    ).resolves.toMatchObject({
      name: 'TV phòng khách',
    });
    await expect(connectedDeviceApi.update(SERIAL, TV, { name: '' }, 'n2')).resolves.toMatchObject({
      name: 'Samsung Smart TV',
    });
  });
});

describe('connected-device hooks', () => {
  it('lists devices, renames and blocks with idempotency keys', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => ({
        list: useConnectedDevicesQuery(SERIAL),
        update: useUpdateConnectedDeviceMutation(SERIAL),
        block: useBlockConnectedDeviceMutation(SERIAL),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.data?.data).toHaveLength(10));

    await act(async () => {
      await result.current.update.mutateAsync({ macAddress: TV, name: 'TV mới', idempotencyKey: 'h1' });
    });
    await waitFor(() =>
      expect(result.current.list.data?.data.find((device) => device.macAddress === TV)?.name).toBe('TV mới'),
    );

    let state: string | undefined;
    await act(async () => {
      state = (await result.current.block.mutateAsync({ macAddress: TV, idempotencyKey: 'h2', ...noSelf }))
        .state;
    });
    expect(state).toBe('SENT');
  });
});
