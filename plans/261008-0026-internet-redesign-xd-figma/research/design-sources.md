# Nguồn thiết kế — tổng hợp

Thu thập ngày 2026-10-08.

| Nguồn | Vai trò | Ghi chú truy cập |
|---|---|---|
| Adobe XD review link `a190c9c5-…/screen/f9441f49-…` (33 màn, cập nhật 07/10) | **Source of truth về visual + copy mới nhất**, có comment của PO | Link review, không phải Design Specs → token lấy mẫu từ pixel (±2pt) |
| Figma `2Gc4kwE4lvlMkhPINP69OL` (Page 1) | **Source of truth về luồng** (flow board: ảnh chụp + mũi tên + nhãn nhánh) | Gói Starter bị chặn số lần gọi MCP, file không có Variables → **không có token trong Figma** |

Ảnh tham chiếu: `../assets/xd/sNN.png` (thứ tự grid XD), `../assets/figma-board.png`.

## 1. Kiến trúc thông tin (XD mới nhất)

- **Không có bottom nav.** Một màn chính "Internet": header `Internet` + nút X tròn (đóng miniapp, host xử lý) → card **"Thông tin hợp đồng"** dạng accordion (Mã hợp đồng / Ngày đăng ký / Ngày hết hạn + nút "Thanh toán / Gia hạn ngay") → **segmented tab dạng pill**: `Wifi · Thiết bị kết nối · Modem · Chất lượng`.
- Màn con (có back): Đổi tên/mật khẩu Wi-Fi, Chia sẻ Wi-Fi (QR), Lịch bật/tắt Wi-Fi, Chi tiết thiết bị, Đổi tên/Icon thiết bị.
- Các thao tác nhỏ dùng **bottom sheet** (tuỳ chọn SSID, đặt tên vị trí, đang đo/kết quả, hướng dẫn iOS, chọn ngày) hoặc **dialog** (xác nhận vị trí, xoá vị trí, đổi tên vị trí).
- Màn chưa có dịch vụ: carousel 5 slide, hero 3D, "Quản lý mạng gia đình trong tầm tay", CTA "Đăng ký ngay".
- Màn "Đồng bộ tài khoản bằng số điện thoại" (Figma 26:34) chỉ có trong Figma, không có trong XD → giả định do **host** xử lý (xem câu hỏi Q1).

## 2. Theo từng tab

### Wifi (XD s02/s09, Figma 26:40…26:84, 26:28…26:18)
- Khối **"Sức khoẻ Wi-fi theo khu vực"** + counter `5/20 vị trí`: lưới 3 cột tile; mỗi tile = tên phòng, mức (Yếu/Trung bình/Khoẻ) có nền và viền theo mức, "Đo ngày dd/mm/yy", menu ⋮; ô "+ Thêm vị trí". **Phòng yếu xếp lên đầu.**
- Khi có phòng yếu: alert đỏ "<phòng> đang có sóng yếu. Lắp thêm 1 bộ Mesh…" + banner teal "Đặt lắp thêm Mesh / Chỉ thêm 30k/tháng…".
- Chưa đo lần nào: card "Tự kiểm tra sóng từng vị trí" + "CẦN CÓ ĐỦ 4 ĐIỀU KIỆN" (ở nhà, đúng Wi-Fi nhà, tắt VPN, đứng đúng vị trí) + nút "Tự đo".
- Sheet "Đặt tên vị trí đo": input tối đa 30 ký tự, chip gợi ý (Phòng khách, Phòng ngủ tầng 1, Bếp, Phòng làm việc, Ban công), "Lưu & đo ngay" / "Lưu, đo sau". Giới hạn 20 vị trí, tên không trùng.
- "Đo ngay" từ tile → dialog "Bạn đang ở <phòng>?" ("Đúng rồi, đo tiếp" / "Đổi vị trí khác") → sheet đang đo (khoảng 8 giây, progress) → sheet kết quả "Chất lượng Wi-fi: <mức>", thời điểm, nút "Đo lại" → toast.
- Menu ⋮: Đổi tên vị trí (dialog, giữ lịch sử) · Đo lại và xem lịch sử (sheet + "Lịch sử đo · 5 lần gần nhất") · Xoá vị trí (dialog đỏ, xoá cả lịch sử).
- **Android:** đo tự động (cần bridge native đọc RSSI). **iOS:** đo tay qua app Apple *AirPort Utility* rồi nhập RSSI (xem §3).
- **Danh sách Wi-fi (n):** mỗi SSID có ô mật khẩu che + icon mắt; bấm → sheet tuỳ chọn: Bật/Tắt Wi-Fi (toggle), Đổi tên/Mật khẩu, Đặt lịch bật/tắt tự động, Sao chép mật khẩu, Chia sẻ Wi-Fi (QR).
- Đổi tên/mật khẩu: SSID ≤ 32 ký tự, mật khẩu ≥ 8 ký tự, nút ghim đáy "Lưu thay đổi".
- QR: QR + SSID + băng tần, "Lưu ảnh QR" / "Chia sẻ".
- Lịch: trống → "+ Thêm lịch mới" → sheet gồm wheel giờ bật (panel teal nhạt), wheel giờ tắt (panel cam nhạt), chip ngày T2…CN → "Lưu lịch" → danh sách card kèm toggle. Caption: lịch áp dụng cho mọi Wi-Fi của modem.

