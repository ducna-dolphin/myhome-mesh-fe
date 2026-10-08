import { env } from '@/shared/config/env';
import { BridgeError } from '../bridge-error';
import { guardBridge, type RawBridge } from '../guard-bridge';
import { bridgeMethods, type BridgeMethod, type Platform } from '../my-home-bridge';
import { DEFAULT_LOCALE, type SuperAppClient, type SuperAppSession } from '../super-app-client';

export type MockPlatform = 'android' | 'ios' | 'web';
export type MockAndroidMethod = 'SPEED' | 'RSSI' | 'NONE';

export interface BrowserMockOptions {
  platform?: MockPlatform;
  /** Which Android measurement function the mock host implements. */
  androidMethod?: MockAndroidMethod;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

/** Methods the simulated host implements for a given platform. */
export function mockSupportedMethods(
  platform: MockPlatform,
  androidMethod: MockAndroidMethod,
): ReadonlySet<BridgeMethod> {
  if (platform === 'web') return new Set<BridgeMethod>(['getMiniAppToken', 'closeMiniApp', 'copyText']);

  const measure = new Set<BridgeMethod>();
  if (platform === 'android' && androidMethod === 'SPEED') measure.add('measureWifiSpeed');
  if (platform === 'android' && androidMethod === 'RSSI') measure.add('readWifiRssi');

  return new Set<BridgeMethod>(
    bridgeMethods.filter(
      (method) => (method !== 'measureWifiSpeed' && method !== 'readWifiRssi') || measure.has(method),
    ),
  );
}

export function createBrowserMockAdapter(options: BrowserMockOptions = {}): SuperAppClient {
  const platform = options.platform ?? env.VITE_MOCK_PLATFORM;
  const androidMethod = options.androidMethod ?? env.VITE_MOCK_ANDROID_METHOD;
  const supported = mockSupportedMethods(platform, androidMethod);
  let tokenSerial = 0;

  const raw: RawBridge = {
    async getMiniAppToken() {
      tokenSerial += 1;
      return { accessToken: `mock-miniapp-token-${tokenSerial}`, expiresIn: 900 };
    },
    async closeMiniApp() {
      window.history.back();
    },
    async getAppInfo() {
      const bridgePlatform: Platform = platform === 'ios' ? 'IOS' : 'ANDROID';
      return {
        platform: bridgePlatform,
        appVersion: '0.0.0-mock',
        osVersion: platform === 'ios' ? '18.0' : '15',
      };
    },
    async getNetworkInfo() {
      return { type: navigator.onLine === false ? 'NONE' : 'WIFI', vpnActive: false };
    },
    async getWifiInfo() {
      return {
        // iPhone usually cannot read the BSSID (S-03).
        bssid: platform === 'ios' ? null : 'A4:56:02:3C:11:9F',
        ipAddress: '192.168.1.23',
        macAddress: platform === 'ios' ? null : '3A:1F:00:AB:CD:EF',
      };
    },
    async measureWifiSpeed({ durationSec }) {
      await wait(durationSec * 1000);
      return {
        downloadMbps: Math.round(randomBetween(60, 280)),
        latencyMs: Math.round(randomBetween(8, 70)),
      };
    },
    async readWifiRssi({ durationSec }) {
      await wait(durationSec * 1000);
      return { rssiDbm: Math.round(randomBetween(-80, -50)), sampleCount: Math.max(1, durationSec) };
    },
    onNetworkChange(callback) {
      const onOnline = () => callback({ type: 'WIFI', bssid: 'A4:56:02:3C:11:9F' });
      const onOffline = () => callback({ type: 'NONE', bssid: null });
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    },
    async openDeeplink(url) {
      console.info('[bridge-mock] openDeeplink', url);
    },
    async openPayment(opts) {
      console.info('[bridge-mock] openPayment', opts.contractCode);
    },
    async saveImage(dataUrl) {
      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = 'wifi-qr.png';
      anchor.click();
    },
    async shareImage(dataUrl, text) {
      if (typeof navigator.share !== 'function') throw new BridgeError('BRIDGE_UNSUPPORTED', 'shareImage');
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'wifi-qr.png', { type: blob.type || 'image/png' });
      await navigator.share({ files: [file], text });
    },
    async copyText(text) {
      if (!navigator.clipboard) throw new BridgeError('FAILED', 'copyText');
      await navigator.clipboard.writeText(text);
    },
  };

  const bridge = guardBridge(raw, (method) => supported.has(method));

  return {
    ...bridge,
    kind: 'browser-mock',
    async getSession(): Promise<SuperAppSession> {
      return { locale: DEFAULT_LOCALE };
    },
  };
}
