---
title: 'Redesign miniapp "Internet" theo mockup XD + flow Figma'
description: 'Chuyển IA sang 1 màn Internet + 4 tab, áp design token từ XD, bổ sung luồng Wi-Fi (bật/tắt, đổi mật khẩu, QR, lịch), đo sóng theo vị trí (Android tự động, iOS nhập tay RSSI), thiết bị kết nối (chặn/xoá/đổi icon), làm lại tab Chất lượng.'
status: completed
priority: P1
effort: 73h
branch: feat/internet-redesign
tags: [frontend, design-system, ux, feature]
blockedBy: []
created: 2026-10-08
---

# Redesign miniapp "Internet"

## Mục tiêu

- Bám **XD** cho visual, copy và comment mới nhất của PO; bám **Figma** cho các nhánh luồng: [design-sources](./research/design-sources.md).
- Giữ nguyên nền tảng FSD + seam (super-app, session, http, i18n) của [plan FSD](../260926-2352-fsd-refactor-for-scale/plan.md). Mọi thứ phụ thuộc host đều đi qua `SuperAppClient`; mọi API chưa chốt đều chạy **mock trước**, kèm `SpecNote`.
- Mỗi phase = 1 PR nhỏ; `typecheck + lint + test + build` phải xanh trước khi sang phase tiếp.
- Các câu hỏi chưa chốt nằm trong [open-questions](./research/open-questions.md); các giả định mặc định cũng ghi ở đó.

## ⚠️ Cập nhật theo LLD (2026-10-08)

