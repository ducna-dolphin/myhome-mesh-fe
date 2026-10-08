# Đối chiếu FE ↔ LLD / OpenAPI / nguồn bên thứ ba

Nguồn dùng để đối chiếu:
- `bs-requirement/technical/lld/LLD-tong-hop.docx`, bản mới nhất lúc 2026-10-07 22:44;
- `openapi.yaml` (1.0.0-draft);
- `sources/text/3-onegate-api.txt` và `4-brcd-api.txt`;
- mockup XD ngày 2026-10-07.

Mã G-/B-/M-/S-/N- trong file này là mã câu hỏi ở chương 13 của LLD.

## 1. Kết luận

LLD và OpenAPI **đủ cho khoảng 85% màn hình**. FE có thể code bám đúng contract ngay từ bây giờ, với mock theo đúng envelope `{data, meta, errors}` / `{error}`, đường dẫn và mã lỗi. Khi có backend, chỉ cần đổi `VITE_API_MODE`.

Còn **7 lỗ hổng contract** (mục 2), cần bổ sung vào `openapi.yaml` thì mới nối thật mà không phải sửa UI. Còn **11 hàm JSBridge** chưa được super app xác nhận (S-01…S-10), và các câu chặn của đối tác (G-, B-, M-) mà LLD đã liệt kê.

## 2. Lỗ hổng contract FE cần (đề nghị nhóm backend bổ sung vào openapi.yaml)

| # | Lỗ hổng | Bằng chứng | Đề xuất |
|---|---|---|---|
| F-01 | **Thiết bị offline không biểu diễn được.** `ConnectedDeviceStatus` chỉ có `CONNECTED`, `BLOCKED`, trong khi XD có "Tất cả 10 / Đang kết nối 5 / Đang bị chặn 1", tức có 4 thiết bị không kết nối và không bị chặn | OneGate `getConnectedUserInfo` có trả `isActive` (onegate-api.txt:8051) | Thêm `active: boolean` vào `ConnectedDevice`, hoặc thêm `OFFLINE` vào enum. Chốt luôn chip "Đang kết nối" đếm theo trường nào |
| F-02 | **Không có API "Báo hỏng".** `HealthCheckItem.action` có `REPORT_FAULT`, LLD §10.2 nói "backend gọi API báo hỏng OneBSS", nhưng openapi không có endpoint | LLD §10.2, B-09 | Thêm `POST /mesh/v1/devices/{serialNumber}/fault-reports` (cần `Idempotency-Key`) → `201 {ticketId, createdAt}`. Nếu không làm ở M1 thì backend không được trả action `REPORT_FAULT` |
| F-03 | **Thiếu dữ liệu cho "sắp theo lưu lượng giảm dần"** khi bấm từ trạng thái `HOGGED` (`OPEN_DEVICES_TAB`). `ConnectedDevice` không có trường lưu lượng | LLD §10.2 bảng hạng mục; G-14 | Thêm `trafficSharePercent: integer\|null` vào `ConnectedDevice`, hoặc FE chỉ đưa `topDevice.macAddress` lên đầu (đề xuất tạm, FE làm được ngay) |
| F-04 | **Lệnh thất bại không có lý do.** `Command` ở trạng thái `FAILED` không có `errorCode`, nên FE không phân biệt được "modem mất kết nối", "bị từ chối" hay "hết hạn" để hiện câu phù hợp | LLD §4.4: "Lệnh vẫn lưu FAILED để tra cứu" | Thêm `errorCode: ErrorCode\|null` vào `Command` |
| F-05 | **Không khôi phục được lệnh đang chạy khi mở lại MiniApp.** Ví dụ đang khởi động lại modem (tối đa 6 phút) mà người dùng đóng rồi mở lại app: commands chỉ nằm trong bộ nhớ, và không có API liệt kê lệnh đang chạy | LLD §11.5 (commands chỉ trong bộ nhớ); P5-02 hỏi lại 6 phút | Thêm `GET /mesh/v1/devices/{serialNumber}/commands?state=PENDING,SENT,UNKNOWN`, hoặc trả `pendingCommand` trong `GET /mesh/v1/devices/{serialNumber}` |
| F-06 | **Đo thử trên Android phải tự tính mức** theo QD-02/QD-03 (LLD §6.4: "Kết quả đo thử tự tính ở MiniApp theo cùng ngưỡng"). FE không có ngưỡng, nên dễ lệch với backend. iPhone cũng cần ngưỡng để xem trước mức sóng khi nhập RSSI | LLD §6.4, §6.5 | Hoặc thêm `GET /mesh/v1/measurement-thresholds` → `{android: {...}, ios: {goodAboveDbm: -60, fairAboveDbm: -70}}`; hoặc `POST …/measurements?dryRun=true` trả `level` mà không lưu |
| F-07 | **`WifiNetwork` thiếu các trường UI cần:** `securityMode` (chỉ có trong reveal-password), và trạng thái "đang áp dụng" sau khi lệnh trả `UNKNOWN` | LLD §7.3: lệnh thường kết thúc ở `UNKNOWN` | Thêm `securityMode` vào `WifiNetwork`. FE tự giữ trạng thái lệnh đang chạy theo `wifiIndex` (kết hợp với F-05) |

