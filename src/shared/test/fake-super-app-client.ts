import { vi, type Mock } from 'vitest';
import {
  bridgeMethods,
  type BridgeMethod,
  type SuperAppClient,
  type SuperAppSession,
} from '@/shared/super-app';

type AnyFunction = (...args: never[]) => unknown;

/**
 * `SuperAppClient` whose methods are Vitest mocks typed against the bridge contract, so tests can
 * `mockResolvedValue` any contract value (e.g. `platform: 'IOS'`, `bssid: null`) without casts.
 */
export type FakeSuperAppClient = {
  [K in keyof SuperAppClient]: SuperAppClient[K] extends AnyFunction
    ? Mock<SuperAppClient[K]>
    : SuperAppClient[K];
};

const defaultSession: SuperAppSession = { locale: 'vi-VN' };

/** Test double implementing the full `SuperAppClient` with spies; every method is supported by default. */
export function createFakeSuperAppClient(
  session: SuperAppSession = defaultSession,
  supported: Iterable<BridgeMethod> = bridgeMethods,
): FakeSuperAppClient {
  const supportedSet = new Set<BridgeMethod>(supported);
  const fn = <K extends keyof SuperAppClient>(
    _name: K,
    impl: Extract<SuperAppClient[K], AnyFunction>,
  ): Mock<Extract<SuperAppClient[K], AnyFunction>> => vi.fn(impl);

  return {
    kind: 'browser-mock',
    getSession: fn('getSession', async () => session),
    supports: fn('supports', (method) => supportedSet.has(method)),
    getMiniAppToken: fn('getMiniAppToken', async () => ({ accessToken: 'test-token', expiresIn: 900 })),
    closeMiniApp: fn('closeMiniApp', async () => undefined),
    getAppInfo: fn('getAppInfo', async () => ({ platform: 'ANDROID', appVersion: '1.0.0', osVersion: '15' })),
    getNetworkInfo: fn('getNetworkInfo', async () => ({ type: 'WIFI', vpnActive: false })),
    getWifiInfo: fn('getWifiInfo', async () => ({
      bssid: 'A4:56:02:3C:11:9F',
      ipAddress: '192.168.1.23',
      macAddress: '3A:1F:00:AB:CD:EF',
    })),
    measureWifiSpeed: fn('measureWifiSpeed', async () => ({ downloadMbps: 200, latencyMs: 20 })),
    readWifiRssi: fn('readWifiRssi', async () => ({ rssiDbm: -55, sampleCount: 8 })),
    onNetworkChange: fn('onNetworkChange', () => () => {}),
    openDeeplink: fn('openDeeplink', async () => undefined),
    openPayment: fn('openPayment', async () => undefined),
    saveImage: fn('saveImage', async () => undefined),
    shareImage: fn('shareImage', async () => undefined),
    copyText: fn('copyText', async () => undefined),
  };
}
