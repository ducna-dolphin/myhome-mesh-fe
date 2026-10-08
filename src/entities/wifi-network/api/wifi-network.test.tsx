import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOCK_CONTRACTS } from '@/shared/api/mock';
import { createQueryWrapper } from '@/shared/test';
import {
  buildWifiQrPayload,
  wifiNetworkPatchSchema,
  wifiNetworkSchema,
  wifiPasswordSchema,
} from '../model/wifi-network-schema';
import { wifiNetworkFixtures } from './mock-handlers';
import { wifiNetworkApi } from './wifi-network-api';
import {
  useRevealWifiPasswordMutation,
  useUpdateWifiNetworkMutation,
  useWifiNetworksQuery,
  wifiNetworkKeys,
} from './wifi-network-queries';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;

afterEach(() => {
  vi.useRealTimers();
});

describe('wifi-network model', () => {
  it('parses fixtures (2 SSIDs from XD + 1 disabled)', () => {
    expect(wifiNetworkFixtures.map((network) => wifiNetworkSchema.parse(network).ssid)).toEqual([
      'MyHome_WF6',
      'MyHome_5G',
      'MyHome_IoT',
    ]);
    expect(wifiNetworkFixtures.map((network) => network.enabled)).toEqual([true, true, false]);
    expect(wifiPasswordSchema.safeParse({ wifiIndex: 0, ssid: 'a', password: 'b' }).success).toBe(true);
  });

  it('validates merge patches (WF-05)', () => {
    expect(wifiNetworkPatchSchema.safeParse({}).success).toBe(false);
    expect(wifiNetworkPatchSchema.safeParse({ password: 'short' }).success).toBe(false);
    expect(wifiNetworkPatchSchema.safeParse({ ssid: 'x'.repeat(33) }).success).toBe(false);
    expect(wifiNetworkPatchSchema.safeParse({ enabled: false }).success).toBe(true);
  });

  it('builds an escaped Wi-Fi QR payload', () => {
    expect(buildWifiQrPayload({ ssid: 'My;Home', password: 'a:b\\c', securityMode: 'WPA2-PSK' })).toBe(
      'WIFI:T:WPA;S:My\\;Home;P:a\\:b\\\\c;;',
    );
    expect(buildWifiQrPayload({ ssid: 'Open', password: '', securityMode: 'NONE' })).toBe(
      'WIFI:T:nopass;S:Open;;',
    );
  });

  it('scopes keys by device', () => {
    expect(wifiNetworkKeys.list('SN')).toEqual(['device', 'SN', 'wifi-networks']);
  });
});

describe('wifi-network API (MSW)', () => {
  it('sends a merge patch and confirms the command after ~2s', async () => {
    const command = await wifiNetworkApi.update(SERIAL, 0, { ssid: 'MyHome_New' }, 'w1');
    expect(command).toMatchObject({ type: 'WIFI_UPDATE', state: 'SENT', retryAfterSec: 2 });
    expect((await wifiNetworkApi.list(SERIAL)).data[0]?.ssid).toBe('MyHome_WF6');

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 2_100 });
    expect((await wifiNetworkApi.list(SERIAL)).data[0]?.ssid).toBe('MyHome_New');
  });

  it('reveals the password with Cache-Control: no-store semantics', async () => {
    await expect(wifiNetworkApi.revealPassword(SERIAL, 1, 'QR')).resolves.toMatchObject({
      ssid: 'MyHome_5G',
      password: 'MyHome5G@2024',
    });
    await expect(wifiNetworkApi.revealPassword(SERIAL, 9, 'VIEW')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rate-limits reveal-password at 30 per hour', async () => {
    for (let index = 0; index < 30; index += 1) await wifiNetworkApi.revealPassword(SERIAL, 0, 'VIEW');
    await expect(wifiNetworkApi.revealPassword(SERIAL, 0, 'COPY')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryAfterSec: 600,
    });
  });

  it('rejects invalid patches', async () => {
    await expect(wifiNetworkApi.update(SERIAL, 0, { password: '123' }, 'w2')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
});

describe('wifi-network hooks', () => {
  it('lists networks and updates through a command', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => ({ list: useWifiNetworksQuery(SERIAL), update: useUpdateWifiNetworkMutation(SERIAL) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.data?.data).toHaveLength(3));
    let state: string | undefined;
    await act(async () => {
      state = (
        await result.current.update.mutateAsync({
          wifiIndex: 1,
          patch: { enabled: false },
          idempotencyKey: 'u1',
        })
      ).state;
    });
    expect(state).toBe('SENT');
  });

  it('does not keep revealed passwords in the cache', async () => {
    const { wrapper, queryClient } = createQueryWrapper();
    const { result, unmount } = renderHook(() => useRevealWifiPasswordMutation(SERIAL), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ wifiIndex: 0, purpose: 'VIEW' });
    });
    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });
});