**Nhỏ, ghi để tránh lỗi khi nối:**
- `DELETE …/connected-devices/{mac}` có request body. `fetch` gửi được, nhưng một số proxy hoặc gateway bỏ body của DELETE. Nên chuyển sang `POST …/{mac}/remove` hoặc gửi bằng query param.
- `PATCH wifi-networks` dùng `application/merge-patch+json`. `http-client` của FE phải cho phép đặt content-type riêng.
- Hành động `ENABLE_WIFI` của tab Chất lượng: FE phải gọi PATCH lần lượt cho từng mạng, mỗi mạng một lệnh, và cả hai đều tranh khoá thiết bị (`DEVICE_BUSY`). Nên có `POST …/wifi-networks/enable-all`, hoặc PATCH nhận nhiều `wifiIndex` trong một lệnh.
- `ContractLinkDetail.serialNumber` có thể `null` (B-01). FE cần thêm màn hoặc trạng thái "Chưa xác định được modem của hợp đồng"; các tab Wifi, Thiết bị, Modem, Chất lượng không gọi được API khi thiếu số sê-ri.
- `POST …/measurements` trả `409 CONFLICT` khi thiếu tốc độ gói (Q-48 / B-05). Cần copy riêng, hoặc dùng một mã lỗi riêng như `PLAN_SPEED_UNKNOWN`, để FE không gộp chung với các `CONFLICT` khác.

## 3. Thiết kế hoặc mockup còn thiếu (VNPT Media / BA)

| # | Nội dung | Mã LLD |
|---|---|---|
| D-01 | **Chọn hợp đồng bằng danh sách thả xuống** trong khối "Thông tin hợp đồng": XD chưa vẽ (chỉ có accordion) | P1-02, §5.2 "chưa có wireframe" |
| D-02 | Trạng thái của các màn: modem mất kết nối (`DEVICE_OFFLINE`), dữ liệu cũ (`meta.stale` → "Cập nhật lúc HH:mm"), lệnh đang áp dụng / `UNKNOWN`, khối lỗi từng phần (`errors[]`) | §11.4 |
| D-03 | Nút "Khởi động lại" trên tab Modem; "Kết nối qua" hiện Wi-Fi / Có dây; bỏ màn lịch bật/tắt | M-16, M-19, §7.4 |
| D-04 | Màn điều kiện đo không đạt (DK-02…DK-06): không ở Wi-Fi nhà, đang bật VPN, sai modem | P2-03 |
| D-05 | Màn khi đã đủ 20 vị trí | M-10 |
| D-06 | Copy chốt cho các hộp thoại (chặn thiết bị, khởi động lại, xoá thiết bị) và cho 9 trạng thái của tab Chất lượng | M-11, M-12, M-05 |

## 4. Những gì phải có từ đối tác thì mới bỏ mock được

| Bên | Cần gửi | Chặn phần FE nào |
|---|---|---|
| **Super app** | Đặc tả JSBridge thật: tên hàm, tham số, mã lỗi (S-01…S-10, S-08), danh sách deeplink (VNPT Shop, thanh toán, App Store AU), một token OTP thử, origin được đăng ký | Toàn bộ, vì token đi qua `getMiniAppToken`. Đo trên Android (S-04), điều kiện đo (S-02, S-03), QR / copy (S-07) |
| **Backend MyHome** | Môi trường dev có CORS cho origin dev của FE; trả lời F-01…F-07; bản openapi đã chốt (bỏ "-draft") | Nối API |
| **VNPT Technology (OneGate)** | G-01, G-02, G-03 (đăng nhập, môi trường thử), G-18…G-22 (nhà có Mesh), JSON phản hồi thật | Gián tiếp. FE vẫn làm được trên mock, nhưng **không kiểm thử end-to-end được** |
| **VNPT IT (OneBSS)** | B-01 (số sê-ri ONT theo hợp đồng), B-02, B-05 (tốc độ gói), B-08 | B-01 chặn mọi tab. B-05 chỉ còn ảnh hưởng điều kiện "% gói" của tab Chất lượng, vì Android đã chuyển sang đo bằng RSSI |
| **VNPT Media** | D-01…D-06, M-02, M-18 (máy chủ đích khi đo trên Android) | Đo trên Android, chọn hợp đồng |

## 5. Ảnh hưởng tới plan FE (đã phản ánh vào plan.md)

1. **Đổi nền tảng API (Phase 2 viết lại):**
   - `http-client` theo CF: envelope `{data, meta, errors}`, `{error:{code,retryable,retryAfterSec,traceId}}`, `Idempotency-Key` sinh một lần cho mỗi lần bấm, header `X-Request-Id` và `X-Client-Version`.
   - 401 thì gọi `getMiniAppToken` rồi thử lại 1 lần; vẫn 401 thì `closeMiniApp`.
   - `commandPoller` (202 + `Location`) chạy trên TanStack Query: `refetchInterval` theo `retryAfterSec`, giới hạn 2 phút, riêng khởi động lại là 6 phút.
   - Sinh type từ `openapi.yaml` bằng `openapi-typescript`. Mock bằng **MSW**, theo đúng path, status và envelope. Thêm test tự động kiểm fixture mock khớp schema OpenAPI, để contract đổi là test đỏ.
