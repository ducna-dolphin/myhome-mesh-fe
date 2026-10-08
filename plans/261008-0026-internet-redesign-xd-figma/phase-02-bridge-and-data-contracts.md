---
phase: 2
title: 'Bridge host và data contracts'
status: completed
priority: P1
effort: 8h
dependencies: []
---

# Phase 02 — Bridge host và data contracts

## Context Links
- [open-questions Q2–Q4, Q6, Q9, Q13, Q15, Q17](./research/open-questions.md)
- Code: `src/shared/super-app/super-app-client.ts`, adapter Flutter, browser mock, `src/shared/api/with-mock.ts`, `src/entities/*`
- Docs: `docs/super-app-integration.md`, `docs/system-architecture.md` (danh sách contract đang thiếu modem và subscription)

## Goal
Mọi thứ các phase UI cần đều có sẵn:
- năng lực host qua `SuperAppClient`;
- schema Zod, API và query hook cho từng domain mới;
- fixture mock khớp đúng các trạng thái trong XD.

## Requirements

### A. Mở rộng `SuperAppClient`
Mọi method mới đều là optional capability, kiểm tra qua `supports(cap)`.

| Method | Dùng cho | Fallback (browser hoặc khi host chưa hỗ trợ) |
|---|---|---|
| `platform: 'android' \| 'ios' \| 'web'` | chọn cách đo sóng | đọc từ `navigator.userAgent` |
| `openExternalUrl(url)` | App Store, link ngoài | `window.open` |
| `copyText(text)` | sao chép mật khẩu | `navigator.clipboard.writeText` |
| `saveImage(dataUrl, name)` | lưu ảnh QR | tải file qua `<a download>` |
| `share({title, text?, imageDataUrl?})` | chia sẻ QR | `navigator.share` hoặc ẩn nút |
| `measureWifiSignal({ssid?, durationMs})` → `{rssiDbm, ssid, band}` | đo sóng trên Android | mock: trả số ngẫu nhiên trong khoảng −50…−80 sau ~3s |
| `onResume(cb) → unsubscribe` | quay lại từ App Store hoặc AU | `visibilitychange` |
| `showToast?(msg)` | toast native | dùng toast của miniapp |

- Bổ sung các route native mới vào `native-routes.ts`: `contractPayment`, `meshOrder`, `internetServiceShop`. Tất cả đều là placeholder, có SpecNote.
- Cập nhật adapter Flutter (`miniapp.*` handlers) và tài liệu bridge trong `docs/super-app-integration.md`.

### B. Contracts và entity
Mỗi domain giữ nguyên pattern hiện có: `model/schema` → `api` dùng `withMock` → `queries` → `lib`.

| Entity | Schema chính | Endpoint đề xuất (draft, chờ backend) |
|---|---|---|
| `internet-subscription` (sửa) | + `registeredAt`, `expiresAt`, `canRenew`; giữ field cũ để chuyển dần | GET `/v1/me/internet-subscription` |
| `wifi` (sửa) | `networks[]{id, band, ssid, enabled, securityMode, hasPassword}` + query riêng `getPassword(id)` → `{password}` | GET `/wifi`; PATCH `/wifi/networks/{id}` `{ssid?, password?, enabled?}`; GET `/wifi/networks/{id}/password` |
| `wifi-schedule` (mới) | `{id, onTime 'HH:mm', offTime, days: (1..7)[], enabled}` | GET/POST `/wifi/schedules`; PATCH/DELETE `/wifi/schedules/{id}` |
| `wifi-survey` (mới) | `Location{id, name ≤30, createdAt, source 'self'\|'technician', latest?: Measurement}`; `Measurement{id, rssiDbm, level, method 'auto'\|'manual', ssid, measuredAt}`; `limit: 20` | GET/POST `/survey/locations`; PATCH/DELETE `/survey/locations/{id}`; POST `/survey/locations/{id}/measurements`; GET `…/measurements?limit=5` |
| `client` (sửa) | + `iconType` (8 enum), `blocked: boolean`, `status 'connected'\|'blocked'\|'offline'`, `connectedSsid` | PATCH `/clients/{id}` `{displayName?, iconType?, blocked?}`; DELETE `/clients/{id}` |
| `quality-check` (mới, thay `run-speed-test` API) | `{checkedAt, line: 'stable'\|'unstable'\|'down', wifi: 'pass'\|'fail'\|'none', clientCount}` | POST `/quality-checks` (đồng bộ, timeout 60s); GET `/quality-checks/latest` |

- Mock dùng module state (giống `modem-mock.ts`) để rename, xoá, chặn và đo đều thay đổi được dữ liệu trong cùng phiên.
- Fixture khớp XD:
  - 5 vị trí: 1 Yếu, 2 Trung bình, 2 Khoẻ.
  - 10 thiết bị: 1 bị chặn.
  - 2 SSID.
  - 0 lịch, kèm biến env để bật bản có 2 lịch.
- Thêm biến env `VITE_MOCK_SURVEY=empty|partial|full` và `VITE_MOCK_QUALITY=stable|unstable|down`, để xem từng trạng thái của XD.
- Sửa mock không nhất quán (overview 8 client nhưng danh sách có 3): đếm `clientCount` từ chính danh sách.

### C. i18n
- Tách namespace theo domain để các phase song song không đụng nhau: `internet` (shell, hợp đồng), `wifi`, `survey`, `devices`, `modem`, `quality`. Namespace `network` hiện có chuyển dần sang các namespace mới, rồi xoá ở Phase 9.
- Cập nhật typed resources trong `i18next-resources.d.ts`.

## Implementation Steps
1. Mở rộng interface, thêm `supports`, implement trong browser mock và Flutter adapter. Test: chọn adapter, các fallback.
2. Thêm `shared/lib/platform.ts` (`usePlatform()`).
3. Viết schema, API, queries và mock cho từng entity trong bảng. Mỗi entity có test schema và test key scoping, như đang có.
4. Tách namespace i18n, khung rỗng.
5. Cập nhật `docs/system-architecture.md` (contract list) và `docs/super-app-integration.md` (bridge mới + câu hỏi Q2–Q4).
6. Thêm entry `pendingSpecNotes` cho mỗi endpoint còn draft.

## Success Criteria
- Mọi query hook mới trả đúng dữ liệu mock và test pass.
- `supports()` trả `false` trên browser mock với `measureWifiSignal`, trừ khi bật `VITE_MOCK_PLATFORM=android`.
- Coverage của `entities/**` ≥ 70%.

## Risk Assessment
- Contract chưa chốt nên schema sẽ còn thay đổi. Giảm rủi ro bằng cách giữ quy đổi dữ liệu trong `api/` (map DTO → model), để UI không phụ thuộc vào DTO.
- Bridge Android đo RSSI có thể không khả thi (Q2). Giữ fallback dùng luồng nhập tay (Phase 6) cho cả Android.

## Security Considerations
- Mật khẩu Wi-Fi chỉ lấy khi người dùng chủ động thao tác (hiện, copy, QR). Không cache qua `gcTime`: đặt `gcTime: 0`, `staleTime: 0`. Không log mật khẩu, không đưa vào URL hay error message.
- `openExternalUrl` chỉ cho phép allowlist (`apps.apple.com`, domain VNPT).
