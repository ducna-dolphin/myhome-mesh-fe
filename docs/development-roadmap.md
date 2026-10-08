# Development roadmap

Plan: `plans/261008-0026-internet-redesign-xd-figma/plan.md` (Internet redesign from the XD mockup and the
Figma flow board, aligned with the LLD and `contracts/openapi.yaml`).

## Done (frontend, on mock data)

| Area                      | Status | Notes                                                                                                                 |
| ------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| Navigation / IA           | Done   | One "Internet" screen, contract card, 4 pill tabs, sub-pages with back, sheets via `?sheet=`; legacy URLs redirect    |
| Design fidelity           | Done   | XD tokens, `shared/ui` primitives, lucide icons, self-hosted Be Vietnam Pro (400/600/700)                             |
| Bridge + data contracts   | Done   | `MyHomeBridge` client, CF `apiRequest`, idempotency, command poller, generated OpenAPI types, contract → serial scope |
| Mock consistency          | Done   | MSW handlers per entity, fixtures typed with the contract and parsed by Zod in tests, scenario flags                  |
| Wifi tab                  | Done   | List, on/off (optimistic, async command), rename/password, reveal + copy, QR share; schedule dropped from M1          |
| Wi-Fi health by location  | Done   | Location CRUD (max 20), Android SPEED/RSSI via bridge, iPhone manual RSSI (AirPort Utility), history, Mesh suggestion |
| Connected devices         | Done   | Filters with counts, detail, block/unblock, remove, rename + icon, traffic sort/focus from the Quality tab            |
| Quality + Modem tabs      | Done   | Async 3-step check, 9 statuses / 5 actions, fault report; ONT info, rename, reboot (3 / 30 min)                       |
| Cleanup, a11y, perf, docs | Done   | Legacy pre-redesign code removed, axe audit in tests, bundle budget in CI, docs refreshed                             |

## Remaining before a real release

Everything runs on MSW mocks. Replacing them needs answers from partners (codes from the LLD and
`plans/…/research/`):

### Super app (S-)

- S-01…S-10: official JSBridge handler names, parameters, error shape; `getAppInfo`, `getNetworkInfo`,
  `getWifiInfo` (BSSID on iPhone), `measureWifiSpeed` / `readWifiRssi`, `onNetworkChange`, deeplinks
  (VNPT Shop, payment, App Store AirPort Utility), `saveImage` / `shareImage` / `copyText`,
  `openPayment`. Until confirmed, `FLUTTER_CONFIRMED_METHODS` only enables `getMiniAppToken` and
  `closeMiniApp`, so dependent features show "unsupported".
- A test OTP token and the registered WebView origin.

### OneBSS (B-)

- B-01 ONT serial number per contract (blocks every tab when missing), B-02, B-05 plan speed (Quality
  "% of plan"), B-08, B-09 fault report.

### OneGate / VNPT Technology (G-)

- G-01…G-03 login and test environment, G-06/G-07 nullable uptime/traffic/temperature, G-10 removal
  semantics, G-14 traffic share, G-18…G-22 homes with Mesh. Without them there is no end-to-end test.

### VNPT Media / PO (M-, D-)

- M-02, M-18 Android measurement target server; M-05, M-11, M-12 dialog and status copy; M-08 QR of a
  disabled network; M-10 / D-05 screen when 20 locations are reached; M-15 device removal; D-01 contract
  picker design; Q19 slides 2–5 of the no-service carousel; "Kiểm tra lại" button (not in XD).

### Backend / OpenAPI review (R-)

R-01…R-11 from `research/openapi-review-2026-10-08.md`, notably R-01 (commands do not say which target
they act on), R-02 (`ConnectedDevice.name` must be nullable), R-03 (`MeasurementInput` constraints),
R-04 (`billing` block), R-06 (DELETE with body), R-08 (single "enable all Wi-Fi" command), R-10
(`PLAN_SPEED_UNKNOWN`). A dev environment with CORS for the frontend origin is also needed.

Each pending UI detail is listed in `src/shared/config/pending-spec-notes.ts` and shown as a `SpecNote`
in mock mode; remove an entry once agreed.

## Engineering backlog

- Replace placeholder Flutter handler names and enable confirmed bridge methods.
- Wire `VITE_API_MODE=remote` against the dev backend; run the contract test against real responses.
- Manual QA on Android/iOS WebViews at 360 / 390 / 430 px with every `VITE_MOCK_*` scenario.
- Optional vendor `manualChunks` if long-term caching across releases matters (entry is ~160 kB gzip).
- Dependabot, scheduled audit, frontend error reporting, private source-map upload.
