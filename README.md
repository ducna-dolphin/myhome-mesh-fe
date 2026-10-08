# Wi-Fi Mesh Miniapp Frontend

React/TypeScript frontend for the Wi-Fi Mesh miniapp embedded in a Flutter super app.

The miniapp is one "Internet" screen (contract card + four tabs: Wifi, Thiết bị kết nối, Modem, Chất lượng)
built from the XD mockup and the Figma flow board. It calls the MyHome backend API (`contracts/openapi.yaml`,
LLD) and never calls ONE Link / OneGate / OneBSS directly.

## Stack

- React 19 + TypeScript + Vite
- React Router v7 with hash routing (lazy route chunks)
- TanStack Query v5
- Zod (+ types generated from OpenAPI with `openapi-typescript`)
- i18next + react-i18next (bundled `vi`)
- Plain CSS with design tokens, `lucide-react` icons, self-hosted Be Vietnam Pro
- MSW for the mock API (browser and Vitest)
- Vitest + React Testing Library + vitest-axe
- ESLint architectural boundaries (FSD) + Prettier

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

In development (`npm run dev`) the default API mode is `mock`: MSW serves the whole LLD API in the
browser and the bridge is simulated, so local development needs neither the backend nor the Flutter host.
Production builds (`npm run build`) default to `remote`.

### Environment variables

| Variable                   | Values (default first)                                          | Purpose                                                                                                      |
| -------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `VITE_API_MODE`            | `mock` \| `remote` (dev: `mock`, build: `remote`)               | `mock` starts the MSW service worker for the LLD API; `remote` calls `VITE_API_BASE_URL` (MSW not bundled)   |
| `VITE_API_BASE_URL`        | URL (`https://api.example.local`)                               | API gateway base URL                                                                                         |
| `VITE_SHOW_SPEC_NOTES`     | `true` \| `false` (unset = on in mock mode)                     | Pending-spec `?` tooltips                                                                                    |
| `VITE_MOCK_PLATFORM`       | `android` \| `ios` \| `web`                                     | Platform simulated by the browser bridge mock (`supports()`, `getAppInfo`)                                   |
| `VITE_MOCK_ANDROID_METHOD` | `SPEED` \| `RSSI` \| `NONE`                                     | Android measurement function of the mock host and `androidMethod` of the mocked signal thresholds            |
| `VITE_MOCK_CONTRACTS`      | `one` \| `none` \| `many`                                       | Contracts from `GET /link/v1/contract-links` (`none` → no-service page, `many` → contract picker)            |
| `VITE_MOCK_SERIAL`         | `present` \| `missing`                                          | Whether the contract detail carries the ONT `serialNumber` (`missing` → "Chưa xác định được modem")          |
| `VITE_MOCK_SURVEY`         | `full` \| `partial` \| `empty`                                  | Measurement locations (full = XD: 1 WEAK, 2 FAIR, 2 GOOD)                                                    |
| `VITE_MOCK_HEALTH`         | `stable` \| `unstable` \| `down` \| `off` \| `fail` \| `hogged` | Quality-check result: all good / 3 issues / modem offline / Wi-Fi off / weak Wi-Fi / one device hogs traffic |
| `VITE_MOCK_DEVICE`         | `online` \| `offline`                                           | `offline` answers device calls with `409 DEVICE_OFFLINE`                                                     |

The `VITE_MOCK_*` flags only affect the browser (MSW worker, bridge mock); tests switch scenarios with
`setMockScenario()` + `resetMockDb()`.

Details still pending partner confirmation are marked with an amber `?` tooltip (hover, focus or tap).
They show in mock mode by default; set `VITE_SHOW_SPEC_NOTES=true|false` to override. The full list lives in
`src/shared/config/pending-spec-notes.ts` — remove an entry once it is agreed.

Production builds call the real backend unless `VITE_API_MODE` is set explicitly (environment or a
`.env` file; note that `.env.example` sets `mock`):

```bash
VITE_API_BASE_URL=https://your-api.example npm run build   # remote, MSW not bundled
VITE_API_MODE=mock npm run build                            # demo bundle with mock data
```

`npm run size` always builds with an explicit `VITE_API_MODE=remote` and fails if MSW leaks into the bundle. Any production bundle requires the Flutter bridge; a missing bridge results in a session initialization error instead of a browser mock session.

