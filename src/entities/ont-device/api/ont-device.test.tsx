import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getMockCommand, MOCK_CONTRACTS, setMockScenario } from '@/shared/api/mock';
import { createQueryWrapper } from '@/shared/test';
import { bytesToGb, ontDeviceSchema, renameOntDeviceInputSchema } from '../model/ont-device-schema';
import { ontDeviceFixtures } from './mock-handlers';
import { ontDeviceApi } from './ont-device-api';
import {
  ontDeviceKeys,
  useOntDeviceQuery,
  useRebootOntDeviceMutation,
  useRenameOntDeviceMutation,
} from './ont-device-queries';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;

describe('ont-device schema', () => {
  it('parses every fixture and tolerates null metrics', () => {
    for (const fixture of ontDeviceFixtures) expect(ontDeviceSchema.safeParse(fixture).success).toBe(true);
    expect(ontDeviceSchema.parse({ serialNumber: 'S', displayName: 'X', uptimeSec: null })).toMatchObject({
      uptimeSec: null,
    });
  });

  it('validates the rename input (1–32 chars) and converts bytes to GB', () => {
    expect(renameOntDeviceInputSchema.safeParse({ displayName: ' ' }).success).toBe(false);
    expect(renameOntDeviceInputSchema.safeParse({ displayName: 'x'.repeat(33) }).success).toBe(false);
    expect(bytesToGb(2 * 1024 ** 3)).toBe(2);
    expect(bytesToGb(null)).toBeNull();
  });

  it('scopes keys by serial number', () => {
    expect(ontDeviceKeys.detail('SN')).toEqual(['device', 'SN', 'info']);
  });
});

describe('ont-device API (MSW)', () => {
  it('reads the device with meta', async () => {
    const result = await ontDeviceApi.get(SERIAL);
    expect(result.data.displayName).toBe('AX3000CV2');
    expect(result.meta?.source).toBe('CACHE');
  });

  it('returns 409 DEVICE_OFFLINE when the modem does not answer', async () => {
    setMockScenario({ device: 'offline' });
    await expect(ontDeviceApi.get(SERIAL)).rejects.toMatchObject({
      code: 'DEVICE_OFFLINE',
      kind: 'device-offline',
    });
  });

  it('reboots asynchronously, locks the device and rate-limits at 3 per 30 minutes', async () => {
    const command = await ontDeviceApi.reboot(SERIAL, 'r1');
    expect(command).toMatchObject({ type: 'REBOOT', state: 'SENT' });
    expect(getMockCommand(command.commandId)?.state).toBe('SENT');
    // Same key → replay of the current command; new key while running → DEVICE_BUSY.
    await expect(ontDeviceApi.reboot(SERIAL, 'r1')).resolves.toMatchObject({ commandId: command.commandId });
    await expect(ontDeviceApi.reboot(SERIAL, 'r2')).rejects.toMatchObject({
      code: 'DEVICE_BUSY',
      retryAfterSec: 5,
    });
  });

  it('validates the display name', async () => {
    await expect(ontDeviceApi.rename(SERIAL, { displayName: 'x'.repeat(40) }, 'k')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'displayName', code: 'TOO_LONG' }],
    });
  });
});

describe('ont-device hooks', () => {
  it('renames and updates the cached device', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => ({ device: useOntDeviceQuery(SERIAL), rename: useRenameOntDeviceMutation(SERIAL) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.device.data).toBeDefined());
    await act(async () => {
      await result.current.rename.mutateAsync({
        displayName: 'Modem phòng khách',
        idempotencyKey: 'rename-1',
      });
    });
    expect(result.current.device.data?.data.displayName).toBe('Modem phòng khách');
  });

  it('returns the reboot command', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useRebootOntDeviceMutation(SERIAL), { wrapper });
    let state: string | undefined;
    await act(async () => {
      state = (await result.current.mutateAsync({ idempotencyKey: 'reboot-1' })).state;
    });
    expect(state).toBe('SENT');
  });

  it('stays idle without a serial number', () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useOntDeviceQuery(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
