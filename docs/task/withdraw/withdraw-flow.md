## Luồng Rút Tiền & Tương Tác Database

### 1. Điều kiện chuẩn bị
- Biến môi trường:
- `WALLET_PAYMENT_BASE_URL`: endpoint payment server (ví dụ `https://payment-server-production-84a0.up.railway.app/api/transfer`).
- Người dùng đã đăng nhập (JWT hợp lệ) và có số dư trong bảng `wallet_balances`.

### 2. API `POST /wallet/withdraw`
1. **Nhận request**
   - Body: `{ recipientAddress: string, amount: number }`.
   - Nest validate:
     - `recipientAddress` bắt buộc & kiểm tra định dạng Solana (`IsSolanaAddress`).
     - `amount` > 0 (tối thiểu `0.000001`).
   - Guard JWT lấy `userId` thông qua decorator `@CurrentUserId`.

2. **Service xử lý (`WalletService.withdraw`)**
   1. Đọc cấu hình payment từ `ConfigService` (`wallet.payment`).
      - Nếu `baseUrl` trống → ném `UnauthorizedException("Payment service is not configured")`.
   2. Gọi `getUser(userId)`:
      - Query bảng `users`.
      - Nếu không tìm thấy → `UnauthorizedException("User not found")`.
   3. Gọi `getOrCreateWalletBalance(userId)`:
      - Query bảng `wallet_balances`.
      - Nếu chưa có → tạo record với `available_amount = locked_amount = 0`.
   4. Kiểm tra số dư:
      - Ép `availableAmount` sang number, so sánh với `amount`.
      - Thiếu tiền → `BadRequestException("Insufficient balance")`.
   5. Tạo transaction pending:
      - Gọi `createPendingWithdrawalTransaction(...)`.
      - Insert vào bảng `transactions`:
        - `type = withdraw`, `status = pending`, `amount` format theo `tokenDecimals`.
        - `reference_code = uuid`, metadata chứa `recipientAddress`.
   6. Gọi payment server (`requestPaymentTransfer`):
      - HTTP POST `baseUrl + transferPath`.
      - Body: `{ recipientAddress, amount }`.
      - Header: `Content-Type: application/json` + `Authorization: Bearer <apiKey>` (nếu có).
      - Timeout theo `timeoutMs`.

3. **Nhận phản hồi từ payment server**
   - `success: true`:
     1. `finalizeSuccessfulWithdrawal(...)`:
        - Cập nhật transaction:
          - `status = confirmed`, `signature = response.signature`.
          - `metadata.transfer = { signature, transactionId, ... }`.
          - `processed_at = now`.
        - Gọi `updateWalletBalance(userId, -amount, transaction.id)`:
          - Trừ `available_amount` trong `wallet_balances`.
        - Lấy lại balance mới (để trả về client).
     2. Response về controller:
        - Dữ liệu gồm `signature`, `transactionId`, `recipientAddress`, `amount`, `mintAddress`, `senderAddress`, `tokenAccountCreated`, `availableAmount`.
     3. Interceptor `FormatResponseInterceptor` đóng gói thành `BaseResponse`.
   - `success: false` hoặc lỗi:
     1. Hàm `handleAxiosError` map lỗi:
        - HTTP 429: `TooManyRequestsException` với message/retryAfter từ payment server (truyền ra client).
        - HTTP 4xx khác: `BadRequestException`.
        - HTTP 5xx/timeout: `InternalServerErrorException`.
     2. `finalizeFailedWithdrawal(...)`:
        - Cập nhật transaction `status = failed`.
        - Lưu `metadata.error = { status, message, data }` (tùy loại lỗi).
     3. Exception được ném lên controller → interceptor trả về chuẩn lỗi.

### 3. Bảng liên quan & trường cập nhật
- `transactions`
  - Bản ghi mới với `type = withdraw`, `status = pending`.
  - Thành công → update `status = confirmed`, `signature`, `metadata.transfer`, `processed_at`.
  - Thất bại → update `status = failed`, `metadata.error`, `processed_at`.
- `wallet_balances`
  - `updateWalletBalance` trừ `available_amount`, cập nhật `last_transaction_id`.
  - Giữ nguyên `locked_amount` (chưa lock khi withdraw).

### 4. Ghi chú mở rộng
- Nếu cần lock trước khi call payment: bổ sung cột lock & transaction DB (chưa triển khai).
- Hiện tại withdraw không charge fee, có thể mở rộng thêm `feeAmount` trong metadata + trừ riêng.
- Với retry duplicate (429), client nên đọc `retryAfter` và disable nút trong khoảng 60s.
- Log backend nằm trong metadata transaction → dùng để đối soát khi có lỗi từ payment server.


