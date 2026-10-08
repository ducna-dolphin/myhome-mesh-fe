import { createSuperAppClient } from './create-super-app-client';
import { createSessionCache } from './super-app-session-cache';

export type { LegacySuperAppCalls, SuperAppClient, SuperAppSession } from './super-app-client';
export { DEFAULT_LOCALE } from './super-app-client';
export type {
  AppInfo,
  BridgeMethod,
  MeasureOptions,
  MeasureWifiSpeedResult,
  MiniAppToken,
  MyHomeBridge,
  NetworkChangeEvent,
  NetworkInfo,
  Platform,
  ReadWifiRssiResult,
  WifiInfo,
} from './my-home-bridge';
export { bridgeMethods, BRIDGE_TIMEOUT_MS, MEASURE_TIMEOUT_EXTRA_MS } from './my-home-bridge';
export { BridgeError, bridgeErrorCodes, isBridgeError, toBridgeError } from './bridge-error';
export type { BridgeErrorCode } from './bridge-error';
export { guardBridge } from './guard-bridge';
export type { RawBridge } from './guard-bridge';
export { createBrowserMockAdapter, mockSupportedMethods } from './adapters/browser-mock-adapter';
export type { BrowserMockOptions, MockAndroidMethod, MockPlatform } from './adapters/browser-mock-adapter';
export {
  FLUTTER_CONFIRMED_METHODS,
  FLUTTER_HANDLER_NAMES,
  FLUTTER_NETWORK_CHANGE_EVENT,
} from './adapters/flutter-handler-names';
export { createFlutterInAppWebViewAdapter } from './adapters/flutter-inappwebview-adapter';
export { createSuperAppClient } from './create-super-app-client';
export { createSessionCache } from './super-app-session-cache';
export { SuperAppProvider } from './super-app-provider';
export { useSuperApp } from './use-super-app';

/** Process-wide host client; React code should prefer `useSuperApp()` for injectability. */
export const superApp = createSuperAppClient();
const sessionCache = createSessionCache(superApp);

export const getSession = sessionCache.getSession;
