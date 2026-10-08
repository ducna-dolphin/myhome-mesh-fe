# Review openapi.yaml (bản 2026-10-08 00:45) và hai phương án đo trên Android

**Kiểm tra máy:**
- `@redocly/cli lint`: **hợp lệ**. Có 9 cảnh báo nhỏ: thiếu `license`, thiếu mô tả tag, component header `XRequestId` không được dùng.
- `openapi-typescript@7`: sinh type thành công, FE dùng trực tiếp được.

## 1. Lỗ hổng F-01…F-07: trạng thái sau khi sửa

| # | Trạng thái | Ghi chú |
|---|---|---|
| F-01 offline | ✅ | `ConnectedDeviceStatus` có thêm `DISCONNECTED` |
| F-02 báo hỏng | ✅ | `POST /link/v1/contract-links/{contractId}/fault-reports` |
| F-03 lưu lượng | ✅ | `trafficSharePercent` (null cho tới khi có G-14) |
| F-04 lý do lỗi | ✅ | `Command.errorCode` + `VERIFY_MISMATCH` |
| F-05 lệnh đang chạy | ⚠️ Gần đủ | Xem R-01 |
| F-06 ngưỡng | ⚠️ Gần đủ | `GET /mesh/v1/signal-thresholds` mới chỉ có ngưỡng theo tốc độ cho Android. Xem §3 |
| F-07 securityMode | ✅ | |

## 2. Điểm còn cần sửa (xếp theo mức ảnh hưởng tới FE)

| # | Mức | Vấn đề | Đề xuất sửa |
|---|---|---|---|
| R-01 | **Cao** | `Command` không nói lệnh nhắm vào đối tượng nào. Khi mở lại app, `GET …/commands?active=true` trả về `WIFI_UPDATE` hay `CLIENT_BLOCK`, nhưng FE không biết đó là mạng `wifiIndex` nào hay thiết bị MAC nào để hiện "Đang áp dụng…" đúng chỗ | Thêm `target: { wifiIndex?: integer, macAddress?: string } \| null` vào `Command`. Nếu xoá thiết bị là một lệnh riêng thì thêm `CLIENT_REMOVE` vào `type` |
| R-02 | **Cao** | `ConnectedDevice.name` là `string` **bắt buộc**, nhưng LLD §8.2 ghi tên lấy "tên khách đặt → hostName → deviceName → **null**". Backend trả `null` thì Zod/FE sẽ lỗi | `name: { type: [string, 'null'] }` (FE tự hiện "Thiết bị không tên" kèm MAC), hoặc backend cam kết dùng MAC khi không có tên |
| R-03 | **Cao** | `MeasurementInput` chỉ ghi "bắt buộc với ANDROID/IOS" trong description, không có ràng buộc trong schema. Code sinh ra để mọi trường đều optional, nên FE gửi thiếu trường vẫn qua typecheck | Dùng `oneOf` + `discriminator`. Sửa luôn theo §3 để hỗ trợ cả hai cách đo |
| R-04 | Trung bình | `GET /contract-links/{contractId}`: description nói `billing` có thể `null` và `errors[].target = billing`, nhưng schema không có trường `billing`; còn `lastPaymentDate` lại ghi target là `payment` | Thống nhất một target là `payment`, bỏ chữ `billing` trong description |
| R-05 | Trung bình | `SignalThresholds` không có `required` nên mọi trường đều optional | Thêm `required` cho từng nhóm |
| R-06 | Trung bình | `DELETE …/connected-devices/{mac}` có request body. Một số API gateway hoặc proxy bỏ body của DELETE, và CF không nói gì về trường hợp này | Đổi thành `POST …/{mac}/remove` (cùng kiểu với `/block`, `/unblock`), hoặc gửi bằng query param |
| R-07 | Thấp | `400 IDEMPOTENCY_KEY_REQUIRED` chỉ được khai báo ở `select`. Các API ghi khác (fault-reports, xoá vị trí, block, reboot, `POST health-checks`…) không khai báo | Thêm `'400': IdempotencyKeyRequired` cho mọi thao tác ghi |
| R-08 | Thấp | Chưa có cách bật mọi Wi-Fi bằng một lệnh (action `ENABLE_WIFI`). FE phải gửi nhiều PATCH, và mỗi PATCH tranh khoá thiết bị (`DEVICE_BUSY`) | Hoặc `POST …/wifi-networks/enable-all` (1 lệnh), hoặc ghi rõ FE gửi tuần tự và chờ lệnh trước `CONFIRMED`/`UNKNOWN` mới gửi lệnh sau |
| R-09 | Thấp | `fault-reports` không khai báo `409` (đã có phiếu đang mở, báo trùng) và `429` | Thêm `409 CONFLICT` kèm `ticketCode` của phiếu đang mở, và `429` |
| R-10 | Thấp | `POST …/measurements` trả `409 CONFLICT` khi thiếu tốc độ gói (Q-48), nên FE không phân biệt được với các `CONFLICT` khác | Thêm mã `PLAN_SPEED_UNKNOWN`. Theo phương án B ở §3 thì mã này không cần |
| R-11 | Thấp | Header `X-Request-Id` của response được định nghĩa nhưng không dùng; LLD §2.3 yêu cầu expose header này qua CORS | Gắn `headers: X-Request-Id` vào các response chung, hoặc xoá component |

## 3. Hai phương án đo trên Android: một contract dùng chung