## Scripts

| Script                  | Purpose                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server (mock mode by default)                                             |
| `npm run build`         | Typecheck + production build                                                       |
| `npm run preview`       | Serve `dist/`                                                                      |
| `npm run typecheck`     | `tsc` for app and node configs                                                     |
| `npm run lint`          | ESLint incl. FSD boundaries                                                        |
| `npm run lint:tokens`   | Rejects hex colours outside `src/app/styles/tokens.css`                            |
| `npm run format:check`  | Prettier check (`npm run format` writes)                                           |
| `npm test`              | Vitest (MSW node server, axe audit)                                                |
| `npm run test:coverage` | Coverage: 60 % global lines; 70 % for `shared`, `entities`, `features`, `widgets`  |
| `npm run size`          | Remote build bundle budget: entry ≤ 180 kB gzip, other chunks ≤ 60 kB gzip, no MSW |
| `npm run gen:api`       | Regenerate `src/shared/api/generated/openapi.ts` from `contracts/openapi.yaml`     |

CI (`.github/workflows/ci.yml`) runs format, lint, lint:tokens, typecheck, test:coverage, build and size.

## Routes

| Route                                               | Screen                                                  |
| --------------------------------------------------- | ------------------------------------------------------- |
| `#/`                                                | Redirects to the last visited tab, else `#/wifi`        |
| `#/wifi`                                            | Wi-Fi health by location + Wi-Fi networks               |
| `#/wifi/:wifiIndex/edit`, `/share`                  | Rename / password, QR share                             |
| `#/devices`, `#/devices/:mac`, `/:mac/edit`         | Connected devices, detail (block/remove), rename + icon |
| `#/modem`                                           | ONT info, rename, reboot                                |
| `#/quality`                                         | Line-quality check                                      |
| `#/clients…`, `#/health`, `#/diagnostics`, `#/mesh` | Legacy deep links, redirected                           |

## Project structure

```text
src/
├── app/        # providers, router, layouts, MSW aggregation, global styles/tokens
├── pages/      # one slice per route (composition)
├── widgets/    # composite blocks reused across pages (contract card, Wi-Fi list…)
├── features/   # user actions
├── entities/   # LLD resources: schemas, API, query hooks, MSW handlers (mock.ts)
└── shared/     # super-app bridge, HTTP, i18n, UI kit, config, test helpers
```

Dependency direction:

```text
app → pages → widgets → features → entities → shared
```

ESLint blocks same-layer cross-slice imports and deep imports into pages/features/entities.

## Backend contract

The contract is `contracts/openapi.yaml` (CF envelope, `Idempotency-Key`, async commands). Types are
generated into `src/shared/api/generated/openapi.ts` with `npm run gen:api`; entities (`contract`,
`ont-device`, `wifi-network`, `connected-device`, `measurement-location`, `health-check`, `command`)
call it through `apiRequest` and are mocked with MSW in mock mode and in tests. Data is scoped by the
selected contract and its ONT serial number.

ONE Link identifiers and credentials belong in the backend integration layer, not in this frontend.

## Flutter integration

The host-app seam is `SuperAppClient`. Production uses the Flutter adapter; local browser development uses a mock adapter.

The client implements the `MyHomeBridge` contract of LLD §11.3 (`getMiniAppToken`, `closeMiniApp`,
`getAppInfo`, `getNetworkInfo`, `getWifiInfo`, `measureWifiSpeed`, `readWifiRssi`, `onNetworkChange`,
`openDeeplink`, `openPayment`, `saveImage`, `shareImage`, `copyText`, `supports`). Flutter handler names are
placeholders in `src/shared/super-app/adapters/flutter-handler-names.ts` until the super-app team confirms
them (S-01…S-10). Only the legacy `miniapp.getSession` handler remains, for the host locale. See [Super-app integration](docs/super-app-integration.md).

## Documentation

- [System architecture](docs/system-architecture.md)
- [Code standards](docs/code-standards.md)
- [Super-app integration](docs/super-app-integration.md)
- [Development roadmap](docs/development-roadmap.md)
- [Project changelog](docs/project-changelog.md)

Implementation plans live under `plans/` (current: `plans/261008-0026-internet-redesign-xd-figma/`).
