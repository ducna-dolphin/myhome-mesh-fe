import { afterEach, describe, expect, it, vi } from 'vitest';
import { BridgeError } from './bridge-error';
import { guardBridge, type RawBridge } from './guard-bridge';
import { bridgeMethods } from './my-home-bridge';

const never = <T>() => new Promise<T>(() => {});

function rawBridge(overrides: Partial<RawBridge> = {}): RawBridge {
  return {
    getMiniAppToken: async () => ({ accessToken: 't', expiresIn: 900 }),
    closeMiniApp: async () => undefined,
    getAppInfo: async () => ({ platform: 'ANDROID', appVersion: '1', osVersion: '15' }),
    getNetworkInfo: async () => ({ type: 'WIFI', vpnActive: false }),
    getWifiInfo: async () => ({ bssid: null, ipAddress: null, macAddress: null }),
    measureWifiSpeed: async () => ({ downloadMbps: 100, latencyMs: 10 }),
    readWifiRssi: async () => ({ rssiDbm: -55, sampleCount: 8 }),
    onNetworkChange: () => () => undefined,
    openDeeplink: async () => undefined,
    openPayment: async () => undefined,
    saveImage: async () => undefined,
    shareImage: async () => undefined,
    copyText: async () => undefined,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('guardBridge', () => {
  it('rejects unsupported methods with BRIDGE_UNSUPPORTED without calling the host', async () => {
    const copyText = vi.fn(async () => undefined);
    const bridge = guardBridge(rawBridge({ copyText }), (method) => method !== 'copyText');
    await expect(bridge.copyText('x')).rejects.toMatchObject({
      code: 'BRIDGE_UNSUPPORTED',
      method: 'copyText',
    });
    expect(copyText).not.toHaveBeenCalled();
    expect(() => guardBridge(rawBridge(), () => false).onNetworkChange(() => undefined)).toThrow(BridgeError);
  });

  it('exposes supports() for every bridge method', () => {
    const bridge = guardBridge(rawBridge(), (method) => method === 'getMiniAppToken');
    expect(bridgeMethods.filter((method) => bridge.supports(method))).toEqual(['getMiniAppToken']);
  });

  it('times out after 10s', async () => {
    vi.useFakeTimers();
    const bridge = guardBridge(rawBridge({ getWifiInfo: never }), () => true);
    const pending = bridge.getWifiInfo();
    const outcome = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT', method: 'getWifiInfo' });
    await vi.advanceTimersByTimeAsync(9_999);
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
  });

  it('gives measurements durationSec + 5s', async () => {
    vi.useFakeTimers();
    const bridge = guardBridge(rawBridge({ measureWifiSpeed: never, readWifiRssi: never }), () => true);
    let settled = false;
    const pending = bridge.readWifiRssi({ durationSec: 8 }).catch((error: unknown) => {
      settled = true;
      throw error;
    });
    const outcome = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(12_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
  });

  it('normalizes host errors', async () => {
    const bridge = guardBridge(
      rawBridge({
        getWifiInfo: () => Promise.reject({ code: 'PERMISSION_DENIED' }),
        getNetworkInfo: () => Promise.reject(new Error('boom')),
        getAppInfo: () => {
          throw new Error('sync');
        },
      }),
      () => true,
    );
    await expect(bridge.getWifiInfo()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(bridge.getNetworkInfo()).rejects.toMatchObject({ code: 'FAILED' });
    await expect(bridge.getAppInfo()).rejects.toMatchObject({ code: 'FAILED' });
  });

  it('passes results through', async () => {
    const bridge = guardBridge(rawBridge(), () => true);
    await expect(bridge.measureWifiSpeed({ durationSec: 1 })).resolves.toEqual({
      downloadMbps: 100,
      latencyMs: 10,
    });
    await expect(bridge.getMiniAppToken()).resolves.toEqual({ accessToken: 't', expiresIn: 900 });
  });
});
