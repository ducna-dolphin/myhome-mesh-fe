# Project changelog

This file summarizes architecture-level changes. Product release notes should be maintained separately when release/versioning rules are defined.

## Unreleased

### Internet redesign (XD + Figma, LLD contract) — phases 1–9

- New IA: one "Internet" screen with header, contract card and four pill tabs (Wifi, Thiết bị kết nối,
  Modem, Chất lượng), sub-pages with back and bottom sheets; it replaces the old three-entry menu and legacy
  URLs redirect.
- XD design tokens and `shared/ui` primitives; lucide icons; self-hosted Be Vietnam Pro 400/600/700
  (latin + vietnamese woff2 only).
- `MyHomeBridge` super-app client, CF `apiRequest` (envelope, `Idempotency-Key`, token refresh on 401),
  async command poller, generated OpenAPI types and contract → serial-number data scope.
- MSW mocks per entity with contract-typed fixtures and scenario flags (`VITE_MOCK_*`, including
  `VITE_MOCK_HEALTH=off|fail|hogged` and forced `UNKNOWN` command outcomes).
- Wifi tab (list, on/off, rename/password, copy, QR), Wi-Fi health by location (Android bridge
  measurement, iPhone manual RSSI), connected devices (filters, block, remove, rename/icon), Modem
  (ONT info, rename, reboot) and Quality (async 3-step check, actions, fault report).
- Removed the pre-redesign pages, entities and features (overview, mesh, health, clients, diagnostics,
  old modem/wifi/network/subscription), `withMock`, the legacy `request` client, `line-icons`, the
  `network` i18n namespace, session `networkId`, legacy `close` / `openNativeRoute` host calls and the
  `VITE_DEFAULT_NETWORK_ID` / `VITE_MOCK_INTERNET_SUBSCRIPTION` flags.
- Quality gates: axe audit of every tab/sub-page/sheet, 70 % line coverage for features and widgets,
  `npm run size` bundle budget (entry ≤ 180 kB gzip, chunks ≤ 60 kB, no MSW in remote builds) in CI.

### Product flows (pre-redesign, since replaced)

- Added account-level Internet-subscription detection and a no-service gate across all Internet-management routes.
- Added a modem-management screen matching the wireframe: contract/payment dates, tab bar to existing screens, per-modem device info (MAC, WAN IP, firmware, uptime, optional traffic/temperature), inline rename and confirmed restart with outcome feedback.
- Added a host-app CTA from the no-service screen to the Internet-service shop placeholder route; the no-service screen pins the header title and reports CTA failures.
- The miniapp header no longer renders a close button on the home route; exiting is owned by the super-app host's own × button.
- Added `SpecNote` hover/tap tooltips for details pending partner confirmation, driven by `shared/config/pending-spec-notes.ts` (shown in mock mode or via `VITE_SHOW_SPEC_NOTES`).

### Hardening

- Production bundles always use the Flutter adapter and wait for the bridge instead of using browser mocks.
- Retry session initialization while the host bridge becomes ready; deduplicate simultaneous refresh calls.
- Bound request time across session resolution, refresh and fetch; forward query cancellation to the HTTP client.
- Show localized errors for SSID updates and speed tests, and disable public production source maps.
- Remove the unused host telemetry method until a real contract exists.
- Add a retry action to query and session error states; refetch data when the WebView returns to the foreground.

### Architecture

- Introduced FSD-lite layers: app, pages, features, entities and shared.
- Enforced dependency direction, same-layer slice isolation and public entry points with ESLint.
- Centralized hash-route definitions and lazy page loading.
- Added injectable `SuperAppProvider` for host-app actions.

### Integration

- Isolated Flutter WebView calls behind `SuperAppClient`.
- Added browser mock and Flutter adapters.
- Added cached session resolution with race-safe refresh.
- Added HTTP timeout, typed API errors, one-time 401 refresh and Zod response parsing.

### Data

- Split network, Wi-Fi, clients, Mesh topology and health into entity slices.
- Added Internet-subscription and modem entities with mock/remote adapters and network-scoped modem query keys.
- Added network-scoped query keys and hooks.
- Preserved mock/remote API switching for frontend development.

### Internationalization

- Added bundled i18next/react-i18next resources.
- Added typed Vietnamese `common` and `network` namespaces.
- Session locale now selects the bundled language with Vietnamese fallback.
- Route titles, statuses, screen states and product copy now resolve through translation keys.

### Quality

- Added shared render/test helpers and injectable fake super-app client.
- Expanded page, feature, shell, session, HTTP and schema coverage.
- Added global and shared/entity line-coverage thresholds.
- Added CI for format, lint, typecheck, coverage tests and build.
- Added architecture, code-standard, super-app integration and roadmap documentation.

### Diagnostics (pre-redesign speed test, since replaced by the Quality tab)

- Added staged connection-check progress, a pending checklist and neutral speed-test results.
- Added distinct failure presentation, screen-reader step announcements and dynamic route titles.
- Added cancellable requests, reduced-motion support and accessible keyboard focus styles.

## Known follow-ups

- Official super-app JSBridge names and confirmed methods (S-01…S-10).
- Real backend environment; OpenAPI review items R-01…R-11.
- Partner answers listed in `docs/development-roadmap.md` (B-, G-, M-, D-).
