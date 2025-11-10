## Luồng Chọn Chế Độ & Nạp Tiền Ngay Trong Game

### 1. Màn Hình Menu – Hai Lựa Chọn Rõ Ràng
- `PLAY FREE`
  - Không cần đăng nhập.
  - Bấm vào → chuyển thẳng sang `GameScene` với tham số `roomType = 'free'`.
- `PLAY VIP`
  - Luôn khả dụng để người chơi nhấn vào (dù chưa đăng nhập).
  - Khi click sẽ chạy các bước kiểm tra bên dưới.
- Góc phải trên:
  - Nếu chưa login: panel nhỏ “Kết nối Phantom” (bấm để chạy bước đăng nhập).
  - Nếu đã login: hiện wallet + credit real-time + nút Logout.

### 2. Xử Lý Khi Người Chơi Chọn VIP
1. **Kiểm tra đăng nhập Phantom**
   - Nếu chưa đăng nhập: mở modal “Kết nối Phantom”.
     - Hiển thị giải thích ngắn.
     - Nút `Kết nối Phantom` gọi `authService.login()`.
     - Sau khi login thành công → quay lại bước kiểm tra credit.

2. **Kiểm tra credit sau đăng nhập**
   - Gọi `walletService.getCredit()` ngay sau khi login và mỗi lần mở modal.
   - Nếu `credit ≥ 1` → đóng modal, gọi `startGame('vip')`.
   - Nếu `credit < 1` → mở modal nạp tiền ngay trong game.

### 3. Modal Nạp Tiền Phục Vụ VIP
- **Thông tin hiển thị**
  - Số dư hiện tại (`walletService.formatCredit()`).
  - Cảnh báo “Cần tối thiểu 1.0 credit để chơi VIP”.
- **Các bước nạp ngay trong modal**
  1. Nhập số lượng token vào ô `Amount`.
  2. Bấm `Deposit` → client tự động:
     - Gọi `POST /wallet/deposit` để lấy metadata.
     - Xây giao dịch qua `VaultSDK`, nhờ Phantom ký & gửi lên Solana.
     - Sau khi confirm, gọi lại `GET /wallet/credit` và so sánh với số dư trước đó.
  3. Nếu credit tăng (≥ 1) → modal đóng, vào VIP ngay. Nếu chưa tăng, hiển thị thông báo chờ webhook.
- **Nút phụ**
  - `Close` để quay lại menu chính (không thoát trạng thái đăng nhập).

### 4. Polling & Cập Nhật Credit
- `walletService.startPolling(3000)` vẫn chạy nền để đồng bộ panel credit.
- Sau mỗi lần thành công ký giao dịch → gọi thủ công `walletService.getCredit()` để cập nhật nhanh.
- Nếu credit thay đổi từ server (webhook) → panel cập nhật, modal kiểm tra lại điều kiện.

### 5. Trạng Thái Hiển Thị Quanh Menu
- Panel góc phải vẫn hiển thị wallet + credit khi đã login.
- Nếu user chưa login → panel ẩn, chỉ hiển thị gợi ý khi mở modal VIP.
- Nút VIP hiển thị tooltip nhỏ:
  - Đã đủ điều kiện: “Ready to play!”
  - Thiếu credit: “Cần ≥1 credit – nhấn để nạp”.

### 6. Lưu Ý Cho Các Bước Tiếp Theo
- Hiện tại VIP room vẫn dùng chung logic với Free room (chưa trừ credit, chưa thưởng kill). Sau khi hoàn thiện connect + nạp, sẽ bổ sung xử lý:
  - Trừ credit khi vào VIP.
  - Chia thưởng khi kill (90/10…).
  - Phân tách phòng VIP/Free ở server.

