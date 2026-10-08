import { BridgeError, toBridgeError } from './bridge-error';
import {
  BRIDGE_TIMEOUT_MS,
  MEASURE_TIMEOUT_EXTRA_MS,
  type BridgeMethod,
  type MeasureOptions,
  type MyHomeBridge,
} from './my-home-bridge';

export type RawBridge = Omit<MyHomeBridge, 'supports'>;

/** Rejects with `BridgeError('TIMEOUT')` after `timeoutMs`; host errors become `BridgeError`. */
export function withBridgeTimeout<T>(method: string, promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new BridgeError('TIMEOUT', method)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(toBridgeError(method, error));
      },
    );
  });
}

/**
 * Wraps a raw adapter with the bridgeClient rules from LLD §11.3:
 * unsupported → `BRIDGE_UNSUPPORTED`, 10s timeout (measure: durationSec + 5s), errors normalized.
 */
export function guardBridge(raw: RawBridge, supports: (method: BridgeMethod) => boolean): MyHomeBridge {
  function call<T>(method: BridgeMethod, run: () => Promise<T>, timeoutMs = BRIDGE_TIMEOUT_MS): Promise<T> {
    if (!supports(method)) return Promise.reject(new BridgeError('BRIDGE_UNSUPPORTED', method));
    let pending: Promise<T>;
    try {
      pending = run();
    } catch (error) {
      return Promise.reject(toBridgeError(method, error));
    }
    return withBridgeTimeout(method, pending, timeoutMs);
  }

  const measureTimeout = (options: MeasureOptions) => options.durationSec * 1000 + MEASURE_TIMEOUT_EXTRA_MS;

  return {
    supports,
    getMiniAppToken: () => call('getMiniAppToken', () => raw.getMiniAppToken()),
    closeMiniApp: () => call('closeMiniApp', () => raw.closeMiniApp()),
    getAppInfo: () => call('getAppInfo', () => raw.getAppInfo()),
    getNetworkInfo: () => call('getNetworkInfo', () => raw.getNetworkInfo()),
    getWifiInfo: () => call('getWifiInfo', () => raw.getWifiInfo()),
    measureWifiSpeed: (options) =>
      call('measureWifiSpeed', () => raw.measureWifiSpeed(options), measureTimeout(options)),
    readWifiRssi: (options) => call('readWifiRssi', () => raw.readWifiRssi(options), measureTimeout(options)),
    onNetworkChange(callback) {
      if (!supports('onNetworkChange')) throw new BridgeError('BRIDGE_UNSUPPORTED', 'onNetworkChange');
      return raw.onNetworkChange(callback);
    },
    openDeeplink: (url) => call('openDeeplink', () => raw.openDeeplink(url)),
    openPayment: (options) => call('openPayment', () => raw.openPayment(options)),
    saveImage: (dataUrl) => call('saveImage', () => raw.saveImage(dataUrl)),
    shareImage: (dataUrl, text) => call('shareImage', () => raw.shareImage(dataUrl, text)),
    copyText: (text) => call('copyText', () => raw.copyText(text)),
  };
}
