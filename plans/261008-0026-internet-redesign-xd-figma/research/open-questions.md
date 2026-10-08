# Câu hỏi mở cho PO / backend / host

Ký hiệu: 🔴 chặn triển khai thật (mock vẫn làm trước được) · 🟡 ảnh hưởng UX, đã có giả định mặc định · ⚪ nhỏ.

Mỗi câu khi chốt xong: ghi kết quả vào đây và gỡ entry tương ứng trong `src/shared/config/pending-spec-notes.ts`.

## Host / Super app bridge
- 🔴 **Q1.** Màn "Đồng bộ tài khoản bằng số điện thoại" (Figma 26:34) do host hay miniapp làm? *Giả định: host.*
- 🔴 **Q2.** Android: host có cung cấp được bridge đọc RSSI hoặc WifiInfo của mạng đang kết nối không (thời gian lấy mẫu, quyền Location, xử lý khi không ở Wi-Fi nhà, khi đang bật VPN)?
- 🔴 **Q3.** iOS: có phát hiện được AirPort Utility đã cài chưa và mở được nó không? AU không có URL scheme công khai. *Giả định: không phát hiện được → người dùng tự chọn "Đã có app / Chưa có app"; trạng thái "đo lần đầu" lưu local theo thiết bị.*
- 🟡 **Q4.** Bridge cho: mở URL ngoài / App Store, copy clipboard, lưu ảnh vào thư viện, share sheet native, toast native, sự kiện app resume. Tên route native cho "Thanh toán / Gia hạn", "Đặt lắp thêm Mesh", "Đăng ký ngay".
- 🟡 **Q5.** Nút X đóng cả miniapp (`superApp.close`)?

## Wifi
- 🔴 **Q6.** API bật/tắt từng SSID, đổi mật khẩu, lấy mật khẩu (có trả mật khẩu dạng plain để hiện, copy và tạo QR không?), lịch bật/tắt (CRUD, cho phép lịch qua đêm, có giới hạn số lịch không, áp dụng cho mọi SSID của modem?).
- 🟡 **Q7.** Đổi tên/mật khẩu áp dụng cho từng băng tần hay cả 2? *Giả định: theo từng SSID.* Có cần cảnh báo "thiết bị sẽ bị ngắt kết nối" không?
- 🟡 **Q8.** Tắt Wi-Fi có cần xác nhận không? *Giả định: có, vì tắt có thể làm mất kết nối tới chính miniapp.*

## Sức khoẻ Wi-Fi theo vị trí
- 🔴 **Q9.** API vị trí đo (CRUD, giới hạn 20, tên duy nhất, tối đa 30 ký tự), kết quả đo, lịch sử 5 lần gần nhất; dữ liệu lưu theo hợp đồng và đồng bộ giữa các thiết bị? Có nguồn dữ liệu do nhân viên kỹ thuật đo không, và có cần đánh dấu riêng không?
- 🟡 **Q10.** Ngưỡng RSSI chính xác cho Khoẻ / Trung bình / Yếu. *Giả định: ≥ −60 / −60…−70 / < −70.* Đo SSID hay băng tần nào khi có cả 2.4G và 5G?
- 🟡 **Q11.** Các điều kiện đo được kiểm tra tự động hay chỉ hiển thị? Huỷ giữa chừng thì sao? Khoảng hợp lệ của RSSI khi nhập tay (−30…−100)?
- ⚪ **Q12.** Copy và giá của "Đặt lắp thêm Mesh"; khi có nhiều phòng yếu thì alert nhắc phòng nào?

## Thiết bị kết nối
- 🔴 **Q13.** API chặn/bỏ chặn, xoá thiết bị (kick tạm thời hay xoá hẳn? khác gì so với chặn?), đổi tên + icon (lưu trên modem hay trên backend của mình?).
- 🟡 **Q14.** Có liệt kê thiết bị offline không? Số đếm trên chip lấy theo toàn bộ hay theo filter?

## Chất lượng
- 🔴 **Q15.** Backend trả về gì cho 3 bước (đường truyền: ổn định/chập chờn/mất kết nối; sóng: đạt/chưa đạt/không có; số thiết bị)? Là 1 endpoint đồng bộ hay async job + polling? Ngưỡng 30 phút tính ở client hay server?
- 🟡 **Q16.** "Reset Modem" trong kết quả có dùng lại luồng khởi động lại modem (có xác nhận) không? *Giả định: có.*

## Hợp đồng
- 🟡 **Q17.** API trả về `registeredAt` / `expiresAt` thay cho lastPayment / nextPayment? Route của nút "Thanh toán / Gia hạn ngay"?

## Thiết kế
- 🟡 **Q18.** Xin link XD **Design Specs** (chế độ inspect) hoặc file export, để có giá trị token chính xác thay cho số đo pixel; xin file font (Be Vietnam Pro?) và bộ icon gốc.
- ⚪ **Q19.** Nội dung 5 slide của màn chưa có dịch vụ; asset hero 3D.
- ⚪ **Q20.** Câu "Lưu và đo ngay?" ở màn Edit Wifi – 2 là đặt nhầm màn?
