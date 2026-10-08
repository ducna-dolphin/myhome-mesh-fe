/**
 * JSBridge contract with the MyHome super app (LLD §11.3).
 *
 * Only `getMiniAppToken` and `closeMiniApp` are backed by the HLD; every other function is
 * still unconfirmed by the super-app team (S-01…S-10, see docs/super-app-integration.md).
 * Callers must check `supports(method)` before relying on an optional function.
 *
 * `measureWifi` from the LLD is split into `measureWifiSpeed` (method A, SPEED) and
 * `readWifiRssi` (method B, RSSI) per openapi-review-2026-10-08 §3.
 */
export type Platform = 'ANDROID' | 'IOS';

export interface MiniAppToken {
  accessToken: string;
  /** Seconds until expiry (proposed 900). */
  expiresIn: number;
}

export interface AppInfo {
  platform: Platform;
  appVersion: string;
  osVersion: string;
}

export interface NetworkInfo {
  type: 'WIFI' | 'CELLULAR' | 'NONE';
  vpnActive: boolean;
}

export interface WifiInfo {
  /** MAC of the modem the phone is connected to; needs location permission. */
  bssid: string | null;
  /** Phone IP inside the home network. */
  ipAddress: string | null;
  /** Phone MAC; usually randomized per network. */
  macAddress: string | null;
}

export interface MeasureWifiSpeedResult {
  downloadMbps: number;
  latencyMs: number;
}

export interface ReadWifiRssiResult {
  rssiDbm: number;
  sampleCount: number;
}

export interface NetworkChangeEvent {
  type: string;
  bssid: string | null;
}

export interface MeasureOptions {
  durationSec: number;
}

export interface MyHomeBridge {
  getMiniAppToken(): Promise<MiniAppToken>;
  closeMiniApp(): Promise<void>;
  getAppInfo(): Promise<AppInfo>;
  getNetworkInfo(): Promise<NetworkInfo>;
  getWifiInfo(): Promise<WifiInfo>;
  measureWifiSpeed(options: MeasureOptions): Promise<MeasureWifiSpeedResult>;
  readWifiRssi(options: MeasureOptions): Promise<ReadWifiRssiResult>;
  /** Returns an unsubscribe function. */
  onNetworkChange(callback: (event: NetworkChangeEvent) => void): () => void;
  openDeeplink(url: string): Promise<void>;
  openPayment(options: { contractCode: string }): Promise<void>;
  saveImage(dataUrl: string): Promise<void>;
  shareImage(dataUrl: string, text?: string): Promise<void>;
  copyText(text: string): Promise<void>;
  supports(method: BridgeMethod): boolean;
}

export type BridgeMethod = Exclude<keyof MyHomeBridge, 'supports'>;

export const bridgeMethods = [
  'getMiniAppToken',
  'closeMiniApp',
  'getAppInfo',
  'getNetworkInfo',
  'getWifiInfo',
  'measureWifiSpeed',
  'readWifiRssi',
  'onNetworkChange',
  'openDeeplink',
  'openPayment',
  'saveImage',
  'shareImage',
  'copyText',
] as const satisfies readonly BridgeMethod[];

type MissingBridgeMethod = Exclude<BridgeMethod, (typeof bridgeMethods)[number]>;
// Compile-time guard: adding a method to MyHomeBridge must also list it above.
const _exhaustive: MissingBridgeMethod extends never ? true : never = true;
void _exhaustive;

/** Bridge default timeout (LLD §11.3); measurement calls use `durationSec + 5s`. */
export const BRIDGE_TIMEOUT_MS = 10_000;
export const MEASURE_TIMEOUT_EXTRA_MS = 5_000;
