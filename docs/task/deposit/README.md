# Deposit Flow – Test Guide

## 1. Mục tiêu
- Minh họa luồng nạp credit thông qua SDK `@solana-payment/sdk` trên client.
- Kiểm tra backend webhook `/webhook/deposit` có nhận và xử lý payload on-chain đúng hay không.
- Cung cấp file HTML test thủ công (không cần build UI chính) để bạn verify end-to-end.

## 2. Kiến trúc luồng
1. **Client** (UI/Phaser hoặc file HTML test)
   - Người dùng chọn số lượng token muốn nạp.
   - Gọi endpoint backend `POST /wallet/deposit` (đề xuất) để lấy metadata phục vụ SDK (ví đích, token mint, memo, minimum amount…).
   - Khởi tạo SDK `@solana-payment/sdk` để ký & gửi transaction từ Phantom.
2. **On-chain**
   - Transaction gửi token/thanh toán đến ví hệ thống.
3. **Webhook**
   - Dịch vụ indexer (hoặc Solana webhook) gửi payload về `POST /webhook/deposit`.
   - Backend xác thực signature, cập nhật transaction log (`transactions`), cộng credit (`wallet_balances`).
4. **Client cập nhật số dư**
   - Sau khi transaction gửi đi, client poll `GET /wallet/credit` (hoặc subscribe realtime) cho đến khi credit tăng → thông báo “Deposit thành công”.

## 3. Chuẩn bị trước khi test
- Backend đang chạy tại `http://localhost:2567` (điều chỉnh nếu khác).
- Thiết lập biến môi trường:
  - `WALLET_DEPOSIT_TOKEN_MINT`: mint của token sử dụng trong game.
  - `WALLET_TOKEN_DECIMALS`: số chữ số thập phân của token (mặc định 6).
  - (Tuỳ chọn) `WALLET_WEBHOOK_SECRET`: secret để xác thực webhook.
- Phantom cài trên trình duyệt và bật *Allow Message Signing*.
- Nếu dùng webhook giả lập, chuẩn bị payload mẫu (xem mục 6).

## 4. API hiện có
- `POST /wallet/deposit`: trả về metadata (token mint, decimals, amount, referenceCode, memo). **Không** yêu cầu JWT; chỉ cần truyền `walletAddress` và `amount`.
- `GET /wallet/credit` (auth bắt buộc): trả về credit hiện có dạng chuỗi.
- `POST /webhook/deposit`: nhận payload từ indexer/webhook, cộng vào credit.

> Lưu ý: `POST /wallet/deposit` hiện trả thông tin cơ bản (destination, mint, memo, referenceCode). Bạn có thể mở rộng thêm khi tích hợp SDK thực tế (ví dụ thêm reference public key, instruction sơ bộ, ...).

## 5. Sử dụng file `test-deposit.html`
File `docs/task/deposit/test-deposit.html` gồm 3 phần chính:
1. **Phantom & cấu hình**: nhập backend URL, connect ví.
2. **Gọi SDK (bước Deposit)**:
   - Nhập số lượng muốn nạp.
   - Bấm “Tạo giao dịch deposit” để gọi `POST /wallet/deposit`.
   - Khi backend trả về metadata, script sẽ thử dynamic import `@solana-payment/sdk` và gọi `client.sendPayment(...)` (nếu SDK sẵn sàng). Nếu bạn chưa có endpoint này, kết quả sẽ hiển thị raw response để bạn so sánh.
3. **Test webhook thủ công**:
   - Nhập JSON payload webhook và bấm “Gửi webhook test” → script `fetch` đến `/webhook/deposit`.
   - Mục đích là giả lập indexer gửi dữ liệu giúp bạn verify backend.

### Cách chạy
```bash
cd docs/task/deposit
python3 -m http.server 5600
```
Sau đó mở `http://localhost:5600/test-deposit.html` bằng trình duyệt có Phantom.

## 6. Payload webhook mẫu
```json
{
  "event": {
    "signature": "2CdXtZgwdscFxPkWWqARJLE6YCV7S1nN12V1wEbkQ3qYuz4hZQtMdfJPUYyK8CvVFpzgt2nLJrhCeDjXqivW4Y5N",
    "slot": 420122255,
    "blockTime": 1762592529,
    "eventType": "DepositEvent",
    "data": {
      "user": "CWZDCmkzzBSwQVMLaJ3ALpSAKJ9oGQoo9Jn8oN2TrNz",
      "amount": "1000000"
    },
    "success": true
  },
  "timestamp": 1762601253479,
  "indexerVersion": "1.0.0"
}
```
Bạn có thể dán payload này vào vùng Webhook của file HTML (nhớ chỉnh `user`, `amount`).

## 7. Checklist khi test
- [ ] Connect Phantom thành công.
- [ ] Gọi `POST /wallet/deposit` trả về metadata hợp lệ.
- [ ] SDK thực hiện transaction (hoặc hiển thị lỗi rõ ràng nếu chưa tích hợp).
- [ ] Webhook `/webhook/deposit` nhận payload → DB `transactions` và `wallet_balances` tăng.
- [ ] Client poll `GET /wallet/credit` thấy số dư cập nhật (có thể kiểm tra bằng tool khác nếu UI chưa sẵn).

## 8. Ghi chú
- Nếu chưa cài `@solana-payment/sdk`, tập tin test sẽ cảnh báo; bạn vẫn có thể sử dụng phần webhook thủ công.
- Khi move vào UI thật, nên đóng gói logic đồng bộ credit vào service chung (tương tự AuthService trên client).
- Đảm bảo mọi log, thông báo trong sản phẩm chính đều bằng tiếng Anh theo MDC.
