import type { BridgeMethod } from '../my-home-bridge';

/**
 * Flutter `callHandler` names for each bridge method.
 *
 * PLACEHOLDERS — the super-app team has not published the official names yet
 * (S-08 for the HLD functions, S-01…S-07 and S-10 for the rest). Change only this file
 * once the JSBridge spec arrives.
 */
export const FLUTTER_HANDLER_NAMES = {
  getMiniAppToken: 'myhome.getMiniAppToken', // S-08, S-09
  closeMiniApp: 'myhome.closeMiniApp', // S-08
  getAppInfo: 'myhome.getAppInfo', // S-01
  getNetworkInfo: 'myhome.getNetworkInfo', // S-02
  getWifiInfo: 'myhome.getWifiInfo', // S-03
  measureWifiSpeed: 'myhome.measureWifiSpeed', // S-04 (method A, SPEED)
  readWifiRssi: 'myhome.readWifiRssi', // S-04 (method B, RSSI)
  onNetworkChange: 'myhome.onNetworkChange', // S-05
  openDeeplink: 'myhome.openDeeplink', // S-06
  openPayment: 'myhome.openPayment', // S-10
  saveImage: 'myhome.saveImage', // S-07
  shareImage: 'myhome.shareImage', // S-07
  copyText: 'myhome.copyText', // S-07
} as const satisfies Record<BridgeMethod, string>;

/** Handler outside the MyHome bridge contract, used only to read the host locale. */
export const FLUTTER_LEGACY_HANDLER_NAMES = {
  getSession: 'miniapp.getSession',
} as const;

/**
 * Methods assumed available in the Flutter host. Only the HLD-backed functions are enabled;
 * add a method here when the super-app team confirms it (LLD §11.3: a feature depending on an
 * unconfirmed function is not usable yet).
 */
export const FLUTTER_CONFIRMED_METHODS: ReadonlySet<BridgeMethod> = new Set<BridgeMethod>([
  'getMiniAppToken',
  'closeMiniApp',
]);

/**
 * Window event the host is expected to dispatch for `onNetworkChange` (S-05, unconfirmed).
 * `detail` must be `{ type: string; bssid: string | null }`.
 */
export const FLUTTER_NETWORK_CHANGE_EVENT = 'myhome:network-change';
