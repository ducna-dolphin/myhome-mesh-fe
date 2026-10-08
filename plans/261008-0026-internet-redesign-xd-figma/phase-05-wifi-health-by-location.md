---
phase: 5
title: 'Sức khoẻ Wi-Fi theo vị trí (luồng chung + Android)'
status: completed
priority: P1
effort: 12h
dependencies: [1, 2, 3]
---

# Phase 05 — Sức khoẻ Wi-Fi theo vị trí

## Context Links
- [design-sources §2 Wifi](./research/design-sources.md) · XD `s02`, `s10`–`s20`; Figma 26:40 → 26:41 → 26:42/48, 26:80 → 26:50 → 26:51 → 26:49, Android 26:81 → 26:52, nhân viên kỹ thuật 26:43 → 26:47 → 26:73/82/84
- Câu hỏi: Q2, Q9, Q10, Q11, Q12
- Code sẽ thay: `src/pages/health/*`, `src/entities/health-area/*`

## Goal
Khối "Sức khoẻ Wi-fi theo khu vực" ở đầu tab Wifi gồm: tạo, đặt tên, đo, xem lịch sử, đổi tên, xoá vị trí; gợi ý lắp Mesh khi có phòng yếu. Phase này làm luồng đo tự động (Android, qua bridge). iOS dùng cùng khung, chỉ khác bước đo (Phase 6).

## Requirements

### Trạng thái màn
| State | Hiển thị |
|---|---|
| Chưa có vị trí | Card "Tự kiểm tra sóng từng vị trí" + "CẦN CÓ ĐỦ 4 ĐIỀU KIỆN" (4 dòng check) + nút "Tự đo" |
| Có vị trí | Tiêu đề + counter `n/20 vị trí`; lưới 3 cột `LocationTile`; ô "+ Thêm vị trí" (ẩn khi n = 20, thay bằng caption giới hạn) |
| Có ≥ 1 phòng Yếu | Alert đỏ "<phòng yếu nhất> đang có sóng yếu…" + banner teal "Đặt lắp thêm Mesh" → `openNativeRoute(meshOrder)` |
| Loading / error | Skeleton tile / `ErrorState compact` có retry; lỗi ở khối này không làm hỏng danh sách Wi-Fi bên dưới |

- **Sắp xếp:** Yếu → Trung bình → Khoẻ → Chưa đo. Cùng mức thì xếp theo `measuredAt` mới nhất. Viết thành hàm thuần `sortLocations`.
- **`LocationTile`:** tên (tối đa 2 dòng, ellipsis), `SignalBars`, nhãn mức, "Đo ngày dd/mm/yy" hoặc nút nhỏ "Đo ngay" khi chưa đo; nền và viền theo token signal; menu ⋮ (`IconButton`).
- Không hiển thị khối tổng hợp "4 khoẻ 2 TB 1 Yếu" (comment PO).

### Luồng
1. **Tạo:** "Tự đo" hoặc "+ Thêm vị trí" → sheet "Đặt tên vị trí đo".
   - TextField (counter 30), chip gợi ý (bấm để điền), validate: không rỗng, ≤ 30 ký tự, không trùng (so sánh không phân biệt hoa thường, sau trim).
   - "Lưu & đo ngay" → tạo xong đi thẳng tới bước đo (Figma 26:81: không hỏi xác nhận vị trí).
   - "Lưu, đo sau" → toast "Đã lưu <tên>. Bạn có thể đo bất cứ lúc nào".
2. **Đo từ tile ("Đo ngay"):** Dialog "Bạn đang ở <tên>?" → "Đúng rồi, đo tiếp" sang bước đo; "Đổi vị trí khác" đóng dialog.
3. **Đo (sheet `measure`):**
   - Tiêu đề là tên vị trí, kèm nút ✎ và 🗑.
   - Icon wifi có spinner, "Đang đo sóng Wi-fi...", "Đứng giữa phòng, giữ máy trong khoảng 8 giây", progress xác định theo `durationMs`; nút "Đo lại" bị disable.
   - Gọi `WifiSignalMeter.measure()`, rồi POST measurement.
   - Xong thì hiện kết quả "Chất lượng Wi-fi: <mức>", thời điểm, `SignalBars`, "Đo lại"; đồng thời toast "Đã lưu kết quả <tên>: <mức>…".
   - Phần "Lịch sử đo · 5 lần gần nhất" ở cuối sheet.
   - Đóng sheet khi đang đo thì `AbortController` huỷ, không lưu.