### Thiết bị kết nối (XD s03, s27, s28; Figma 26:30/32/21/31)
- Chip lọc có số lượng: `Tất cả 10` / `Đang kết nối 5` / `Đang bị chặn 1` (badge đỏ). Tab "Tất cả" ưu tiên thiết bị đang kết nối.
- Row: icon tròn theo loại, tên, MAC, chấm trạng thái; thiết bị bị chặn hiện chữ đỏ "Đã chặn".
- Chi tiết: thông tin (loại, MAC, kết nối qua SSID), toggle **"Chặn kết nối Internet"**, dòng đỏ "Xoá thiết bị khỏi kết nối".
- Đổi tên/Icon: tên ≤ 32 ký tự, lưới 8 icon, "Lưu thay đổi".

### Modem (XD s04, Figma 26:29)
- "Model01" + badge ONT, nút "Khởi động lại"; Thông tin thiết bị: Tên (bút), MAC, IP WAN, Firmware, Thời gian hoạt động, Tổng lưu lượng *, Nhiệt độ * → **giao diện hiện tại đã khớp**, chỉ cần restyle theo token.

### Chất lượng (XD s05–s08, Figma 26:24/25)
- Chạy kiểm tra **ngay tại tab**, không chuyển màn. Tự đo lại mỗi khi vào tab nếu lần đo gần nhất đã quá 30 phút; hiện "Đo lần gần nhất".
- Stepper 3 bước có nhãn: **Đường truyền → Sóng Wi-fi → Thiết bị kết nối**; "Đang kiểm tra… / Vui lòng đợi trong giây lát" → "Hoàn tất kiểm tra"; có progress bar.
- Kết quả kiểm tra:
  - Đường truyền Internet: **Ổn định** · **Chập chờn** (kèm nút "Reset Modem") · **Mất kết nối** ("Vui lòng kiểm tra lại nguồn Modem").
  - Sóng Wi-fi: **Đạt** · **Chưa đạt** · **Không có**.
  - Thiết bị kết nối: "Số lượng: N" + chevron → chuyển sang tab Thiết bị kết nối.
- ⇒ **Khác hẳn** speed-test hiện tại (download/upload/latency). Cần làm lại.

