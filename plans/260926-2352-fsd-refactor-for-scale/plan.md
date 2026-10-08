---
title: 'Refactor frontend theo FSD để scale & maintain'
description: 'Tái cấu trúc miniapp-wifi-mesh theo Feature-Sliced Design, khoá 4 seam (super-app, session, http, routes), thêm lint/test/docs/CI. UI & hành vi giữ nguyên.'
status: completed
priority: P0
effort: 30h
branch: refactor/fsd-phases-6-7-i18n-tests-ci
tags: [frontend, refactor, architecture, tooling]
created: 2026-09-26
---

# Refactor frontend theo FSD

## Mục tiêu

- Cấu trúc code có luật, **lint tự chặn** khi vi phạm (layer, deep import, tên file, gọi bridge thô).
- Chưa có Super App SDK / chuẩn bundle → mọi thứ phụ thuộc super app đi qua **1 interface + adapter**. Khi có SDK thật chỉ cần thêm adapter.
- **UI và hành vi giữ nguyên.** Mỗi phase = 1 commit, build + test xanh trước khi sang phase sau.

Bối cảnh: [audit report](../reports/reviewer-260926-2319-frontend-audit.md)

## Cấu trúc đích

```
src/
├── app/        providers/, router/, layout/app-shell.tsx, styles/
├── pages/      overview/, wifi/, mesh/, clients/, client-detail/, health/, diagnostics/
├── features/   update-wifi-ssid/, run-speed-test/
├── entities/   network/, wifi/, mesh-topology/, client/, health-area/
└── shared/     super-app/, session/, api/, config/, i18n/, lib/, ui/, test/
```

Chiều import: `app → pages → features → entities → shared`. Cross-slice import cùng layer bị chặn; `pages`, `features`, `entities` chỉ public qua `index.ts`.

## Phases

| #   | Phase                                              | Status | Effort | Link                                                        |
| --- | -------------------------------------------------- | ------ | ------ | ----------------------------------------------------------- |
| 1   | Tooling: ESLint, Prettier, alias, vitest, husky    | Done   | 4h     | [phase-01](./phase-01-tooling-and-lint-foundation.md)       |
| 2   | Seam super-app + session                           | Done   | 4h     | [phase-02](./phase-02-super-app-and-session-seam.md)        |
| 3   | Seam http-client, ApiError, mock adapter           | Done   | 4h     | [phase-03](./phase-03-http-client-and-mock-adapter.md)      |
| 4   | Entities: Zod schema, api, query hooks             | Done   | 4h     | [phase-04](./phase-04-entities-schemas-and-queries.md)      |
| 5   | Pages/features, routes, kebab-case, bật boundaries | Done   | 6h     | [phase-05](./phase-05-pages-features-routes-restructure.md) |
| 6   | i18n scaffold                                      | Done   | 3h     | [phase-06](./phase-06-i18n-scaffold.md)                     |
| 7   | Tests, docs/, GitHub Actions                       | Done   | 5h     | [phase-07](./phase-07-tests-docs-ci.md)                     |

Phụ thuộc: tuần tự 1 → 7. Phase 5 phụ thuộc 2-4 (import các seam mới).

## Quyết định mặc định (đổi được trước khi code)

| Chủ đề     | Chọn                                                    | Không chọn / lý do                                                                           |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Kiến trúc  | FSD, **không** có layer `widgets`                       | YAGNI: app nhỏ, thêm khi cần                                                                 |
| Mock       | Adapter trong code (`VITE_API_MODE=mock`)               | MSW: service worker không chắc chạy trong WebView/file://                                    |
| Session    | `shared/session` (context + hooks)                      | `entities/session`: entity khác không import chéo được → page phải truyền networkId khắp nơi |
| i18n       | `i18next` + `react-i18next`, resource bundle sẵn        | Tự viết dictionary: phải tự làm plural/interpolation sau                                     |
| Lint layer | `eslint-plugin-boundaries` + `eslint-plugin-check-file` | Steiger: tốt nhưng thêm 1 tool riêng                                                         |
| Pre-commit | husky + lint-staged                                     | —                                                                                            |

## Ngoài phạm vi (ghi vào roadmap)

- Sửa bug `WifiPage` đổi SSID cho cả 2 band cùng lúc → đổi riêng từng band (thay đổi hành vi).
- Chốt lại IA bottom nav (3 tab vs 7 route).
- Icon thật thay chữ "Wi/M/D/H", dark mode, theme từ super app.
- Adapter SDK VNPT thật, chuẩn đóng gói bundle.

## Câu hỏi mở

- Session từ super app có trả `networkId`/household không, hay miniapp tự gọi BE lấy danh sách mạng?
- Có cần tiếng Anh ngay không (hiện chỉ scaffold `vi`)?
- Repo sẽ host trên GitHub (Actions) hay GitLab của VNPT?
