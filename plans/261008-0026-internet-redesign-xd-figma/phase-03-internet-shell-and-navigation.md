---
phase: 3
title: 'Khung màn Internet, điều hướng, hợp đồng, chưa có dịch vụ'
status: completed
priority: P1
effort: 6h
dependencies: [1]
---

# Phase 03 — Khung màn Internet, điều hướng, hợp đồng, chưa có dịch vụ

## Context Links
- [design-sources §1, §5](./research/design-sources.md) · `assets/xd/s01.png` (no service), `s02.png` / `s09.png` (card hợp đồng mở và thu gọn)
- Code: `src/app/router/app-router.tsx`, `src/app/layout/{app-shell,internet-subscription-gate}.tsx`, `src/shared/config/routes.ts`, `src/pages/modem/ui/internet-management-tabs.tsx`, `src/pages/no-internet-service/*`

## Goal
Thay bottom nav và 8 route rời bằng IA của XD:

```
Internet (header, X đóng)
 └─ card "Thông tin hợp đồng" (accordion)
 └─ SegmentedTabs: Wifi | Thiết bị kết nối | Modem | Chất lượng
```

Đồng thời làm lại màn "chưa có dịch vụ".

## Requirements
- Route mới trong `routes.ts`:

```
/                      → redirect /wifi
/wifi                  tab Wifi           (InternetLayout)
/devices               tab Thiết bị kết nối
/modem                 tab Modem
/quality               tab Chất lượng
/wifi/:networkId/edit  Đổi tên/mật khẩu       (SubPageLayout: back + title)
/wifi/:networkId/share Chia sẻ Wi-Fi (QR)
/wifi/schedules        Lịch bật/tắt Wi-Fi
/devices/:clientId     Chi tiết thiết bị
/devices/:clientId/edit Đổi tên/Icon thiết bị
```

- Redirect các route cũ: `/clients*` → `/devices*`, `/health` → `/wifi`, `/diagnostics` → `/quality`, `/mesh` → `/modem`. Mục đích là không gãy deep link mà host có thể đã lưu.
- **AppShell:**
  - Bỏ bottom nav và `useHideBottomNav`.
  - Header 64px.
  - Ở tab gốc: tiêu đề "Internet" + `IconButton` X → `superApp.close()`.
  - Ở màn con: nút back + tiêu đề lấy từ `handle.titleKey`.
- **InternetLayout:**
  - `SubscriptionCard`: accordion, mặc định thu gọn khi đã có lịch sử. Hiển thị Mã hợp đồng, Ngày đăng ký, Ngày hết hạn và nút "Thanh toán / Gia hạn ngay" → `openNativeRoute(contractPayment)`.
  - `SegmentedTabs` dạng NavLink, sticky dưới header khi cuộn.
  - `<Outlet/>`.
  - Giữ vị trí cuộn của từng tab khi chuyển tab, dùng `ScrollRestoration` hoặc lưu `scrollY` theo pathname.
- Hook `useSheetParam(name)` để đọc và ghi `?sheet=` (mở bằng push; đóng bằng `navigate(-1)` nếu sheet được mở trong app, ngược lại thì replace). Hook này dùng chung cho Phase 4–8.
- **NoInternetServicePage:** carousel 5 slide (scroll-snap, chấm phân trang là `button` có `aria-label`), hero placeholder, tiêu đề và mô tả theo XD, CTA "Đăng ký ngay" → `openNativeRoute(internetServiceShop)`, nút X đóng app. Nội dung slide 2–5 chờ Q19, tạm dùng slide 1 + SpecNote.
- Nội dung tab tạm thời (đến khi các phase sau thay):
  - Wifi = `WifiPage` cũ, restyle.
  - Thiết bị = `ClientsPage`.
  - Modem = `ModemPage`, bỏ `InternetManagementTabs` riêng.
  - Chất lượng = `DiagnosticsPage`.

## Implementation Steps
1. Cập nhật `routes.ts` và test encode như cũ.
2. Viết `app/layout/internet-layout.tsx` và `sub-page-layout.tsx`; sửa `app-shell.tsx`.
3. Viết `widgets`-level component `SubscriptionCard` trong `pages/internet/ui/` hoặc tạo layer `widgets/` nếu boundaries cho phép. Vì card dùng chung cho 4 tab, đề xuất bật layer `widgets/` trong `eslint-plugin-boundaries`.
4. Dựng lại router và thêm redirect. Mỗi route vẫn lazy-load.
5. Làm lại NoInternetServicePage.
6. Test:
   - redirect các route cũ;
   - X gọi `close`;
   - back ở màn con;
   - accordion;
   - tab active theo URL;
   - phím mũi tên trên tablist;
   - gate vẫn đúng (3 test cũ).

## Success Criteria
- Mọi route cũ redirect đúng; không còn bottom nav.
- Trên viewport 360px và 430px: header, card và tab không vỡ, không có scroll ngang.
- Tests cũ trong `pages.test.tsx` được cập nhật theo path mới và đều pass.

## Risk Assessment
- Host có thể chặn nút back của Android. Phải test trên WebView thật: back khi đang mở sheet phải đóng sheet, không được thoát miniapp.
- Bật layer `widgets/` nghĩa là sửa config boundaries. Phải làm trong cùng PR, đồng thời cập nhật `docs/code-standards.md`.

## Security Considerations
- Nút thanh toán chỉ mở route native, miniapp không tự xử lý thanh toán.
