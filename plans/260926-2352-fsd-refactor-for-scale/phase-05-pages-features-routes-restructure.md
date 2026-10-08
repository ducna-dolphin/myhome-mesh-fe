# Phase 05 — Pages/features, routes, kebab-case, bật boundaries

## Context Links

- [plan.md](./plan.md) · [audit §1, §3](../reports/reviewer-260926-2319-frontend-audit.md)
- Code hiện tại: `src/features/*/*Page.tsx`, `src/app/router.tsx`, `src/shared/ui/AppShell.tsx`

## Overview

- Priority: P0 · Status: Done · Effort: 6h
- Chuyển các `*Page.tsx` sang `pages/`, tách hành động user sang `features/`, gom route vào 1 chỗ, đổi toàn bộ tên file sang kebab-case, bật lint layer ở mức `error`.

## Key Insights

- Thư mục `features/` hiện chứa **page**, không phải feature → sai nghĩa FSD.
- Hành động thật hiện có: đổi SSID (WifiPage), đo tốc độ (DiagnosticsPage). Còn lại là page chỉ đọc.
- `AppShell` dùng map `titles` + `startsWith('/clients/')` → thay bằng `handle` của route.
- Path hardcode ở 6 chỗ (`/wifi`, `/clients/${id}`…).
- Dùng `git mv` để giữ lịch sử file.

## Requirements

- Không đổi URL, tiêu đề, giao diện, hành vi (kể cả việc đổi SSID áp cho cả 2 band — ghi TODO ở roadmap).
- Không còn file `.ts/.tsx` PascalCase; không còn string path hardcode ngoài `routes.ts`.
- `npm run lint` 0 warning boundaries/kebab/deep-import → nâng các rule lên `error`.

## Architecture

```
src/shared/config/routes.ts
  export const paths = { overview: '/', wifi: '/wifi', mesh: '/mesh', clients: '/clients',
    clientDetail: (id: string) => `/clients/${encodeURIComponent(id)}`, health: '/health', diagnostics: '/diagnostics' } as const;

src/app/
├── router/app-router.tsx        # createHashRouter, mỗi route có handle: { title }
├── layout/app-shell.tsx         # dùng useMatches() lấy title từ handle
├── providers/app-providers.tsx, query-provider.tsx, session-provider.tsx
└── styles/global.css
src/pages/<name>/
├── ui/<name>-page.tsx
└── index.ts
src/features/
├── update-wifi-ssid/  ui/update-wifi-ssid-form.tsx, model/use-update-wifi-ssid.ts, index.ts
└── run-speed-test/    ui/speed-test-panel.tsx, model/use-run-speed-test.ts,
                       model/speed-test-schema.ts, api/speed-test-api.ts (+ mock), index.ts
src/shared/ui/  card.tsx, screen-state.tsx, error-boundary.tsx, status-pill.tsx, index.ts
```

Lazy load page: `lazy: () => import('@/pages/wifi').then(m => ({ Component: m.WifiPage }))` — giảm bundle ban đầu khi thêm màn M2 (camera, security…). Fallback dùng `LoadingState`.

`use-update-wifi-ssid.ts`: `useMutation` gọi `wifiApi.updateConfig`, `onSuccess` → `setQueryData(wifiKeys.config(id))` + invalidate `networkKeys.overview(id)`. Chỉ invalidate overview để không refetch đè lại Wi-Fi cache trong mock mode.

Tiêu đề route (tạm là string tiếng Việt, phase 6 đổi sang `titleKey`):

```ts
{ path: 'clients/:clientId', lazy: ..., handle: { title: 'Chi tiết thiết bị' } }
```

## Related Code Files

