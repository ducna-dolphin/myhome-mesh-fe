---
phase: 6
title: 'Đo sóng trên iOS bằng AirPort Utility'
status: completed
priority: P2
effort: 5h
dependencies: [5]
---

# Phase 06 — Đo sóng trên iOS bằng AirPort Utility

## Context Links
- [design-sources §3](./research/design-sources.md) · XD `s29`–`s33`; Figma 26:92 → 26:97 → 26:99 → 26:100 → 26:101, 26:98, 26:104
- Câu hỏi: Q3, Q10, Q11

## Goal
Adapter `manual` của `WifiSignalMeter`. Trên iOS, hoặc trên Android khi không có bridge đo, người dùng đo bằng AirPort Utility (AU) hoặc công cụ tương tự rồi nhập RSSI vào app.

## Requirements
- Sheet đo khi `meter.kind === 'manual'` có 3 biến thể mở đầu:

| Điều kiện | Biến thể | Nội dung |
|---|---|---|
| Người dùng chưa xác nhận có AU (`auStatus !== 'installed'`) | `need-app` | "Cần ứng dụng AirPort Utility", nút "Tải trên App Store" (`openExternalUrl(APP_STORE_AU_URL)`), link "Tôi đã có ứng dụng", 4 bước hướng dẫn |
| Có AU, chưa từng đo trên máy này | `guide-full` | "Hướng dẫn đo sóng trên iPhone", 4 bước, "Mở AirPort Utility" (chỉ hiện nếu `supports('openApp')`), "Tôi đã có kết quả, nhập ngay" |
| Có AU, đã đo trước đó | `guide-short` | 1 dòng hướng dẫn + "Xem hướng dẫn" (mở bản đầy đủ) + 2 nút như trên |

- Sau khi bấm "Tải trên App Store": lắng nghe `onResume`; khi người dùng quay lại thì chuyển sang biến thể "Đo bằng AirPort Utility", kèm nút "Nhập kết quả đo" (Figma 26:97).
- **Bước nhập** (`RssiInput`):
  - TextField `inputMode="numeric"`, prefix "−" cố định, suffix "dBm"; người dùng chỉ nhập phần trị tuyệt đối.
  - Hợp lệ khi giá trị trong khoảng 30…100 (Q11).
  - Nhập đến đâu xem trước "Mức sóng tương ứng: <mức>" + `SignalBars` đến đó (`classifyRssi(-value)`).
  - "Lưu kết quả" disable khi ô trống hoặc giá trị không hợp lệ.
  - Có link "Xem hướng dẫn" và "Mở lại AirPort Utility".
- Lưu với `method: 'manual'`, rồi dùng lại màn kết quả, lịch sử và toast của Phase 5.
- Lưu local, có try/catch, key theo `userId`: `auStatus: 'unknown'|'installed'`, `iosGuideSeen: boolean`. Đây là sở thích trên từng thiết bị, không phải dữ liệu nghiệp vụ.
- SSID trong hướng dẫn lấy theo SSID đang đo: mặc định SSID 5GHz đang bật, nếu không có thì lấy SSID đầu tiên đang bật (Q10).

## Implementation Steps
1. Viết `features/measure-wifi-signal/model/manual-meter.ts` và `use-manual-onboarding.ts` (đọc/ghi local an toàn, theo dõi resume).
2. Viết UI: `ManualIntro` (3 biến thể), `RssiGuideSteps`, `RssiInput`.
3. Gắn vào state machine của Phase 5 với state `awaitingManualInput`.
4. Thêm i18n vào namespace `survey.manual`.
5. Test:
   - chọn đúng biến thể theo trạng thái;
   - resume sau khi mở App Store thì chuyển màn;
   - validate input và xem trước mức sóng;
   - lưu với `method: 'manual'`;
   - nếu `localStorage` throw thì vẫn chạy được.

## Success Criteria
- Đi hết 3 nhánh của Figma ("Chưa có app AU", "Đã có app AU, đo lần đầu", "Đã có app AU, đo từ lần 2") trên mock với `VITE_MOCK_PLATFORM=ios`.
- Bàn phím số tự bật trên iOS; nút ghim đáy không bị bàn phím che (dùng `visualViewport`, hoặc `env(keyboard-inset-height)` nếu có).

## Risk Assessment
- AU không có URL scheme công khai, nên nút "Mở AirPort Utility" có thể không làm được. Thiết kế đã có sẵn đường thay thế là người dùng tự mở app, nên chỉ cần ẩn nút này là đủ.
- Người dùng có thể nhập sai số. Có xem trước mức sóng và giới hạn khoảng hợp lệ. Bản ghi được đánh dấu `manual` để backend phân biệt.

## Security Considerations
- `openExternalUrl` chỉ cho phép `apps.apple.com` (allowlist ở Phase 2).
