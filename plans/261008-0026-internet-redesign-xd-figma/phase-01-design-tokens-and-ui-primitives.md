---
phase: 1
title: 'Design tokens và UI primitives'
status: completed
priority: P1
effort: 10h
dependencies: []
---

# Phase 01 — Design tokens và UI primitives

## Context Links
- [design-sources §4 Tokens](./research/design-sources.md#4-design-tokens-lấy-mẫu-pixel-từ-xd) · ảnh `assets/xd/s02.png`, `s03.png`, `s06.png`, `s21.png`, `s25.png`
- Code hiện tại: `src/app/styles/global.css` (600 dòng, 13 biến), `src/shared/ui/*`, `src/shared/ui/line-icons.tsx`

## Goal
Có một design system nhỏ, đúng XD, dùng lại được cho mọi phase sau. Từ phase này trở đi không còn hex hay cỡ chữ hardcode trong CSS của page/feature.

## Key Insights
- Hiện mới có token màu; spacing và typography đang hardcode, có hex rải rác (`#f6f8fb`, `#12b76a`…) và các class chết (`.speed-grid`, `.status-pill--good`…).
- XD không có bottom nav; header 64px, nút X tròn 36px, segmented tab cao 36px.
- Giá trị token là số đo pixel (±2pt). Đặt tên **theo ngữ nghĩa**, để khi có Design Specs (Q18) chỉ phải sửa giá trị.

## Requirements
- Tạo file `src/app/styles/tokens.css` với các nhóm:
  - **color:** brand, brand-soft, bg, surface, input, track, divider, text, text-2, text-muted, border.
  - **status:** online, warning, danger, và bộ màu signal good/fair/weak gồm `bg`, `border` và `fg`.
  - **typography:** font-family; scale 28/20/18/16/14/12/11; weight 400/500/600/700; line-height.
  - **space:** 4, 8, 12, 16, 20, 24, 32.
  - **radius:** sm 8, md 12, lg 16, xl 20, pill.
  - **shadow:** card, popover, sheet.
  - **z-index, motion:** duration 150/250ms, easing.
- Font Be Vietnam Pro, self-host qua `@fontsource/be-vietnam-pro` với các weight 400, 500, 600, 700, subset latin + vietnamese.
- Thêm `lucide-react` và bọc trong `shared/ui/icon.tsx`: size mặc định 20, stroke 1.5, `aria-hidden` mặc định. Xoá `line-icons.tsx` sau khi đã thay hết chỗ dùng (việc thay xong ở Phase 9).
- Primitive trong `src/shared/ui/`, mỗi primitive gồm 1 file `.tsx`, 1 file `.css` cùng tên và 1 file test cho phần có logic:

| Component | Ghi chú |
|---|---|
| `Button` | variant primary / secondary(outline) / ghost / danger, size md 48 / sm 32; `loading`, `fullWidth`; trạng thái disabled theo XD |
| `IconButton` | tròn 36, bắt buộc có `aria-label` |
| `BottomSheet` | `<dialog>` + `showModal()`, grabber, title, close; đóng khi bấm scrim hoặc Esc; xử lý safe-area-bottom; tự khoá scroll của body |
| `Dialog` | alert/confirm kiểu XD: tiêu đề, mô tả, 2 nút (`destructive` cho nút xoá) |
| `ToastProvider` + `useToast()` | toast teal full-width, `role="status"`, tự ẩn sau 3s; dùng toast native nếu host hỗ trợ (Phase 2) |
| `Switch` | `role="switch"`, `aria-checked`, có trạng thái disabled và pending |
| `SegmentedTabs` | `role="tablist"`, phím mũi tên trái/phải; nhận `items[{to,label}]` để render NavLink |
| `Chip` / `FilterChip` | chip lọc có thể kèm badge số đếm; `aria-pressed` |
| `TextField` | label viết hoa, helper, error, counter `n/max`, prefix/suffix (`−`, `dBm`), nút hiện mật khẩu |
| `ListRow` | icon tròn có nền, title, subtitle, trailing (chevron, switch hoặc tuỳ chọn), cả row bấm được |
| `Accordion` | dùng cho card hợp đồng; `aria-expanded` |
| `TimeWheel` | 2 cột giờ và phút; fallback `<input type="time">` khi `prefers-reduced-motion` hoặc bật screen reader |
| `SignalBars` | 3 vạch, màu theo level |
| `Badge` | ONT / số đếm / đỏ |

- Viết lại `Card`, `StatusPill` và `ScreenState` dùng token mới, giữ API cũ để không vỡ page hiện tại.
- Thay `global.css`: chỉ giữ reset, layout của shell và import `tokens.css`; xoá class chết.

## Architecture
```
src/app/styles/{tokens.css, global.css}
src/shared/ui/
  button/, icon-button/, bottom-sheet/, dialog/, toast/, switch/, segmented-tabs/,
  chip/, text-field/, list-row/, accordion/, time-wheel/, signal-bars/, badge/, icon.tsx
  index.ts   # public API, giữ boundaries hiện có
```
Đặt tên file kebab-case theo rule `check-file` hiện có. Nếu boundaries cấm import sâu thì mọi export đi qua `index.ts`.

## Implementation Steps
1. Cài `lucide-react`, `@fontsource/be-vietnam-pro`. Import font trong `main.tsx`.
2. Viết `tokens.css`; map biến cũ sang biến mới (`--brand: var(--color-brand)`) để chuyển dần.
3. Viết các primitive theo thứ tự Button → IconButton → Switch → TextField → ListRow → Chip → SegmentedTabs → Dialog → BottomSheet → Toast → Accordion → TimeWheel → SignalBars → Badge.
4. Viết test cho phần có hành vi:
   - BottomSheet / Dialog: mở, đóng bằng Esc, focus quay về trigger.
   - Switch: toggle, aria.
   - TextField: counter, hiện mật khẩu.
   - SegmentedTabs: phím mũi tên.
   - Toast: tự ẩn, khi test dùng fake timers.
5. Thêm script `lint:tokens` (grep hex ngoài `tokens.css` trong `src/**/*.css`) và chạy nó trong CI.
6. Restyle shell hiện tại theo token để giao diện không vỡ; IA mới làm ở Phase 3.

## Todo
- [ ] tokens.css + font
- [ ] icon wrapper
- [ ] 14 primitive + test
- [ ] dọn global.css, xoá class chết
- [ ] `lint:tokens` trong CI

## Success Criteria
- `npm run typecheck && npm run lint && npm test && npm run build` xanh.
- `npm run lint:tokens` = 0 vi phạm.
- Bundle gzip tăng ≤ 25KB, tính cả font subset.
- Phím Tab đi qua được mọi primitive. Vòng focus hiện rõ với `outline: 2px var(--color-brand)`.

## Risk Assessment
- `<dialog>` trên WebView Android cũ (Chrome < 98) có thể thiếu hỗ trợ. Kiểm tra `HTMLDialogElement`; nếu thiếu thì fallback về `div[role=dialog]` + focus trap tự viết, được bọc ngay trong primitive.
- Wheel picker khó dùng với a11y, nên có fallback như mô tả ở trên.
- Thiếu token chính xác (Q18): sau này chỉ cần sửa giá trị trong `tokens.css`.

## Security Considerations
- Không có; chỉ là UI thuần.