Nguồn chuẩn cho API và nghiệp vụ là `bs-requirement/technical/lld/LLD-tong-hop.docx` cùng `openapi.yaml`. Khi nội dung trong các phase file mâu thuẫn với [lld-gap-analysis §5](./research/lld-gap-analysis.md#5-ảnh-hưởng-tới-plan-fe-đã-phản-ánh-vào-planmd), **lấy theo LLD**.

Các thay đổi chính so với các phase file bên dưới:

| Phase | Thay đổi |
|---|---|
| 2 | **Viết lại, effort 8h → 14h.**<br>• `http-client` theo CF: envelope, `Idempotency-Key`, xin token mới khi gặp 401.<br>• `commandPoller`.<br>• Sinh type từ OpenAPI; mock bằng MSW kèm test kiểm fixture khớp schema.<br>• Bridge theo `MyHomeBridge` của LLD §11.3.<br>• Phạm vi dữ liệu theo `contractId` → `serialNumber`. |
| 3 | Thêm danh sách thả xuống chọn hợp đồng, trạng thái "chưa xác định được modem", nhãn `meta.stale` và khối lỗi theo `errors[]`. |
| 4 | **Bỏ lịch bật/tắt Wi-Fi** (tạm bỏ khỏi M1), effort 12h → 8h. PATCH chạy bất đồng bộ (202 → poll lệnh, `UNKNOWN` không phải lỗi). Lấy mật khẩu qua `reveal-password`. |
| 5 | Bỏ nhánh nhân viên kỹ thuật đo. **Android làm sẵn cả hai cách đo**: SPEED (tốc độ + độ trễ, theo LLD) và RSSI (qua JSBridge). Chọn theo `GET /mesh/v1/signal-thresholds` → `androidMethod`; bridge không hỗ trợ cách đó thì thử cách còn lại, hết thì về nhập tay. Có kiểm tra điều kiện DK-02…06 trước khi đo. Chi tiết: [openapi-review §3](./research/openapi-review-2026-10-08.md). |
| 6 | Ngưỡng iPhone theo QD-04; RSSI hợp lệ trong khoảng −100…−30. |
| 7 | Trạng thái `CONNECTED/BLOCKED` (offline chờ F-01). `blockable`. "Kết nối qua: Wi-Fi/Có dây". Chặn và xoá chạy bất đồng bộ, gửi kèm `selfMac`/`selfIp`. |
| 8 | Kiểm tra chất lượng bất đồng bộ (POST 202 → poll 3s). Đủ 9 trạng thái và 5 action. Mỗi hợp đồng chỉ 1 ONT. Khởi động lại có giới hạn 3 lần trong 30 phút. |

Các lỗ hổng contract F-01…F-07 cần backend bổ sung: [lld-gap-analysis §2](./research/lld-gap-analysis.md#2-lỗ-hổng-contract-fe-cần-đề-nghị-nhóm-backend-bổ-sung-vào-openapiyaml).

## Hiện trạng và đích

| | Hiện tại (HEAD 11ab182) | Đích |
|---|---|---|
| Điều hướng | Bottom nav 3 mục + 8 route rời | Header "Internet" + card hợp đồng + **4 tab pill** (Wifi, Thiết bị kết nối, Modem, Chất lượng); màn con có back; sheet/dialog cho thao tác nhanh |
| Token | 13 biến màu, xanh `#1677ff`, không có token spacing/typography | Bộ token đầy đủ từ XD (teal `#087681`, màu theo mức sóng, typography, radius, shadow) |
| UI kit | Card, StatusPill, ScreenState | + Button, IconButton, BottomSheet, Dialog, Toast, Switch, SegmentedTabs, Chip, TextField, ListRow, Accordion, TimeWheel, icon set |
| Wifi | Sửa 1 SSID cho cả 2 băng tần | Danh sách SSID, sheet tuỳ chọn, bật/tắt, đổi tên/mật khẩu, copy, QR, lịch bật/tắt |
| Sóng theo phòng | Trang `/health` chỉ đọc | Đo theo vị trí: CRUD, đo (Android tự động / iOS nhập tay), lịch sử, gợi ý lắp Mesh |
| Thiết bị | Danh sách + chi tiết chỉ đọc | Lọc kèm số lượng, chặn/bỏ chặn, xoá, đổi tên + icon |
| Chất lượng | Speed test (download/upload/latency) | Kiểm tra 3 bước (Đường truyền / Sóng Wi-fi / Thiết bị), auto-run khi đã quá 30 phút, Reset Modem |

## Phases

| # | Phase | Effort | Phụ thuộc | Status |
|---|---|---|---|---|
| 1 | [Design tokens và UI primitives](./phase-01-design-tokens-and-ui-primitives.md) | 10h | – | Completed |
| 2 | [Bridge host và data contracts](./phase-02-bridge-and-data-contracts.md) | 8h | – | Completed |
| 3 | [Khung màn Internet, điều hướng, hợp đồng, chưa có dịch vụ](./phase-03-internet-shell-and-navigation.md) | 6h | 1 | Completed |
| 4 | [Tab Wifi: danh sách và cài đặt Wi-Fi](./phase-04-wifi-settings.md) | 12h | 1, 2, 3 | Completed |
| 5 | [Sức khoẻ Wi-Fi theo vị trí (luồng chung + Android)](./phase-05-wifi-health-by-location.md) | 12h | 1, 2, 3 | Completed |
| 6 | [Đo sóng trên iOS bằng AirPort Utility](./phase-06-ios-manual-rssi.md) | 5h | 5 | Completed |
| 7 | [Tab Thiết bị kết nối](./phase-07-connected-devices.md) | 7h | 1, 2, 3 | Completed |
| 8 | [Tab Chất lượng và restyle Modem](./phase-08-quality-check-and-modem.md) | 7h | 1, 2, 3 | Completed |
| 9 | [Dọn code cũ, a11y, hiệu năng, test, docs](./phase-09-cleanup-quality-docs.md) | 6h | 4–8 | Completed |

**Chạy song song:**
- Phase 1 ∥ Phase 2.
- Sau Phase 3 có thể chạy song song 4, 5, 7, 8: mỗi phase sở hữu entity/feature/page riêng và i18n namespace riêng (xem Phase 2).
- `app/router` và `shared/ui` chỉ được sửa ở Phase 1 và 3; phase sau cần primitive mới thì thêm file mới, không sửa file của phase khác.

## Quyết định kỹ thuật chính

1. **Định tuyến:** tab là route con (`/wifi`, `/devices`, `/modem`, `/quality`) dưới `InternetLayout`, để back và deep link hoạt động. Sheet chính mở bằng search param `?sheet=…`, nhờ đó nút back của Android đóng được sheet. Route cũ redirect sang route mới.
2. **Sheet và dialog:** dựa trên phần tử `<dialog>` native (`showModal`), vì có sẵn focus trap, Esc và inert; không thêm thư viện UI.
3. **Thư viện mới, tối thiểu:**
   - `lucide-react`: icon nét 1.5px, tree-shake được.
   - `qrcode`: tạo QR.
   - `@fontsource/be-vietnam-pro`: font self-host, để WebView offline vẫn hiển thị đúng.
4. **Đo sóng:** dùng interface `WifiSignalMeter` với 2 adapter.
   - `bridge` (Android): gọi `superApp.measureWifiSignal`.
   - `manual` (iOS): người dùng nhập RSSI.
   - Quy đổi mức sóng nằm ở `entities/wifi-survey/lib/classify-rssi.ts`, ngưỡng lấy từ config.
5. **Server state** dùng TanStack Query: key factory theo network, mutation `onSuccess` dùng `setQueryData` hoặc invalidate. Thao tác bật/tắt dùng **optimistic update** và rollback khi lỗi.
6. **Token:** mọi màu, khoảng cách và chữ đi qua CSS custom properties; lint (stylelint hoặc grep trong CI) chặn hex hardcode ngoài `tokens.css`.

## Kết quả triển khai

Đã xong cả 9 phase trên nhánh `feat/internet-redesign` (chạy hoàn toàn trên mock MSW). Phase 9: xoá code trước redesign, a11y (axe trong test, 0 lỗi serious/critical), budget bundle (`npm run size`: entry ~160 kB gzip), font chỉ còn 400/600/700 (latin + vietnamese), docs cập nhật. Ảnh QA 390×844: `reports/qa/`.

**Còn chặn trước khi release thật:**

- **Super app (S-01…S-10):** tên hàm JSBridge, mã lỗi, deeplink (VNPT Shop, thanh toán, AirPort Utility), token OTP thử, origin WebView. Hiện production chỉ bật `getMiniAppToken`, `closeMiniApp`.
- **OneBSS (B-01, B-02, B-05, B-08, B-09):** số sê-ri ONT theo hợp đồng (B-01 chặn mọi tab), tốc độ gói, báo hỏng.
- **OneGate (G-01…G-03, G-06/G-07, G-10, G-14, G-18…G-22):** môi trường thử, trường có thể null, cách xoá thiết bị, lưu lượng, nhà có Mesh.
- **VNPT Media / PO (M-02, M-05, M-08, M-10, M-11, M-12, M-15, M-18, D-01…D-06, Q19):** copy hộp thoại, QR khi Wi-Fi tắt, màn đủ 20 vị trí, máy chủ đo Android, slide 2–5, nút "Kiểm tra lại" (không có trong XD). Mỗi mục có `SpecNote` trong `pending-spec-notes.ts`.
- **OpenAPI (R-01…R-11):** đặc biệt R-01 (lệnh không ghi đối tượng), R-02 (`ConnectedDevice.name` phải nullable), R-03 (ràng buộc `MeasurementInput`), R-06 (DELETE có body), R-08 (bật mọi Wi-Fi một lệnh), R-10 (`PLAN_SPEED_UNKNOWN`). Cần thêm môi trường dev có CORS.
- **QA thiết bị thật:** chưa chạy trên WebView Android/iOS ở 360/430 px.

## Ngoài phạm vi

- Implement adapter thật cho SDK của VNPT: chỉ mở rộng interface và adapter Flutter theo giả định.
- Màn đồng bộ tài khoản (Q1).
- Dark mode.
- Tiếng Anh.

## Cần trước khi release thật (không chặn việc code trên mock)

Các câu 🔴 trong open-questions: **Q2, Q3, Q6, Q9, Q13, Q15**.
