import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLUTTER_HANDLER_NAMES, FLUTTER_NETWORK_CHANGE_EVENT } from './flutter-handler-names';
import { createFlutterInAppWebViewAdapter, SESSION_TIMEOUT_MS } from './flutter-inappwebview-adapter';

function installBridge(impl: (name: string, ...args: unknown[]) => unknown) {
  const callHandler = vi.fn(async (name: string, ...args: unknown[]) => impl(name, ...args));
  window.flutter_inappwebview = { callHandler: callHandler as never };
  return callHandler;
}

afterEach(() => {
  delete window.flutter_inappwebview;
});

describe('Flutter InAppWebView adapter', () => {
  it('maps getMiniAppToken and closeMiniApp to the configured handlers', async () => {
    const callHandler = installBridge((name) =>
      name === FLUTTER_HANDLER_NAMES.getMiniAppToken ? { accessToken: 'abc', expiresIn: 900 } : undefined,
    );
    const adapter = createFlutterInAppWebViewAdapter();
    await expect(adapter.getMiniAppToken()).resolves.toEqual({ accessToken: 'abc', expiresIn: 900 });
    await adapter.closeMiniApp();
    expect(callHandler).toHaveBeenCalledWith(FLUTTER_HANDLER_NAMES.closeMiniApp);
  });

  it('only supports HLD-confirmed methods by default (S-01…S-10 pending)', async () => {
    const callHandler = installBridge(() => undefined);
    const adapter = createFlutterInAppWebViewAdapter();
    expect(adapter.supports('getMiniAppToken')).toBe(true);
    expect(adapter.supports('measureWifiSpeed')).toBe(false);
    await expect(adapter.getWifiInfo()).rejects.toMatchObject({ code: 'BRIDGE_UNSUPPORTED' });
    expect(callHandler).not.toHaveBeenCalled();
  });

  it('calls confirmed optional methods with their arguments', async () => {
    const callHandler = installBridge((name) =>
      name === FLUTTER_HANDLER_NAMES.measureWifiSpeed ? { downloadMbps: 120, latencyMs: 15 } : undefined,
    );
    const adapter = createFlutterInAppWebViewAdapter({
      confirmedMethods: new Set(['measureWifiSpeed', 'openPayment', 'copyText', 'onNetworkChange']),
    });
    await expect(adapter.measureWifiSpeed({ durationSec: 8 })).resolves.toEqual({
      downloadMbps: 120,
      latencyMs: 15,
    });
    expect(callHandler).toHaveBeenCalledWith(FLUTTER_HANDLER_NAMES.measureWifiSpeed, { durationSec: 8 });
    await adapter.openPayment({ contractCode: 'VNPT-HN-0123446' });
    expect(callHandler).toHaveBeenCalledWith(FLUTTER_HANDLER_NAMES.openPayment, {
      contractCode: 'VNPT-HN-0123446',
    });
    await adapter.copyText('secret');
    expect(callHandler).toHaveBeenCalledWith(FLUTTER_HANDLER_NAMES.copyText, { text: 'secret' });

    const listener = vi.fn();
    const unsubscribe = adapter.onNetworkChange(listener);
    window.dispatchEvent(
      new CustomEvent(FLUTTER_NETWORK_CHANGE_EVENT, { detail: { type: 'WIFI', bssid: 'AA' } }),
    );
    expect(listener).toHaveBeenCalledWith({ type: 'WIFI', bssid: 'AA' });
    unsubscribe();
  });

  it('normalizes host errors carrying a bridge code', async () => {
    installBridge(() => {
      throw { code: 'PERMISSION_DENIED' };
    });
    const adapter = createFlutterInAppWebViewAdapter({ confirmedMethods: new Set(['getWifiInfo']) });
    await expect(adapter.getWifiInfo()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('reads the locale from the legacy session handler', async () => {
    const callHandler = installBridge((name) =>
      name === 'miniapp.getSession' ? { userId: 'u1' } : undefined,
    );
    const adapter = createFlutterInAppWebViewAdapter();
    await expect(adapter.getSession()).resolves.toEqual({ locale: 'vi-VN' });
    expect(callHandler).toHaveBeenCalledWith('miniapp.getSession');
  });

  it('reads a host-provided locale', async () => {
    installBridge((name) => (name === 'miniapp.getSession' ? { locale: 'en-US' } : undefined));
    await expect(createFlutterInAppWebViewAdapter().getSession()).resolves.toEqual({ locale: 'en-US' });
  });

  it.each([
    ['null', () => null],
    ['an empty locale', () => ({ locale: '' })],
    ['a non-string locale', () => ({ locale: 42 })],
    [
      'a host error',
      () => {
        throw new Error('handler not registered');
      },
    ],
  ])('falls back to vi-VN when the legacy handler returns %s', async (_label, impl) => {
    installBridge((name) => (name === 'miniapp.getSession' ? impl() : undefined));
    await expect(createFlutterInAppWebViewAdapter().getSession()).resolves.toEqual({ locale: 'vi-VN' });
  });

  it('falls back to vi-VN when the legacy handler never answers', async () => {
    vi.useFakeTimers();
    try {
      installBridge(() => new Promise(() => undefined));
      const pending = createFlutterInAppWebViewAdapter().getSession();
      await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS);
      await expect(pending).resolves.toEqual({ locale: 'vi-VN' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to vi-VN when the bridge is never injected', async () => {
    vi.useFakeTimers();
    try {
      delete window.flutter_inappwebview;
      const pending = createFlutterInAppWebViewAdapter().getSession();
      await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS);
      await expect(pending).resolves.toEqual({ locale: 'vi-VN' });
    } finally {
      vi.useRealTimers();
    }
  });
});
