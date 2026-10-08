import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserMockAdapter, mockSupportedMethods } from './browser-mock-adapter';

afterEach(() => {
  vi.useRealTimers();
});

describe('browser mock adapter', () => {
  it('supports measureWifiSpeed only for Android + SPEED', () => {
    const speed = createBrowserMockAdapter({ platform: 'android', androidMethod: 'SPEED' });
    expect(speed.supports('measureWifiSpeed')).toBe(true);
    expect(speed.supports('readWifiRssi')).toBe(false);

    const rssi = createBrowserMockAdapter({ platform: 'android', androidMethod: 'RSSI' });
    expect(rssi.supports('measureWifiSpeed')).toBe(false);
    expect(rssi.supports('readWifiRssi')).toBe(true);

    const none = mockSupportedMethods('android', 'NONE');
    expect(none.has('measureWifiSpeed') || none.has('readWifiRssi')).toBe(false);
    expect(none.has('getWifiInfo')).toBe(true);
  });

  it('never measures on iOS and has a minimal surface on web', () => {
    const ios = mockSupportedMethods('ios', 'SPEED');
    expect(ios.has('measureWifiSpeed') || ios.has('readWifiRssi')).toBe(false);
    expect(ios.has('openDeeplink')).toBe(true);
    expect([...mockSupportedMethods('web', 'SPEED')].sort()).toEqual([
      'closeMiniApp',
      'copyText',
      'getMiniAppToken',
    ]);
  });

  it('rejects unsupported calls with BRIDGE_UNSUPPORTED', async () => {
    const web = createBrowserMockAdapter({ platform: 'web' });
    await expect(web.getAppInfo()).rejects.toMatchObject({ code: 'BRIDGE_UNSUPPORTED' });
  });

  it('issues a fresh mock token on every call', async () => {
    const adapter = createBrowserMockAdapter({ platform: 'android' });
    const first = await adapter.getMiniAppToken();
    const second = await adapter.getMiniAppToken();
    expect(first.expiresIn).toBe(900);
    expect(second.accessToken).not.toBe(first.accessToken);
  });

  it('reports iPhone-like Wi-Fi info without BSSID', async () => {
    const ios = createBrowserMockAdapter({ platform: 'ios' });
    await expect(ios.getWifiInfo()).resolves.toMatchObject({ bssid: null, ipAddress: '192.168.1.23' });
    await expect(ios.getAppInfo()).resolves.toMatchObject({ platform: 'IOS' });
  });

  it('simulates measurements over durationSec', async () => {
    vi.useFakeTimers();
    const adapter = createBrowserMockAdapter({ platform: 'android', androidMethod: 'RSSI' });
    const pending = adapter.readWifiRssi({ durationSec: 8 });
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;
    expect(result.rssiDbm).toBeGreaterThanOrEqual(-80);
    expect(result.rssiDbm).toBeLessThanOrEqual(-50);
    expect(result.sampleCount).toBe(8);
  });

  it('serves the host locale', async () => {
    const adapter = createBrowserMockAdapter();
    await expect(adapter.getSession()).resolves.toEqual({ locale: 'vi-VN' });
  });

  it('notifies network changes from online/offline events', () => {
    const adapter = createBrowserMockAdapter({ platform: 'android' });
    const listener = vi.fn();
    const unsubscribe = adapter.onNetworkChange(listener);
    window.dispatchEvent(new Event('offline'));
    expect(listener).toHaveBeenCalledWith({ type: 'NONE', bssid: null });
    unsubscribe();
    window.dispatchEvent(new Event('online'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
