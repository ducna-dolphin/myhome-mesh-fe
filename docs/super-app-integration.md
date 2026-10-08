# Super-app integration

## Purpose

The miniapp runs inside the MyHome super app (Flutter WebView) in production but must also work in a normal browser for frontend development.

All host-app communication is isolated behind `SuperAppClient` in `src/shared/super-app`. No other layer touches `window.flutter_inappwebview` (enforced by ESLint).

## Bridge contract (LLD §11.3)

`SuperAppClient` implements the `MyHomeBridge` interface from the LLD (chapter 11.3), plus three legacy calls kept for the pre-LLD screens.

```ts
type Platform = 'ANDROID' | 'IOS';

interface MyHomeBridge {
  getMiniAppToken(): Promise<{ accessToken: string; expiresIn: number }>;
  closeMiniApp(): Promise<void>;
  getAppInfo(): Promise<{ platform: Platform; appVersion: string; osVersion: string }>;
  getNetworkInfo(): Promise<{ type: 'WIFI' | 'CELLULAR' | 'NONE'; vpnActive: boolean }>;
  getWifiInfo(): Promise<{ bssid: string | null; ipAddress: string | null; macAddress: string | null }>;
  measureWifiSpeed(opts: { durationSec: number }): Promise<{ downloadMbps: number; latencyMs: number }>; // Android method A
  readWifiRssi(opts: { durationSec: number }): Promise<{ rssiDbm: number; sampleCount: number }>; // Android method B
  onNetworkChange(cb: (info: { type: string; bssid: string | null }) => void): () => void;
  openDeeplink(url: string): Promise<void>;
  openPayment(opts: { contractCode: string }): Promise<void>;
  saveImage(dataUrl: string): Promise<void>;
  shareImage(dataUrl: string, text?: string): Promise<void>;
  copyText(text: string): Promise<void>;
  supports(method: BridgeMethod): boolean;
}

interface SuperAppClient extends MyHomeBridge {
  readonly kind: 'flutter-inappwebview' | 'browser-mock';
  /** Legacy handler `miniapp.getSession`; only `{ locale }` is read. Never rejects (falls back to 'vi-VN'). */
  getSession(): Promise<SuperAppSession>;
}
```

Differences from the LLD text:

- `measureWifi` is split into `measureWifiSpeed` (SPEED, QD-02/QD-03) and `readWifiRssi` (RSSI, QD-04) so the backend can pick the Android method with `GET /mesh/v1/signal-thresholds → androidMethod` (openapi-review-2026-10-08 §3). The host may implement either; the miniapp checks `supports()`.
- `getPhoneConsent` / `requestPhoneConsent` are not used by this miniapp (phone is read from the SC token) and are not part of the client.

### Rules applied by `guardBridge` (every adapter)

| Rule                        | Behaviour                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `supports(method)` is false | Rejects with `BridgeError { code: 'BRIDGE_UNSUPPORTED' }` without calling the host     |
| Timeout                     | 10 s per call; `measureWifiSpeed` / `readWifiRssi` use `durationSec + 5 s` → `TIMEOUT` |
| Host error with `{ code }`  | Kept when it is `BRIDGE_UNSUPPORTED`, `PERMISSION_DENIED`, `TIMEOUT` or `FAILED`       |
| Any other host error        | `FAILED`                                                                               |

User messages come from the `errors` i18n namespace (`errors:bridge.<code>`), never from the host error text.

### Token (LLD §3.6, §11.1)

- The page never sees the SC token. `shared/api` keeps the MiniApp token **in memory only** (no localStorage, cookie or URL) through `createTokenManager`.
- A cached token is reused until less than 20 % of its lifetime is left; then `getMiniAppToken` is called again (one call shared by concurrent requests).
- On `401` the client asks for a new token and retries the request exactly once with the same `Idempotency-Key`; a second `401`, or no new token after the `401`, calls `closeMiniApp` (once, even for concurrent requests).
- A `getMiniAppToken` answer that is not `{ accessToken: non-empty string, expiresIn: positive integer }` is rejected as `BridgeError('FAILED')` and never cached.

## Adapters

### Flutter (`createFlutterInAppWebViewAdapter`)

Uses `window.flutter_inappwebview.callHandler`, waiting for `flutterInAppWebViewPlatformReady` when the bridge is injected late. Production always selects this adapter.

Handler names live in `src/shared/super-app/adapters/flutter-handler-names.ts`. **They are placeholders** (`myhome.<method>`) until the super-app team publishes the JSBridge spec:

