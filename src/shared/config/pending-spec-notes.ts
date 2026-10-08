/**
 * Open questions to confirm with the partner/backend team.
 * Rendered as hover/tap tooltips via `SpecNote` while spec notes are enabled,
 * and doubles as the checklist to send to the partner. Remove an entry once agreed.
 * Developer-facing copy: intentionally not in i18n resources.
 */
export const pendingSpecNotes = {
  modemUptime:
    'Thời gian hoạt động liên tục: `uptimeSec` có thể null (G-06). Đang hiện "—" khi thiếu; xác nhận mốc tính là lần khởi động gần nhất.',
  modemTotalTraffic:
    'Tổng lưu lượng (*): `totalTrafficBytes` tính trong khoảng nào (từ lần khởi động / theo tháng)? Dấu * trên XD nghĩa là gì? (G-07)',
  modemTemperature:
    'Nhiệt độ modem (*): model nào không hỗ trợ (đang hiện "—" khi null)? Có ngưỡng cảnh báo không? (G-07)',
  contractPayment:
    'Nút "Thanh toán / Gia hạn ngay" gọi bridge openPayment({contractCode}) (S-10). Host hiện chưa hỗ trợ nên nút đang ẩn.',
  contractSelection:
    'Chọn hợp đồng bằng danh sách thả xuống trong khối "Thông tin hợp đồng": XD chưa vẽ (D-01), đang dùng <select> native.',
  noServiceSlides:
    'Màn "Chưa có dịch vụ": nội dung slide 2–5 của carousel chưa có (Q19), đang lặp lại slide 1.',
  internetShopDeeplink:
    'Deeplink VNPT Shop > Đăng ký Internet (S-06), đang tạm dùng "myvnpt://vnpt-shop/internet".',
  wifiQrDisabledNetwork:
    'Chia sẻ QR khi mạng Wi-Fi đang tắt (M-08, URD §IV.3.5): đang vẫn hiện QR kèm thông báo mạng đang tắt.',
  measurementLocationLimit:
    'Khi đã đủ 20 vị trí đo (VT-01): XD chưa có màn riêng (D-05, M-10). Đang ẩn ô "Thêm vị trí" và hiện dòng chú thích này.',
  deviceRemoval:
    'Cách "Xoá thiết bị khỏi kết nối" (G-10, M-15): đang giả định là chặn Internet rồi ẩn khỏi danh sách; thiết bị có thể xuất hiện lại khi kết nối lại.',
  healthRecheckButton:
    'Nút "Kiểm tra lại" không có trong XD; thêm để người dùng chạy lại kiểm tra (POST mới, chặn khi đang chạy). Cần PO xác nhận.',
} as const;

export type PendingSpecNoteId = keyof typeof pendingSpecNotes;