## 3. Luồng iOS đo bằng AirPort Utility (XD s29–s33, Figma 26:92…26:104)
- Chưa có app AU → sheet "Cần ứng dụng AirPort Utility" + "Tải trên App Store" → quay lại → "Đo bằng AirPort Utility" + "Nhập kết quả đo".
- Đã có app AU, đo lần đầu → hướng dẫn đầy đủ 4 bước + "Mở AirPort Utility" / "Tôi đã có kết quả, nhập ngay".
- Đã có app AU, đo từ lần 2 → bản rút gọn + link "Xem hướng dẫn".
- Nhập RSSI: tiền tố "−" cố định, hậu tố "dBm"; xem trước mức sóng ngay khi nhập; "Lưu kết quả" bị disable khi ô trống → sheet kết quả + "Đo lại".
- Ngưỡng (đọc được gần đúng từ ghi chú): ≥ −60 Tốt/Khoẻ · −60…−70 Trung bình · < −70 Yếu.
- **Rủi ro khả thi:** AirPort Utility không có URL scheme được công bố → không phát hiện chắc chắn được app đã cài hay chưa, cũng không mở thẳng được app.

## 4. Design tokens (lấy mẫu pixel từ XD)

**Màu**

| Token | Giá trị |
|---|---|
| primary | `#087681` |
| primary-soft | `#E5F5F5` |
| bg page | `#F4F7FC` |
| surface | `#FFFFFF` |
| input | `#F2F6FC` |
| track / chip trung tính | `#E8EDF3` |
| divider | `#EFF2F7` |
| text | `#13263D` |
| text-secondary | `#53677D` |
| text-muted / disabled | `#8A9AAF` |
| chevron | `#B8C2D0` |
| scrim | `rgba(0,0,0,.18)` |
| online | `#1BD764` |
| warning | `#FD9C17` |
| danger | `#FA2626` |
| wifi-icon | `#0056DD` |

**Màu theo mức sóng**

| Mức | Nền | Viền / icon | Chữ |
|---|---|---|---|
| Yếu | `#FFEDED` | `#FA3D3D` | `#FA2626` |
| Trung bình | `#FFF2DF` | `#FCCD30` | `#A65B0B` |
| Khoẻ | `#EDF6E9` | `#4ECD7D` | `#02BA4A` |

**Typography** (đoán là *Be Vietnam Pro*): hero 28/700; header 20/600; tiêu đề sheet 18–20/600; tiêu đề section/card và chữ trên nút 16/600; body 14/400 (giá trị 14/600); tab 14/500; caption 12; micro 10–11; nhãn chữ hoa 12–13/600.

**Hình khối**

| Thành phần | Bo góc |
|---|---|
| Nút chính | 14–16 |
| Card | 12 |
| Sheet (góc trên) | 20 |
| Tile / alert / banner / input | 8 |
| Tab / chip / badge | pill |

**Kích thước:** nút cao 48–50; track tab 36; row danh sách 70; nút đóng 36 (tròn).

**Khoảng cách:** lề màn 16–20; padding card 16; gap 8–12; lưới 4/8pt.

**Shadow:** card `0 2px 8px rgba(19,38,61,.06)`; popover và dialog đậm hơn.

**Component**
- Icon nét 1.5px kiểu Lucide, màu teal trên nền tròn `#E5F5F5`.
- Nút chính đặc teal; nút phụ viền teal; nút disabled nền `#8A9AAF`.
- Toggle kiểu iOS; toast teal full-width.

## 5. Comment PO trong XD (yêu cầu thay đổi)
1. Đổi nhãn hợp đồng thành "Ngày đăng ký / Ngày hết hạn"; thêm nút "Thanh toán ngay / Gia hạn ngay"; đổi tiêu đề "Quản lý Internet" thành "Internet".
2. Bỏ khối tổng hợp "4 khoẻ 2 TB 1 Yếu"; phòng yếu lên đầu; **không gắn vị trí theo mesh**; tối đa 3 tile mỗi hàng.
3. Tab Tất cả: thiết bị đang kết nối lên trước.
4. Chất lượng: theo kịch bản 3 bước ở §2; bấm "Số lượng" → tab Thiết bị kết nối; chạy tại chỗ, không chuyển màn.
5. Edit Wifi – 2 có câu hỏi "Lưu và đo ngay?" — có vẻ đặt nhầm màn, cần PO xác nhận.
6. Sửa lỗi chính tả "giữ máy trong khoảng 8 giây".
7. Các màn Tự đo và AU vẫn dùng nhãn cũ "Lần thanh toán…" → theo Wifi – 1 (bản đã sửa).