| Method                                | Placeholder handler                                             | Question   |
| ------------------------------------- | --------------------------------------------------------------- | ---------- |
| `getMiniAppToken`                     | `myhome.getMiniAppToken`                                        | S-08, S-09 |
| `closeMiniApp`                        | `myhome.closeMiniApp`                                           | S-08       |
| `getAppInfo`                          | `myhome.getAppInfo`                                             | S-01       |
| `getNetworkInfo`                      | `myhome.getNetworkInfo`                                         | S-02       |
| `getWifiInfo`                         | `myhome.getWifiInfo`                                            | S-03       |
| `measureWifiSpeed`, `readWifiRssi`    | `myhome.measureWifiSpeed`, `myhome.readWifiRssi`                | S-04       |
| `onNetworkChange`                     | `myhome.onNetworkChange` + window event `myhome:network-change` | S-05       |
| `openDeeplink`                        | `myhome.openDeeplink`                                           | S-06       |
| `saveImage`, `shareImage`, `copyText` | `myhome.saveImage`, `myhome.shareImage`, `myhome.copyText`      | S-07       |
| `openPayment`                         | `myhome.openPayment`                                            | S-10       |

`FLUTTER_CONFIRMED_METHODS` decides `supports()` in production. It only contains the HLD-backed `getMiniAppToken` and `closeMiniApp`: per LLD §11.3 a feature that depends on an unconfirmed function is not usable yet. Add a method there once it is confirmed.

Only one legacy handler remains: `miniapp.getSession`, read once at start-up for the host locale. It is
not part of the MyHome contract (and `getAppInfo` carries no locale), so it is strictly best effort: the
whole call, including the wait for a late bridge, is bounded by a 5 s timeout, `locale` is read
null-safely, and any failure, timeout or malformed answer yields `vi-VN`. Start-up never shows an error
screen because of it; drop the handler once the host confirms the MiniApp is Vietnamese-only.
The old `miniapp.close` / `miniapp.openNativeRoute` calls were removed with the pre-redesign screens;
the no-Internet-service CTA uses `openDeeplink` (placeholder deeplink, S-06).

### Browser mock (`createBrowserMockAdapter`)

Used by `npm run dev` outside Flutter. Configurable with env flags:

| Flag                                         | Effect                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `VITE_MOCK_PLATFORM=android` (default)       | Every method supported; `measureWifiSpeed` or `readWifiRssi` depending on `VITE_MOCK_ANDROID_METHOD` |
| `VITE_MOCK_PLATFORM=ios`                     | No measurement functions (iPhone uses manual AirPort Utility input); `getWifiInfo().bssid = null`    |
| `VITE_MOCK_PLATFORM=web`                     | Only `getMiniAppToken`, `closeMiniApp`, `copyText`                                                   |
| `VITE_MOCK_ANDROID_METHOD=SPEED\|RSSI\|NONE` | Which Android measurement function the mock host implements                                          |

Mock tokens are `mock-miniapp-token-<n>` (900 s); measurements wait `durationSec` and return random plausible values.

## React access

- UI code uses `useSuperApp()` (injectable in tests via `SuperAppProvider` + `createFakeSuperAppClient()`).
- Framework-agnostic code (the HTTP client) uses the module-level `superApp` instance.

## Open questions for the super-app team (LLD §13.5)

| Code | Question                                                                                                                   | Impact                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| S-01 | `getAppInfo`: platform, app version, OS version                                                                            | Android/iPhone measurement flow, `X-Client-Version`              |
| S-02 | `getNetworkInfo`: connection type, VPN state                                                                               | Measurement conditions DK-02, DK-03                              |
| S-03 | `getWifiInfo`: BSSID (needs location permission), phone IP and MAC; can iPhone read the BSSID?                             | DK-04, DK-05; never block/remove the phone itself (P4-02, P4-03) |
| S-04 | `measureWifiSpeed` / `readWifiRssi`: which one(s) the host can implement, sampling, target server                          | Android measurement (P2-03)                                      |
| S-05 | `onNetworkChange`: event channel for network loss / Wi-Fi switch                                                           | Cancel a running measurement (LS-01)                             |
| S-06 | `openDeeplink` and the deeplink list (VNPT Shop: register Internet, order Mesh; App Store: AirPort Utility)                | P1-01, P2-01, P2-04, P6-01                                       |
| S-07 | `saveImage`, `shareImage`, `copyText`                                                                                      | Wi-Fi QR and password copy (P3-01)                               |
| S-08 | Official names of HLD functions, common error shape `{ code }`, 10 s timeout                                               | Whole bridge                                                     |
| S-09 | Host calls `POST /link/v1/mini-app-sessions` before opening the WebView; `getMiniAppToken` re-issues through the same path | Token flow (chapter 3, P1-01)                                    |
| S-10 | Navigation to the payment/renewal screen (`openPayment({ contractCode })` or a deeplink)                                   | "Thanh toán / Gia hạn ngay" (P1-02)                              |

Also needed: one OTP test token on `sc.dimarket.vn` and the registered WebView origin.

## Locale

The legacy session locale is normalized to the language code. Bundled support is Vietnamese only, so unsupported values fall back to `vi`.
