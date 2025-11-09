# Authentication API Design

## 1. Mục Tiêu
- Cho phép người chơi đăng nhập bằng ví Solana (Phantom).
- Cấp JWT (access + refresh) để bảo vệ các API khác.
- Quản lý phiên đăng nhập trong `user_sessions` nhằm hỗ trợ revoke, đa thiết bị.
- Đảm bảo mọi response theo chuẩn `StandardResponseDto`.

## 2. Danh Sách Endpoint
| Method | Path | Mô tả |
| --- | --- | --- |
| POST | `/auth/nonce` | Tạo nonce mới cho một wallet |
| POST | `/auth/verify` | Xác thực chữ ký, tạo user nếu chưa có, cấp token |
| POST | `/auth/refresh` | Cấp access token mới từ refresh token |
| POST | `/auth/logout` | Thu hồi session hiện tại |
| GET | `/auth/me` | Lấy thông tin hồ sơ & phiên hiện tại |

## 3. Flow Đăng Nhập Chuẩn
1. Client gọi `POST /auth/nonce` với `walletAddress`.
   - Server tạo `nonce` ngẫu nhiên, lưu tạm (cache/DB) kèm TTL ngắn (ví dụ 2 phút).
   - Trả về nonce cho client.
2. Client yêu cầu người dùng ký nonce bằng Phantom.
3. Client gửi `POST /auth/verify` gồm: `walletAddress`, `signature`, `nonce`.
   - Server kiểm tra nonce hợp lệ (đúng và chưa hết hạn).
   - Xác minh chữ ký bằng Solana Web3 SDK.
   - Nếu `users.wallet_address` chưa tồn tại → tạo user mới.
   - Tạo bản ghi trong `user_sessions`:
     - `user_id` = id user.
     - `jwt_id` = UUID mới (làm `jti`).
     - `refresh_token` = chuỗi ngẫu nhiên hash (lưu dạng hash để an toàn).
     - `expires_at` = now + refresh TTL (ví dụ 7 ngày).
     - `user_agent`, `ip_address` lấy từ request.
   - Tạo access token JWT (TTL ngắn ~15 phút) chứa `sub`, `wallet`, `jti`.
   - Tạo refresh token (gửi plaintext cho client, lưu hash vào DB).
   - Trả về response chuẩn:
     ```json
     {
       "statusCode": 200,
       "message": "Login successful",
       "data": {
         "user": {
           "id": "...",
           "walletAddress": "...",
           "displayName": "..."
         },
         "tokens": {
           "accessToken": "...",
           "refreshToken": "...",
           "expiresIn": 900
         }
       },
       "timestamp": "..."
     }
     ```
4. Client lưu access token (Authorization header) + refresh token (storage an toàn).

## 4. Refresh Token
- Endpoint: `POST /auth/refresh`.
- Request body: `{ "refreshToken": "..." }`.
- Server bước:
  1. Find session bằng refresh token (so sánh hash).
  2. Kiểm tra `expires_at`, `revoked_at`, `deleted_at`.
  3. Nếu hợp lệ → phát access token mới; có thể xoay refresh token (rotate) và cập nhật hash + expires.
  4. Response tương tự bước login (chỉ khác message).
- Nếu phát hiện refresh token bị lộ (không khớp hash) → revoke toàn bộ session user đó.

## 5. Logout
- Endpoint: `POST /auth/logout`.
- Yêu cầu access token hợp lệ (JWT guard).
- Body tùy chọn cho biết có logout mọi thiết bị hay không.
- Server:
  - Xác định session hiện tại qua `jti` trong JWT (`jwt_id`).
  - Cập nhật `revoked_at = now()` / xoá dòng trong `user_sessions`.
  - Nếu logout all: set `revoked_at` cho toàn bộ session của user.

## 6. Thông Tin Người Dùng
- Endpoint: `GET /auth/me`.
- JWT guard bắt buộc.
- Trả về `users` + trạng thái session hiện tại (đọc từ `user_sessions`).
- Dùng decorator `@User()` để inject user đã xác thực.

## 7. Bảo Mật & Best Practices
- Nonce lưu trong cache Redis với key `auth:nonce:{wallet}` và TTL ngắn.
- Signature verify sử dụng `@solana/web3.js` hoặc lib tương đương.
- JWT secret/expiry cấu hình qua `ConfigService` (`AUTH_JWT_SECRET`, `AUTH_JWT_EXPIRES`...).
- Refresh token hash bằng `bcrypt` hoặc `argon2` trước khi lưu.
- Dùng rate limit cho `/auth/nonce` và `/auth/verify` để tránh spam.
- Log audit theo format quy định (`console.log` với icon + class + function).

## 8. Liên Kết Với Database
- `users`: lưu `wallet_address`, `display_name`, `metadata`.
- `user_sessions`:
  - `jwt_id`: lấy từ `jti` của JWT.
  - `refresh_token`: hash.
  - `expires_at`: thời điểm refresh token hết hạn.
  - `revoked_at` / `deleted_at`: đánh dấu session không còn hợp lệ.
- Khi refresh/logout, luôn cập nhật bảng này để giữ đồng bộ.

## 9. Tích Hợp Với Swagger
- Dùng `@ApiTags('Auth')` cho controller.
- Mỗi endpoint mô tả `summary`, `responses` (200, 401, 429...).
- Response sử dụng DTO chuẩn hóa (ví dụ `LoginResponseDto` kế thừa `StandardResponseDto<LoginPayload>`).
- Với `/auth/me`, thêm `@ApiBearerAuth()`.

## 10. Todo Triển Khai
- [ ] Tạo DTO: `NonceRequestDto`, `VerifyRequestDto`, `RefreshRequestDto`, `LogoutRequestDto`.
- [ ] Viết service `AuthService` quản lý nonce, ký, tạo token.
- [ ] Viết guard `JwtAuthGuard` (đã có) + decorator `@User()`.
- [ ] Viết provider lưu nonce (RedisService hoặc CacheModule của Nest).
- [ ] Thêm e2e test: login happy path, refresh, revoke.

## 11. Environment Variables
- `JWT_SECRET_KEY`: secret for signing access tokens.
- `JWT_ACCESS_TOKEN_LIFETIME`: lifetime (seconds) for access token, default 900.
- `JWT_REFRESH_TOKEN_LIFETIME`: lifetime (seconds) for refresh token, default 604800.
- `AUTH_NONCE_TTL`: nonce expiry time in seconds, default 120.

## 12. Implementation Notes
- `AuthService` sử dụng Redis cache (CacheModule) để lưu nonce với key `auth:nonce:{wallet}`.
- Refresh token được hash SHA-256 trước khi lưu vào `user_sessions` (`IDX_user_sessions_refresh_token`).
- Signature verify dựa trên `@solana/web3.js` + `bs58`, message chính là nonce dạng plain text.
- `JwtAuthGuard` kiểm tra session còn hiệu lực dựa trên `jwt_id`, `revoked_at` và `expires_at` trong bảng `user_sessions`.
