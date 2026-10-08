# Code standards

## Goals

The frontend should remain easy to extend without allowing page code, integration details or backend response shapes to spread across the repository.

## Naming

- Files and folders under `src/` use kebab-case.
- React components use PascalCase identifiers inside kebab-case files.
- Hooks start with `use`.
- Query-key factories belong to the owning entity.
- Route literals belong only in `shared/config/routes.ts`.

Examples:

```text
wifi-tab-page.tsx
use-reboot-ont.ts
measurement-location/
render-with-providers.tsx
```

## Layer rules

Allowed dependency direction:

```text
app → pages → widgets → features → entities → shared
```

A layer may also import any lower layer:

| From       | May import                                                   |
| ---------- | ------------------------------------------------------------ |
| `app`      | `pages`, `widgets`, `features`, `entities`, `shared`         |
| `pages`    | same page slice, `widgets`, `features`, `entities`, `shared` |
| `widgets`  | same widget slice, `features`, `entities`, `shared`          |
| `features` | same feature slice, `entities`, `shared`                     |
| `entities` | same entity slice, `shared`                                  |
| `shared`   | `shared`                                                     |

Not allowed:

- `shared → entities`
- `entities → features`
- `features → widgets` / `widgets → pages`
- one entity slice importing another entity slice,
- one feature slice importing another feature slice,
- one widget slice importing another widget slice,
- one page slice importing another page slice.

These rules are enforced by `eslint-plugin-boundaries`.

## Public APIs

Other slices import through the target slice's `index.ts`.

Good:

```ts
import { useWifiNetworksQuery } from '@/entities/wifi-network';
import { UpdateWifiNetworkForm } from '@/features/update-wifi-network';
```

Bad:

```ts
import { wifiNetworkApi } from '@/entities/wifi-network/api/wifi-network-api';
import { UpdateWifiNetworkForm } from '../../features/update-wifi-network/ui/update-wifi-network-form';
```

Relative imports inside the same slice are allowed. The same rule applies to `@/widgets/<slice>`.

### `mock.ts` entry (entities)

Each entity has a second public entry, `entities/<slice>/mock.ts`, exporting its MSW handlers,
fixtures and mock-DB helpers. Only `src/app/mocks/**`, tests and `shared/test` may import it
(`@/entities/<slice>/mock`); runtime code importing it is a lint error, so MSW never reaches the
remote bundle (`npm run size` also checks this). `index.ts` must not re-export anything from `mock.ts`.

## Pages

A page is route-level composition. It may:

- call entity query hooks,
- compose features,
- render shared UI,
- read route parameters.

A page should not:

- call `fetch`,
- know ONE Link command names,
- implement reusable mutation logic,
- create raw query keys.

## Widgets

A widget is a composite UI block reused by several pages or layouts (e.g. `widgets/contract-card`,
`widgets/contract-scope`). It may compose features and entities, but must not know about routes it
is rendered on. Page-specific blocks stay inside the page slice.

## Routes and layouts

- Route literals and URL builders live in `shared/config/routes.ts` (`paths`, `tabPaths`, `legacyRedirects`).
- The route tree is `app/router/routes.tsx`; every page is lazy-loaded.
- `/` redirects to the last visited tab (`localStorage.lastTab`) or `/wifi`. Pre-redesign URLs
  redirect with `replace`.
- Tabs (`/wifi`, `/devices`, `/modem`, `/quality`) render under `app/layout/internet-layout.tsx`:
  "Internet" header with X (`closeMiniApp`), contract card, sticky pill tabs.
- Detail screens render under `app/layout/sub-page-layout.tsx`: back button + title from the
  route `handle` (`{ titleKey, backTo }`); `usePageTitle()` may override the title.
- Bottom sheets open through `useSheetParam(name)` (`?sheet=<name>`), so Android back closes them.

## Route gates

Cross-cutting access gates belong in `app/layout`, not inside individual pages.

Both Internet layouts gate on `useSelectedContract()` (LLD P1-01/P1-02):

- `loading` → skeleton; `error` → `ErrorState` whose retry asks the host for a new MiniApp token
  (re-runs the contract lookup) and refetches;
- `none` → `NoInternetServicePage`;
- `unselected` (several contracts, none selected) → contract card with the picker only, no tabs;
- `ready` → tabs / sub-page.

Tab and sub-page content that needs the modem wraps itself in `RequireSerialNumber`
(`@/widgets/contract-scope`), which renders "Chưa xác định được modem…" when the contract has no ONT
and otherwise passes a non-null `serialNumber`.

Do not move account-level entitlement checks into a page slice.

## Features

A feature represents a user action.

Examples: `toggle-wifi-network`, `update-wifi-network`, `block-connected-device`, `reboot-ont`,
`run-health-check`, `measure-wifi-signal`.

Feature model hooks own mutation behavior and cache updates. UI components own input state and interaction rendering.

## Writes: idempotency and async commands

- Every write sends an `Idempotency-Key`. Take it from `useIdempotencyKey().forAction(input)` when
  the user confirms, pass it in the mutation variables (`IdempotentVariables`) and reuse it when the
  same action is retried (network error, `401`); call `renew()` after success so the next action gets
  a new key. Never generate a key inside the API function.
