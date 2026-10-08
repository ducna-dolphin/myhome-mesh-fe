---
phase: 7
title: 'Tab Thiết bị kết nối'
status: completed
priority: P1
effort: 7h
dependencies: [1, 2, 3]
---

# Phase 07 — Tab Thiết bị kết nối

## Context Links
- [design-sources §2](./research/design-sources.md) · XD `s03`, `s27`, `s28`; Figma 26:30 → 26:31 → 26:32 → 26:21
- Code: `src/pages/clients/*`, `src/pages/client-detail/*`, `src/entities/client/*`
- Câu hỏi: Q13, Q14

## Goal
Danh sách thiết bị có lọc; chi tiết thiết bị có chặn kết nối Internet và xoá; đổi tên kèm icon.

## Requirements
- **`pages/devices`** (tab):
  - FilterChip "Tất cả N" / "Đang kết nối N" / "Đang bị chặn N" (badge đỏ). Filter lưu trong `?filter=` để giữ khi bấm back.
  - Tab "Tất cả" xếp đang kết nối → bị chặn → offline, cùng nhóm thì theo tên (comment PO).
  - Hàm thuần `filterAndSortClients`.
- **`DeviceRow`:** `ListRow` gồm icon theo `iconType` (map sang icon lucide), tên, MAC, chấm trạng thái + nhãn, chevron. Thiết bị bị chặn: tên và nhãn màu đỏ, "Đã chặn".
- **Empty state theo filter**, ví dụ "Không có thiết bị nào đang bị chặn". Polling 10s giữ như cũ, nhưng tạm dừng khi tab bị ẩn (`refetchIntervalInBackground: false`, giá trị mặc định).
- **`pages/device-detail`:**
  - Header gồm icon, tên, trạng thái và nút ✎ → `/devices/:id/edit`.
  - "Thông tin thiết bị": Loại thiết bị, MAC, IP, Kết nối qua (SSID), băng tần, tín hiệu.
  - Card Switch "Chặn kết nối Internet": optimistic; khi bật chặn thì mở dialog xác nhận.
  - Dòng đỏ "Xoá thiết bị khỏi kết nối": dialog destructive; thành công thì toast và quay về danh sách. Xoá khỏi cache bằng `setQueryData`.
- **`features/edit-client-identity`:** TextField tên (1–32 ký tự) + lưới 8 icon (radio group, `role="radiogroup"`, chọn bằng phím mũi tên), nút ghim "Lưu thay đổi" (disable khi chưa có thay đổi). Thành công thì cập nhật cache cả list và detail.
- Không làm action sheet ⋮ của Figma 26:32, vì XD đã đưa các hành động đó lên thẳng màn chi tiết (XD là bản mới hơn).

## Implementation Steps
1. Viết `filterAndSortClients` và `countByStatus` kèm unit test.
2. Viết tab danh sách và `DeviceRow`; xoá `pages/clients` cũ.
3. Viết trang chi tiết, feature `block-client` và feature `remove-client`; xoá `pages/client-detail` cũ.
4. Viết feature `edit-client-identity`.
5. Thêm i18n vào namespace `devices`.
6. Test:
   - filter và đếm;
   - thứ tự sắp xếp;
   - chặn: optimistic, rollback;
   - xoá có xác nhận, điều hướng sau khi xoá;
   - đổi tên/icon;
   - phím mũi tên trên radiogroup.

## Success Criteria
- Đi hết luồng Figma và XD trên mock 10 thiết bị.
- Trạng thái chặn đồng bộ giữa list và detail mà không cần reload.

## Risk Assessment
- Chưa rõ "Xoá" khác "Chặn" thế nào (Q13). Nếu xoá chỉ là kick tạm thời, thiết bị sẽ xuất hiện lại sau lần polling tiếp theo; dialog cần nói rõ điều này. Copy để dạng SpecNote.
- Chặn nhầm chính thiết bị đang dùng miniapp sẽ làm mất mạng. Nếu backend trả về `isSelf`, cảnh báo đặc biệt; nếu không có thì ghi thành câu hỏi bổ sung cho Q13.

## Security Considerations
- MAC là dữ liệu định danh: không log, không gửi telemetry.