2. **Session:** bỏ khái niệm `networkId`. Phạm vi dữ liệu là `contractId` (đang chọn) → `serialNumber`. Query key đổi thành `['contract', id]` và `['device', serialNumber, …]`.
3. **Bridge:** viết theo đúng interface `MyHomeBridge` của LLD §11.3. Mỗi hàm đi qua `supports()`, timeout 10s, lỗi `{code: BRIDGE_UNSUPPORTED|PERMISSION_DENIED|TIMEOUT|FAILED}`.
4. **Bỏ khỏi phạm vi M1:** lịch bật/tắt Wi-Fi (P3-03, P3-04), nhánh nhân viên kỹ thuật đo, màn đồng bộ tài khoản (super app gọi `mini-app-sessions` trước khi mở WebView).
5. **Đo trên Android: chưa chốt, làm sẵn cả hai cách** (SPEED theo LLD, RSSI qua JSBridge), chọn bằng cấu hình backend. Xem [openapi-review-2026-10-08 §3](./openapi-review-2026-10-08.md). Nội dung phương án RSSI ghi lại bên dưới để tham khảo:
   - Super app đọc RSSI qua `WifiManager` và trả cho MiniApp qua JSBridge: `measureWifi({durationSec})` → `{rssiDbm, sampleCount, bssid?}`. Nên lấy mẫu nhiều lần trong khoảng 8 giây rồi lấy trung bình.
   - MiniApp gửi `POST …/measurements {platform: ANDROID, rssiDbm, measuredAt}`.
   - Hai nền tảng dùng chung một bảng ngưỡng QD-04.
   - Vẫn kiểm tra điều kiện DK-02…DK-06 trước khi đo:
     - `getNetworkInfo`: đang ở Wi-Fi, không bật VPN.
     - `getWifiInfo().bssid` so với `macAddress` của modem; dự phòng là so IP (N-04).
   - Hệ quả:
     - Đo sóng không còn phụ thuộc B-05 (tốc độ gói) hay M-18 (máy chủ đích).
     - F-06 đơn giản hơn: chỉ còn một bảng ngưỡng RSSI.
     - LLD §6.4 và §11.3 cùng `MeasurementInput` trong openapi phải sửa: `rssiDbm` bắt buộc với cả hai nền tảng; bỏ `downloadMbps`, `latencyMs`.
     - URD QD-02/QD-03 cần BA sửa theo.
6. **Tab Chất lượng:** chạy bất đồng bộ: POST → 202 → hỏi lại `GET …/health-checks/{checkId}` mỗi 3s; quá 3 phút thì coi là FAILED.
   - 3 hạng mục với các trạng thái `STABLE/UNSTABLE/DISCONNECTED`, `PASS/FAIL/OFF`, `NORMAL/HOGGED`.
   - 5 action: `RESET_MODEM`, `REPORT_FAULT`, `ENABLE_WIFI`, `ORDER_MESH`, `OPEN_DEVICES_TAB`.
   - `overallStatus` ∈ `NO_ISSUE/ISSUES_FOUND/INCOMPLETE`.
   - Câu chữ do FE ghép từ `status` và các số liệu.
7. **Modem:** mỗi hợp đồng chỉ có 1 ONT (`GET /mesh/v1/devices/{sn}`), bỏ danh sách nhiều modem. `uptimeSec`, `totalTrafficBytes` và `temperatureCelsius` có thể `null` (G-06, G-07); khi đó hiện "—". Khởi động lại bị giới hạn 3 lần trong 30 phút (`429`).
8. **Thiết bị:**
   - Hiện "Kết nối qua: Wi-Fi / Có dây".
   - `blockable=false` thì ẩn nút Chặn và nút Xoá.
   - Gửi `selfMacAddress` / `selfIpAddress` lấy từ `getWifiInfo` khi chặn hoặc xoá.
   - 8 icon: `PHONE, TABLET, LAPTOP, TV, ROUTER, STORAGE, MESH, CAMERA`.
9. **Mật khẩu Wi-Fi:**
   - `POST reveal-password {purpose: VIEW|COPY|QR}`, giới hạn 30 lần mỗi giờ (`429`).
   - Xoá khỏi bộ nhớ sau 60s hoặc khi rời màn.
   - QR theo dạng `WIFI:T:WPA;S:…;P:…;;`.
10. **Chỉ được lưu `lastTab` vào localStorage.** Không lưu token, mật khẩu hay số điện thoại.
11. **Hiển thị thời gian** theo định dạng `HH:mm - dd/mm/yyyy`; backend trả UTC, FE đổi sang giờ máy.