- Move (git mv + rename):
  - `src/features/overview/OverviewPage.tsx` → `src/pages/overview/ui/overview-page.tsx` (tương tự wifi, mesh, clients, client-detail, health, diagnostics)
  - `src/shared/ui/AppShell.tsx` → `src/app/layout/app-shell.tsx`
  - `src/shared/ui/{Card,ScreenState,ErrorBoundary,StatusPill}.tsx` → kebab-case
  - `src/app/router.tsx` → `src/app/router/app-router.tsx`; `providers.tsx` → `providers/app-providers.tsx`
  - `src/shared/styles/global.css` → `src/app/styles/global.css`
  - `tests/overview.test.tsx` → `src/app/test/overview-page.test.tsx` (test composition ở app layer để không tạo import `pages → app`)
- Create: `src/shared/config/routes.ts`, 2 feature slice, `index.ts` cho mỗi page + `shared/ui`
- Modify: `src/main.tsx`, `eslint.config.js` (warn → error), `tsconfig.app.json` (`include` bỏ `tests`)
- Delete: thư mục `tests/`, thư mục `src/features/{overview,wifi,mesh,clients,health,diagnostics}` cũ

## Implementation Steps

1. `routes.ts`; thay mọi path hardcode trong page/AppShell bằng `paths.*`.
2. `git mv` shared/ui sang kebab-case, thêm `shared/ui/index.ts`, sửa import.
3. Tạo `pages/*` bằng `git mv` từng page, thêm `index.ts`. Page chỉ ghép entity hook + feature + shared/ui.
4. Tách `features/update-wifi-ssid` từ WifiPage (form + mutation), giữ nguyên logic hiện tại.
5. Tách `features/run-speed-test` từ DiagnosticsPage (API + schema + mock + panel).
6. Router: route table với `lazy` + `handle.title`; AppShell dùng `useMatches()`; chuyển vào `app/`.
7. Di chuyển test, sửa import.
8. Chạy `npm run lint` → sửa hết warning; nâng boundaries / check-file / no-restricted-imports lên `error`.
9. Kiểm tra thủ công 7 màn trên `npm run dev` (back/close, nav, đổi SSID, đo tốc độ).
10. typecheck/test/build xanh.

## Todo List

- [x] routes.ts + thay path hardcode
- [x] shared/ui kebab-case + index
- [x] 7 page → pages/*
- [x] feature update-wifi-ssid
- [x] feature run-speed-test
- [x] router lazy + handle.title, AppShell vào app/layout
- [x] di chuyển test, xoá tests/
- [x] lint 0 warning, nâng rule lên error
- [x] smoke test 7 màn trên browser

## Validation status

- Static architecture review: passed (no PascalCase source files, no legacy page-in-feature paths, no root `tests/`).
- Route literals are centralized in `shared/config/routes.ts`; client detail IDs are URL-encoded and covered by a test.
- Browser smoke test passed on Chrome for all 7 routes: direct links render, bottom nav highlights correctly, client-detail back returns to clients, SSID update keeps the new value, speed test shows mock results, and the console is clean.
- Final local validation on `d9de729`: `format:check` clean, `lint` 0 error/0 warning, `typecheck` passed, `test` 23/23, `build` passed with per-page chunks.
- Lint policy verified with negative probes, all rejected by `boundaries` alone: feature → other feature, entity → other entity, page → other page (`element-types`); relative and alias deep imports into another slice (`entry-point`).
- `boundaries/entry-point` must use `default: 'disallow'`; with `default: 'allow'` and an allow-only rule list it never reports anything.

## Success Criteria

- `npm run lint` 0 error 0 warning với rule layer/slice và entry-point ở mức `error`.
- `find src -name '*[A-Z]*.ts*'` rỗng.
- 7 route hoạt động như cũ; build tách chunk theo page.

## Risk Assessment

- Rename trên filesystem không phân biệt hoa thường (macOS của dev khác) → dùng `git mv` 2 bước nếu cần (`A.tsx → a.tmp → a.tsx`).
- Lazy route làm test cần `await` → dùng `findBy*`.
- Diff lớn khó review → tách commit nhỏ trong phase: (a) routes + shared/ui, (b) pages, (c) features, (d) router + lint error.

## Security Considerations

- `clientDetail(id)` dùng `encodeURIComponent` tránh path injection từ id lạ.

## Next Steps

- Phase 06 thay string tiếng Việt bằng key i18n.
