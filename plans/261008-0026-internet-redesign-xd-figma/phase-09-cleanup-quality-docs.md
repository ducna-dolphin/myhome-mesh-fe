---
phase: 9
title: 'Dọn code cũ, a11y, hiệu năng, test, docs'
status: completed
priority: P2
effort: 6h
dependencies: [4, 5, 6, 7, 8]
---

# Phase 09 — Dọn code cũ, a11y, hiệu năng, test, docs

## Context Links
- `plans/reports/reviewer-260926-2319-frontend-audit.md`, `docs/development-roadmap.md`, `docs/system-architecture.md`, `docs/super-app-integration.md`, `docs/code-standards.md`

## Goal
Không còn code chết, docs khớp với code, chất lượng được đo bằng số liệu.

## Requirements

### Dọn
- Xoá pages: `overview`, `mesh`, `health`, `clients`, `client-detail`, `diagnostics` cùng test cũ (route đã được redirect).
- Xoá entity `health-area` và `mesh-topology`. PO chốt là không gắn vị trí đo với mesh. Kiểm tra lại xem tab Modem có cần danh sách node mesh không; nếu chưa cần thì xoá.
- Xoá entity `network` nếu không còn ai dùng; kiểm tra bằng `codegraph_callers` hoặc grep.
- Xoá feature `update-wifi-ssid`, `run-speed-test`; xoá `line-icons.tsx`; xoá namespace i18n `network`.
- Xoá route paths và `routeTitleKeys` không còn dùng.
- Rà lại `pending-spec-notes.ts`: gỡ các mục đã chốt, thêm mục mới cho Q6–Q17.

### A11y (WCAG 2.1 AA)
- Touch target ≥ 44×44.
- Contrast ≥ 4.5:1. Cần kiểm tra lại `#8A9AAF` trên nền trắng (khoảng 2.9:1). Chỉ dùng màu này cho trạng thái disabled và icon, không dùng cho chữ thông tin; nếu cần thì thêm token `text-muted-strong`.
- Mọi sheet và dialog có tiêu đề gắn qua `aria-labelledby`.
- Toast và kết quả đo đi qua live region.
- Tôn trọng `prefers-reduced-motion` (spinner, progress, chuyển tab).

### Hiệu năng
- Mỗi route lazy-load; `qrcode` chỉ import động trong trang share.
- Thêm budget vào CI: JS entry ≤ 120KB gzip, mỗi chunk route ≤ 40KB gzip, dùng `vite build --mode` + script `size-limit` hoặc tự viết.
- Query: `staleTime` hợp lý theo domain; polling tạm dừng khi tab ẩn; không refetch thừa khi chuyển tab (`placeholderData: keepPreviousData` khi đổi filter).

### Test và CI
- Coverage giữ ngưỡng hiện tại (60% toàn bộ; 70% cho `shared/**` và `entities/**`), thêm 70% cho `features/**`.
- Smoke test router: render từng route và từng redirect.
- CI: `typecheck`, `lint`, `lint:tokens`, `test:coverage`, `build`, `size`.

### Docs
- `system-architecture.md`: IA mới, contract list, sơ đồ layer có `widgets/`.
- `super-app-integration.md`: bridge mới và các câu hỏi mở.
- `development-roadmap.md`: đánh dấu xong các mục "Navigation", "Design fidelity", "Mock consistency"; thêm backlog còn lại.
- `project-changelog.md`.
- `README.md`: danh sách env `VITE_MOCK_*`.

## Implementation Steps
1. Xoá code theo danh sách; chạy `npm run lint` (boundaries, unused) và `tsc`.
2. Audit a11y bằng axe trên mock: thêm `vitest-axe` hoặc chạy `@axe-core/playwright` nếu repo đã có e2e. Sửa các vi phạm.
3. Đo bundle và thêm budget.
4. Cập nhật docs.
5. Chạy QA thủ công trên viewport 360 / 390 / 430 ở các chế độ `VITE_MOCK_*`, đối chiếu ảnh `assets/xd/*`.

## Success Criteria
- CI xanh.
- Không còn import vào các thư mục đã xoá.
- axe = 0 lỗi nghiêm trọng (serious/critical).
- Bundle trong budget.
- Docs không còn câu "seven screens" hay bottom nav.

## Risk Assessment
- Xoá entity mà host vẫn deep-link tới. Redirect ở Phase 3 đã che phần route; còn lại chỉ xoá code nội bộ.
