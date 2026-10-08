---
phase: 8
title: 'Tab Chất lượng và restyle Modem'
status: completed
priority: P1
effort: 7h
dependencies: [1, 2, 3]
---

# Phase 08 — Tab Chất lượng và restyle Modem

## Context Links
- [design-sources §2 Chất lượng, Modem, §5 comment PO](./research/design-sources.md) · XD `s04`–`s08`; Figma 26:24, 26:25, 26:29
- Code: `src/features/run-speed-test/*` (panel 273 dòng CSS, timer giả, các issue #3/#7 trong `plans/reports/code-reviewer-260927-1234-diagnostics-speedtest.md`), `src/pages/modem/*`, `src/features/restart-modem/*`
- Câu hỏi: Q15, Q16

## Goal
Thay speed test bằng **kiểm tra chất lượng 3 bước** chạy ngay trong tab, theo kịch bản mà PO bổ sung ngày 07/10. Restyle tab Modem theo token mới.

## Requirements

### Chất lượng (`features/run-quality-check`, `pages/quality`)
- Vào tab:
  - Nếu `latest` không có, hoặc `now - latest.checkedAt > 30 phút` → tự chạy 1 lần.
  - Ngược lại → hiện kết quả gần nhất kèm "Đo lần gần nhất HH:mm - dd/mm/yyyy".
  - Hằng số `AUTO_RECHECK_MS` đặt trong config (Q15).
- Có nút "Kiểm tra lại", đặt ở card stepper khi đang idle. XD không vẽ nút này nhưng cần cho trường hợp người dùng muốn đo lại trong vòng 30 phút. Gắn SpecNote.
- **Stepper 3 bước có nhãn:** Đường truyền → Sóng Wi-fi → Thiết bị kết nối; trạng thái từng bước là done / running / pending. Tiêu đề "Đang kiểm tra... / Vui lòng đợi trong giây lát" → "Hoàn tất kiểm tra"; có progress bar.
- **Kết quả:**

| Hạng mục | Trạng thái → hiển thị |
|---|---|
| Đường truyền Internet | `stable` "Ổn định" (teal) · `unstable` "Chập chờn" (cam) + nút "Reset Modem" · `down` "Mất kết nối" (đỏ) + "Vui lòng kiểm tra lại nguồn Modem" |
| Sóng Wi-fi | `pass` "Đạt" · `fail` "Chưa đạt" · `none` "Không có" |
| Thiết bị kết nối | "Số lượng: N" + chevron → `navigate(paths.devices)` |

- **"Reset Modem":** dùng lại `features/restart-modem`, gồm dialog xác nhận và kết quả `accepted` (Q16). Làm lại control đó trên primitive `Dialog`.
- **Tiến trình theo kết quả thật**, không dùng timer giả để chọn bước (đóng issue #3).
  - Nếu backend trả kết quả theo từng bước (stream hoặc polling) thì dùng trực tiếp.
  - Nếu chỉ có 1 kết quả cuối cùng: hiệu ứng tiến trình chỉ để trang trí. Khi lỗi, báo lỗi chung cho cả lần kiểm tra, không gán cho bước nào.
  - Thời gian hiển thị tối thiểu 3s giữ như cũ.
- Lỗi chỉ thông báo 1 lần, qua 1 live region (đóng issue #7).
- Đặt `AbortController` khi rời tab, để không còn request mồ côi.

### Modem (`pages/modem`)
- Giữ logic hiện có: rename, restart, `splitUptime`, các dòng metric optional.
- Restyle theo XD: tiêu đề "Model01" + `Badge` ONT, nút "Khởi động lại" kiểu secondary, các dòng "Thông tin thiết bị" dùng `ListRow`/`DetailRow`, đánh dấu `*` cho metric chưa xác nhận.
- Bổ sung test: modem Mesh có traffic hoặc temperature `null` thì ẩn dòng tương ứng (gap trong báo cáo tester).

## Implementation Steps
1. Viết `quality-check` query/mutation (Phase 2 đã có API) và hook `useQualityCheck`. Hook dùng reducer với các trạng thái idle / running(step) / done / error, cộng logic 30 phút. Bọc `Date.now` qua tham số `now` để test được.
2. Viết UI stepper, các card kết quả và các map `status → {labelKey, tone, icon}` (đặt trong `lib/quality-presentation.ts`).
3. Gắn Reset Modem và điều hướng sang tab thiết bị.
4. Xoá `features/run-speed-test` và `pages/diagnostics` (route cũ đã redirect ở Phase 3).
5. Restyle tab Modem; viết lại `restart-modem` và `rename-modem` trên primitive mới.
6. Thêm i18n vào namespace `quality` và `modem`.
7. Test:
   - auto-run khi quá 30 phút, không chạy khi chưa quá;
   - đủ 3×3 trạng thái kết quả (dùng `VITE_MOCK_QUALITY`);
   - "Reset Modem" chỉ hiện khi `unstable`;
   - bấm "Số lượng" điều hướng sang tab thiết bị;
   - abort khi unmount;
   - thông báo lỗi chỉ 1 lần;
   - các dòng null của modem.

## Success Criteria
- Khớp các màn XD Chatluong 4–7 và Figma 26:24/25.
- Code-review issue #3 và #7 được đóng.
- Không còn code speed test chết.

## Risk Assessment
- Contract chưa có (Q15). Toàn bộ quy đổi dữ liệu nằm trong `api/`, để nếu backend chuyển sang async job thì chỉ cần sửa hook.
- Auto-run mỗi lần vào tab có thể tốn tài nguyên modem. Ngưỡng 30 phút và cache `latest` phía server sẽ hạn chế việc này.

## Security Considerations
- Reset Modem là thao tác phá huỷ, nên bắt buộc có dialog xác nhận. Disable nút trong lúc mutation đang chạy để tránh bấm 2 lần.