Chưa chốt Android đo bằng **tốc độ + độ trễ** (URD QD-02/QD-03, LLD hiện tại) hay bằng **RSSI qua JSBridge**. Đề xuất để **backend quyết định bằng cấu hình** và FE làm sẵn cả hai. Đổi phương án khi đó chỉ cần sửa config backend, không phải phát hành lại MiniApp.

| | A. Tốc độ + độ trễ (LLD hiện tại) | B. RSSI qua JSBridge |
|---|---|---|
| Bridge | `measureWifiSpeed({durationSec})` → `{downloadMbps, latencyMs}` | `readWifiRssi({durationSec})` → `{rssiDbm, sampleCount}` (native lấy mẫu nhiều lần rồi trung bình) |
| Cách quy đổi | % so với tốc độ gói (≥ 70 Tốt / ≥ 40 TB) và trễ > 50 ms thì hạ một mức | Giống iPhone (QD-04): > −60 Tốt, > −70 TB |
| Phụ thuộc | B-05 (quy đổi tốc độ gói), M-18 (máy chủ đích), máy chủ đo tốc độ | Super app đọc được RSSI. Đọc BSSID cần quyền vị trí (S-03) |
| Ưu | Phản ánh trải nghiệm thật (tốc độ) | Đơn giản, nhanh (~8 giây), không cần máy chủ đo, cùng thang với iPhone |
| Nhược | Nhiều điểm chặn, tốn băng thông, kết quả phụ thuộc gói cước | RSSI chỉ phản ánh cường độ sóng, không phản ánh tốc độ; chuẩn mỗi máy Android một khác |

**Contract đề xuất** (dán vào `components/schemas`):

```yaml
MeasurementMethod:
  type: string
  enum: [SPEED, RSSI]
  description: 'SPEED: tốc độ + độ trễ (QD-02, QD-03). RSSI: cường độ sóng (QD-04)'

MeasurementInput:
  oneOf:
    - $ref: '#/components/schemas/SpeedMeasurementInput'
    - $ref: '#/components/schemas/RssiMeasurementInput'
  discriminator:
    propertyName: method
    mapping:
      SPEED: '#/components/schemas/SpeedMeasurementInput'
      RSSI: '#/components/schemas/RssiMeasurementInput'

SpeedMeasurementInput:
  type: object
  required: [method, platform, measuredAt, downloadMbps, latencyMs]
  properties:
    method: { type: string, const: SPEED }
    platform: { type: string, enum: [ANDROID] }
    measuredAt: { type: string, format: date-time }
    downloadMbps: { type: number, minimum: 0 }
    latencyMs: { type: number, minimum: 0 }

RssiMeasurementInput:
  type: object
  required: [method, platform, measuredAt, rssiDbm]
  properties:
    method: { type: string, const: RSSI }
    platform: { type: string, enum: [ANDROID, IOS] }
    source: { type: string, enum: [BRIDGE, MANUAL], description: 'BRIDGE: native đọc (Android). MANUAL: khách nhập từ AirPort Utility (iPhone)' }
    measuredAt: { type: string, format: date-time }
    rssiDbm: { type: integer, minimum: -100, maximum: -30 }
    sampleCount: { type: [integer, 'null'], minimum: 1 }

SignalThresholds:
  type: object
  required: [androidMethod, speed, rssi]
  properties:
    androidMethod: { $ref: '#/components/schemas/MeasurementMethod', description: 'Cách đo Android đang dùng; MiniApp chọn luồng theo trường này' }
    speed:
      type: object
      required: [goodMinPercent, fairMinPercent, latencyDowngradeMs]
      properties:
        goodMinPercent: { type: number, examples: [70] }
        fairMinPercent: { type: number, examples: [40] }
        latencyDowngradeMs: { type: number, examples: [50] }
    rssi:
      type: object
      required: [goodAboveDbm, fairAboveDbm]
      properties:
        goodAboveDbm: { type: integer, examples: [-60] }
        fairAboveDbm: { type: integer, examples: [-70] }
```

**Quy tắc backend:**
- `POST …/measurements` nhận cả hai `method`. Phương thức không khớp `androidMethod` hiện hành vẫn được nhận, để giữ tương thích khi đổi cấu hình giữa phiên.
- `PLAN_SPEED_UNKNOWN` (R-10) chỉ có với `SPEED`.
- Nếu muốn biết sau này đã đo theo cách nào, có thể thêm `method` vào `Measurement` (response). FE không hiển thị trường này (QD-06).

**JSBridge (LLD §11.3):** tách `measureWifi` thành hai hàm `measureWifiSpeed` và `readWifiRssi`. Super app làm hàm nào trước cũng được, MiniApp kiểm tra bằng `supports()`.

**Phía FE:**
```
features/measure-wifi-signal/model/
  wifi-signal-meter.ts        // interface Meter { method; source; measure(signal): Promise<MeasurementInput> }
  speed-bridge-meter.ts       // A: bridge.measureWifiSpeed
  rssi-bridge-meter.ts        // B: bridge.readWifiRssi
  rssi-manual-meter.ts        // iPhone: nhập từ AirPort Utility
  select-meter.ts             // iOS → manual; Android → theo thresholds.androidMethod;
                              //   bridge không hỗ trợ cách đó → thử cách còn lại → hết thì về manual
  classify-level.ts           // đo thử và xem trước, dùng ngưỡng từ API (không hardcode)
```
- Mock có biến env `VITE_MOCK_ANDROID_METHOD=SPEED|RSSI` để kiểm thử cả hai luồng.
- Giao diện hai luồng giống nhau: sheet "Đang đo… 8 giây" → mức → lưu. Chỉ bước kiểm tra điều kiện khác nhau: luồng SPEED cần thêm `planDownloadMbps`.