4. **Menu ⋮:**
   - Đổi tên vị trí → Dialog có input; lịch sử được giữ nguyên.
   - Đo lại và xem lịch sử → sheet `measure` ở chế độ xem: hiện kết quả mới nhất và lịch sử, có nút "Đo lại".
   - Xoá vị trí → Dialog destructive "Toàn bộ lịch sử đo… không thể khôi phục".
5. **Lỗi đo:**
   - không ở Wi-Fi nhà, hết thời gian, bị từ chối quyền → state lỗi trong sheet, kèm hướng dẫn và nút "Thử lại";
   - Android không hỗ trợ bridge → chuyển sang luồng nhập tay của Phase 6.

### Kiến trúc đo
```
entities/wifi-survey/lib/classify-rssi.ts      // rssi → 'good'|'fair'|'weak', ngưỡng từ config (Q10)
features/measure-wifi-signal/
  model/wifi-signal-meter.ts                    // interface { kind: 'auto'|'manual'; measure?(signal): Promise<Reading> }
  model/use-wifi-signal-meter.ts                // chọn adapter theo platform + supports('measureWifiSignal')
  model/use-measure-location.ts                 // state machine: idle → confirming → measuring → saving → result | error
  ui/measure-sheet.tsx, location-history.tsx
features/manage-survey-location/                // create / rename / delete (sheet + dialog)
widgets/wifi-health-section/                    // grid, empty, alert + banner Mesh
```
- State machine viết bằng `useReducer` với các action rõ ràng, test riêng từng chuyển trạng thái.
- Mutation:
  - create / rename / delete → `setQueryData` danh sách (rename và delete dùng optimistic);
  - lưu measurement → cập nhật `latest` của vị trí và invalidate query lịch sử của vị trí đó.

## Implementation Steps
1. Viết `classifyRssi`, `sortLocations`, `pickWeakest` kèm unit test, bao gồm các giá trị biên −60 và −70.
2. Viết `LocationTile`, `wifi-health-section` và empty state.
3. Viết sheet tạo vị trí và các dialog đổi tên / xoá.
4. Viết state machine đo, adapter `auto` và sheet đo cùng lịch sử.
5. Gắn vào tab Wifi, đặt phía trên danh sách Wi-Fi của Phase 4. Hai phần là 2 widget độc lập; chỉ file `pages/wifi/ui/wifi-tab.tsx` import cả hai, nên chỉ có 1 điểm có thể conflict.
6. Thêm i18n vào namespace `survey`.
7. Test:
   - 3 trạng thái màn;
   - sắp xếp;
   - giới hạn 20;
   - tên trùng;
   - luồng đo đầy đủ trên mock;
   - huỷ giữa chừng;
   - lỗi đo;
   - xoá có xác nhận;
   - alert và banner chỉ hiện khi có phòng Yếu.

## Success Criteria
- Đi hết luồng Figma "chưa đo lần nào", "đo sau", "đo ngay Android" và "nhân viên kỹ thuật đo" trên mock, với `VITE_MOCK_SURVEY=empty|partial|full`.
- Lưới 3 cột không vỡ ở 360px; tên dài cắt ở 2 dòng.
- Thông báo kết quả qua `aria-live`; dialog và sheet trả focus về đúng tile.

## Risk Assessment
- **Q2 là rủi ro lớn nhất:** nếu host không đo được RSSI thì Android cũng phải dùng luồng nhập tay, mà Android không có AirPort Utility. Cần PO chọn phương án thay thế: ví dụ ước lượng từ modem bằng RSSI của client từ phía AP (`client.signalDbm` đã có trong schema). Nêu phương án này trong buổi review.
- Đo 1 lần, khoảng 8s, có thể nhiễu. Ghi nhận theo kết quả bridge trả về (trung bình nhiều mẫu nằm ở phía native).

## Security Considerations
- Tên vị trí là input của người dùng. React đã escape khi render; khi gửi lên server thì trim và giới hạn độ dài.
