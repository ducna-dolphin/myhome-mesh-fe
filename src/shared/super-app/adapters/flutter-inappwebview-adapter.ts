import { guardBridge, withBridgeTimeout, type RawBridge } from '../guard-bridge';
import type {
  AppInfo,
  BridgeMethod,
  MeasureWifiSpeedResult,
  MiniAppToken,
  NetworkChangeEvent,
  NetworkInfo,
  ReadWifiRssiResult,
  WifiInfo,
} from '../my-home-bridge';
import { DEFAULT_LOCALE, type SuperAppClient, type SuperAppSession } from '../super-app-client';
import {
  FLUTTER_CONFIRMED_METHODS,
  FLUTTER_HANDLER_NAMES,
  FLUTTER_LEGACY_HANDLER_NAMES,
  FLUTTER_NETWORK_CHANGE_EVENT,
} from './flutter-handler-names';

type FlutterBridge = {
  callHandler?<T = unknown>(handlerName: string, ...args: unknown[]): Promise<T>;
};

declare global {
  interface Window {
    flutter_inappwebview?: FlutterBridge;
  }
}

const PLATFORM_READY_EVENT = 'flutterInAppWebViewPlatformReady';
const READY_TIMEOUT_MS = 3_000;
/** Whole legacy `getSession` call, including the wait for a late bridge; start-up waits at most this. */
export const SESSION_TIMEOUT_MS = 5_000;

export function hasFlutterInAppWebViewBridge(): boolean {
  return 'flutter_inappwebview' in window;
}

async function getBridge(): Promise<Required<FlutterBridge>> {
  if (window.flutter_inappwebview?.callHandler) {
    return window.flutter_inappwebview as Required<FlutterBridge>;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener(PLATFORM_READY_EVENT, onReady);
      reject(new Error('Flutter WebView bridge did not become ready in time.'));
    }, READY_TIMEOUT_MS);

    const onReady = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    window.addEventListener(PLATFORM_READY_EVENT, onReady, { once: true });
  });

  if (!window.flutter_inappwebview?.callHandler) {
    throw new Error('Flutter WebView bridge is unavailable after platform-ready event.');
  }

  return window.flutter_inappwebview as Required<FlutterBridge>;
}

async function invoke<T>(handler: string, ...args: unknown[]): Promise<T> {
  const bridge = await getBridge();
  return bridge.callHandler<T>(handler, ...args);
}

export interface FlutterAdapterOptions {
  /** Methods the host is known to implement; defaults to the HLD-confirmed set. */
  confirmedMethods?: ReadonlySet<BridgeMethod>;
}

export function createFlutterInAppWebViewAdapter(options: FlutterAdapterOptions = {}): SuperAppClient {
  const confirmed = options.confirmedMethods ?? FLUTTER_CONFIRMED_METHODS;
  const names = FLUTTER_HANDLER_NAMES;

  const raw: RawBridge = {
    getMiniAppToken: () => invoke<MiniAppToken>(names.getMiniAppToken),
    closeMiniApp: async () => {
      await invoke(names.closeMiniApp);
    },
    getAppInfo: () => invoke<AppInfo>(names.getAppInfo),
    getNetworkInfo: () => invoke<NetworkInfo>(names.getNetworkInfo),
    getWifiInfo: () => invoke<WifiInfo>(names.getWifiInfo),
    measureWifiSpeed: (opts) => invoke<MeasureWifiSpeedResult>(names.measureWifiSpeed, opts),
    readWifiRssi: (opts) => invoke<ReadWifiRssiResult>(names.readWifiRssi, opts),
    onNetworkChange(callback) {
      // Assumed push channel (S-05): the host dispatches a window CustomEvent.
      const listener = (event: Event) => callback((event as CustomEvent<NetworkChangeEvent>).detail);
      window.addEventListener(FLUTTER_NETWORK_CHANGE_EVENT, listener);
      void invoke(names.onNetworkChange, { subscribe: true }).catch(() => undefined);
      return () => window.removeEventListener(FLUTTER_NETWORK_CHANGE_EVENT, listener);
    },
    openDeeplink: async (url) => {
      await invoke(names.openDeeplink, { url });
    },
    openPayment: async (opts) => {
      await invoke(names.openPayment, opts);
    },
    saveImage: async (dataUrl) => {
      await invoke(names.saveImage, { dataUrl });
    },
    shareImage: async (dataUrl, text) => {
      await invoke(names.shareImage, { dataUrl, text });
    },
    copyText: async (text) => {
      await invoke(names.copyText, { text });
    },
  };

  const bridge = guardBridge(raw, (method) => confirmed.has(method));

  return {
    ...bridge,
    kind: 'flutter-inappwebview',
    async getSession(): Promise<SuperAppSession> {
      // Legacy handler outside the MyHome contract: best effort, never blocks or fails start-up.
      try {
        const session = await withBridgeTimeout(
          'getSession',
          invoke<Partial<SuperAppSession> | null | undefined>(FLUTTER_LEGACY_HANDLER_NAMES.getSession),
          SESSION_TIMEOUT_MS,
        );
        const locale = session?.locale;
        return { locale: typeof locale === 'string' && locale.trim() !== '' ? locale : DEFAULT_LOCALE };
      } catch {
        return { locale: DEFAULT_LOCALE };
      }
    },
  };
}
