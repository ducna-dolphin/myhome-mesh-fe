---
phase: 4
title: 'Tab Wifi: danh sách và cài đặt Wi-Fi'
status: completed
priority: P1
effort: 12h
dependencies: [1, 2, 3]
---

# Phase 04 — Tab Wifi: danh sách và cài đặt Wi-Fi

## Context Links
- [design-sources §2 Wifi](./research/design-sources.md) · XD `s21`–`s26` (Edit Wifi 1–6), phần "Danh sách Wi-fi" trong `s02`; Figma 26:28, 26:9, 26:10, 26:16/17/20/18
- Code: `src/pages/wifi/*`, `src/features/update-wifi-ssid/*` (hiện áp 1 SSID cho cả 2 băng tần, PATCH toàn bộ config), `src/entities/wifi/*`
- Câu hỏi: Q6, Q7, Q8

## Goal
Phần "Danh sách Wi-fi" của tab Wifi và các luồng: sheet tuỳ chọn, bật/tắt, đổi tên/mật khẩu, sao chép mật khẩu, chia sẻ QR, lịch bật/tắt tự động.

## Requirements
- **`widgets/wifi-network-list`:** tiêu đề "Danh sách Wi-fi (n)". Mỗi SSID là 1 card gồm icon wifi `#0056DD`, SSID, badge băng tần, chấm trạng thái bật/tắt, ô mật khẩu `••••••••` và nút mắt. Bấm mắt thì gọi `getPassword` và hiện mật khẩu trong 30s rồi tự che lại. Bấm card thì mở sheet `?sheet=wifi-options&id=…`.
- **`features/wifi-options-sheet`:** BottomSheet có tiêu đề là SSID, gồm các dòng:
  - Bật / Tắt Wi-Fi (Switch). Khi tắt, mở `Dialog` xác nhận (Q8): "Thiết bị đang dùng Wi-Fi này sẽ mất kết nối". Mutation optimistic, rollback và toast khi lỗi.
  - Đổi tên / Mật khẩu → `/wifi/:id/edit`
  - Đặt lịch bật/tắt tự động → `/wifi/schedules`
  - Sao chép mật khẩu → `getPassword` + `copyText` + toast "Đã sao chép mật khẩu"
  - Chia sẻ Wi-Fi (QR) → `/wifi/:id/share`
- **`features/update-wifi-network`** (thay `update-wifi-ssid`):
  - Form trên trang riêng, gồm SSID (1–32 ký tự, không có ký tự điều khiển) và mật khẩu (8–63 ký tự ASCII, có thể để trống nghĩa là không đổi).
  - Validate bằng Zod (`updateWifiNetworkInputSchema`), lỗi hiện inline.
  - Nút ghim đáy "Lưu thay đổi", disable khi chưa có thay đổi hoặc đang gửi.
  - Trước khi lưu, mở dialog cảnh báo "Các thiết bị sẽ cần kết nối lại" (Q7).
  - PATCH **chỉ gửi phần thay đổi** của đúng SSID đó.
  - Thành công: `setQueryData` + toast + quay lại.
- **`features/share-wifi-qr`:**
  - Tạo QR theo chuẩn `WIFI:T:WPA;S:<ssid>;P:<pwd>;;`, escape `\ ; , : "`, dùng `qrcode.toDataURL`, render ở client.
  - Hiển thị SSID và băng tần.
  - "Lưu ảnh QR" → `saveImage`. "Chia sẻ" → `share`; ẩn nút nếu `!supports('share')` và không có `navigator.share`.
  - Mật khẩu chỉ nằm trong bộ nhớ của component.
- **`features/manage-wifi-schedule`:**
  - Màn danh sách: empty state "Chưa có lịch bật/tắt Wi-fi" + "+ Thêm lịch mới". Có lịch thì hiện card (khoảng thời gian, ngày lặp lại) kèm Switch (optimistic) và caption "Lịch áp dụng cho tất cả Wi-Fi của <modem>".
  - BottomSheet "Thêm lịch": TimeWheel giờ bật (panel teal nhạt), TimeWheel giờ tắt (panel cam nhạt), chip ngày T2…CN (ít nhất 1 ngày), "Lưu lịch".
  - Bấm card thì mở sheet sửa, có nút "Xoá lịch" kèm dialog xác nhận. Phần sửa/xoá XD chưa vẽ, nên làm tối thiểu và gắn SpecNote.
  - Lịch qua đêm (giờ tắt < giờ bật) hợp lệ, hiển thị "22:00 – 06:00 (hôm sau)".
  - Hàm thuần `formatRepeatDays([1,3,5])` → "Thứ 2, 4, 6"; `[6,7]` → "Thứ 7, Chủ nhật"; đủ 7 ngày → "Hằng ngày".

## Implementation Steps
1. Viết widget danh sách và hook `useRevealPassword(id)`: `useQuery` với `enabled: false`, `gcTime: 0`, gọi `refetch()` khi bấm.
2. Viết sheet tuỳ chọn và mutation `toggleWifiNetwork` (optimistic `onMutate` / `onError` / `onSettled`).
3. Viết feature cập nhật SSID và mật khẩu; xoá `update-wifi-ssid` cùng test cũ.
4. Viết trang QR và helper `buildWifiQrPayload` (unit test escape).
5. Viết feature lịch bật/tắt, `formatRepeatDays` và schema validate (ít nhất 1 ngày, giờ bật khác giờ tắt).
6. Thêm i18n vào namespace `wifi`.
7. Test:
   - sheet mở/đóng qua `?sheet`;
   - toggle optimistic và rollback;
   - form validate, chỉ gửi diff, chặn khi chưa thay đổi;
   - QR payload;
   - copy gọi `copyText` và hiện toast;
   - lịch: tạo, bật/tắt, empty state, format ngày.

## Success Criteria
- Đi hết luồng Figma 26:28 → 26:9 / 26:10 / 26:16 → 17 → 20 → 18 trên mock.
- Mật khẩu không xuất hiện trong query cache sau khi đóng sheet, kiểm tra bằng test với `queryClient.getQueryCache()`.
- Không có PATCH nào gửi toàn bộ config.

## Risk Assessment
- Backend có thể không trả mật khẩu dạng plain (Q6). Khi đó ẩn nút mắt, copy và QR bằng capability flag `hasPassword` / `canRevealPassword`.
- Tắt chính Wi-Fi đang dùng có thể làm mất kết nối tới miniapp. Dialog xác nhận phải cảnh báo rõ; request đã gửi thì vẫn coi là thành công kể cả khi kết nối bị ngắt (timeout → hiện "Đã gửi yêu cầu").

## Security Considerations
- Mật khẩu: không log, không đưa vào URL hay search param, không lưu `localStorage`; ẩn lại sau 30s.
- Ảnh QR chứa mật khẩu; trước khi lưu hoặc chia sẻ phải cảnh báo bằng dòng chú thích.