- `202` responses return a `Command`; poll it with `useCommandPoller`. Treat `UNKNOWN` (and a network
  loss right after the `202`) as "sent, waiting for the modem", never as an error.
- Optimistic UI only for reversible toggles, with rollback on `FAILED`.

## Browser storage

No `localStorage` / `sessionStorage` / cookies except `lastTab` (`shared/lib/last-tab-storage.ts`,
wrapped in try/catch). The MiniApp token stays in memory. Server state belongs to TanStack Query;
UI state that must survive back navigation goes in the URL (`?sheet=`, `?filter=`).

## Entities

Entity slices contain:

```text
entity/
├── api/
├── model/
├── lib/
└── index.ts
```

Zod schemas are the runtime source of truth for remote data. Export inferred TypeScript types from those schemas rather than duplicating interfaces.

## TanStack Query

- Query keys are created by entity key factories.
- Pages/features consume key factories; do not create ad-hoc arrays.
- Query retries use the shared retry policy.
- Mutations should update or invalidate the smallest useful cache scope.

## Super-app access

Do not access `window.flutter_inappwebview` outside the Flutter adapter.

React code uses:

```ts
const superApp = useSuperApp();
```

The session only carries the host locale (`useSession().locale`). Data scope comes from
`useSelectedContract()` (`contractId`, `serialNumber`), never from the session.

## API access

Do not call `fetch` from pages, features or entities. Entity API adapters call `apiRequest` from `@/shared/api`.

Remote responses must be validated with Zod.

## i18n

User-facing copy belongs in bundled translation resources.

Use:

```ts
const { t } = useTranslation('wifi');
return <h3>{t('list.title', { count })}</h3>;
```

Do not add Vietnamese or English UI copy directly to production TS/TSX unless it is a non-language symbol or protocol/domain value.

Exceptions:

- mock content representing user/device data,
- tests asserting the final visible text,
- internal developer-only error strings.

Namespaces: `common` (shell, states, route titles), `internet`, `wifi`, `survey`, `devices`, `modem`,
`quality`, `errors`. New product modules get their own namespace.

## Error handling

Pages use shared `LoadingState`, `ErrorState` and `EmptyState`.

Partial responses (LLD §11.4): render `StaleNotice` for `meta.stale` ("Cập nhật lúc HH:mm") and
`SectionError` only in the block whose `errors[].target` failed. Dates use `formatDate`
(`dd/MM/yyyy`) and `formatDateTime` (`HH:mm - dd/MM/yyyy`) from `@/shared/lib`; the backend sends UTC.

Transport errors should stay classified as `ApiError`. Do not expose upstream vendor error strings directly to users.

## Testing

Prefer user-observable assertions:

- roles,
- labels,
- visible state,
- cache effect after mutations.

Use `renderWithProviders()` instead of rebuilding Query/Session/i18n providers in every test;
`src/app/test/render-app.tsx` renders the real route tree.

`createFakeSuperAppClient()` returns a `FakeSuperAppClient` whose methods are Vitest mocks typed
against the bridge contract, so `bridge.getAppInfo.mockResolvedValue({ platform: 'IOS', … })` needs no
cast. The API is served by MSW: switch data with `setMockScenario()` + `resetMockDb()` or the entity's
`set…MockOptions()` instead of stubbing entity APIs. Use `installFakeClock()` / `advanceFakeTime()`
for polling and wait (`waitFor`) for React commits instead of asserting right after `act`.

Accessibility: `src/app/test/a11y.test.tsx` runs axe on every tab, sub-page and sheet; add new routes
there. Touch targets are ≥ 44 px (enlarge with a `::before` hit area when the visual is smaller).

## Add a new screen in 5 steps

1. **Add or extend an entity**  
   Define a Zod schema, API adapter, query key and query hook under `entities/<slice>`.

2. **Add user actions as features**  
   If the screen mutates state, put the action in `features/<action>`, not in the page.

3. **Create the page slice**  
   Add `pages/<screen>/ui/<screen>-page.tsx` and export it from `pages/<screen>/index.ts`.

4. **Register the route and copy**  
   Add the path to `shared/config/routes.ts`, a title key to i18n, and a lazy route in `app/router/routes.tsx`.

5. **Add tests and validate**  
   Cover success/error behavior, then run:
   ```bash
   npm run format:check
   npm run lint
   npm run typecheck
   npm test
   npm run test:coverage
   npm run build
   npm run size
   ```

## Review checklist

- [ ] No cross-slice imports at the same FSD layer.
- [ ] No deep imports into pages/widgets/features/entities.
- [ ] No new raw route strings outside route config.
- [ ] No raw Flutter bridge access outside its adapter.
- [ ] No direct `fetch` outside shared HTTP infrastructure.
- [ ] Remote data has a Zod schema.
- [ ] Query keys come from an entity factory.
- [ ] User-facing copy is translated.
- [ ] Loading/error/empty states are considered.
- [ ] Tests cover the changed user behavior.
- [ ] Format, lint, typecheck, tests, coverage and build pass.
