# Kế Hoạch Mở Rộng Hệ Thống Snake Multiplayer

Tài liệu này tổng hợp các yêu cầu vừa thống nhất, mô tả luồng chức năng chi tiết, kiến trúc đề xuất và kế hoạch triển khai khi mở rộng dự án.

---

## 1. Kiến Trúc Tổng Quan

- **Client (UI hiện tại bằng Phaser)**

  - Thêm đăng nhập Phantom, lưu JWT.
  - Bổ sung chọn loại phòng: `Free` vs `VIP`.
  - Phần VIP yêu cầu kiểm tra credit trên server trước khi join.

- **Server mới (NestJS)**

  - Áp dụng bộ khung [`startkit-nest`](https://github.com/0xmarkhydra/startkit-nest).
  - Module chính: Auth, Users, Wallet, Game, Webhook, Transactions.
  - Sử dụng PostgreSQL làm database trung tâm.

- **Database (PostgreSQL)**  
  Các bảng cốt lõi:
  - `users`: id, walletAddress, displayName, createdAt.
  - `user_sessions`: userId, jwtId, issuedAt, expiresAt.
  - `wallet_balances`: userId, credit (token unit).
  - `transactions`: id, userId, type (`deposit`/`withdraw`), amount, signature, status, metadata, createdAt.
  - `kill_logs`: id, killerId, victimId, roomType, amountEarned, createdAt.

---

## 2. Luồng Chức Năng

### 2.1 Đăng Nhập Phantom & Phát JWT

1. Client yêu cầu nonce từ API `POST /auth/nonce`.
2. Người dùng ký nonce bằng ví Phantom (client-side).
3. Client gửi `POST /auth/verify` kèm chữ ký → server Nest verify.
4. Nếu hợp lệ:
   - Tạo/đọc `users` theo walletAddress.

- Cập nhật bảng `user_sessions`.
- Phát JWT (payload gồm userId, wallet, exp).

5. Client lưu JWT (localStorage hoặc sessionStorage) và gắn vào mọi request.

### 2.2 Tham Gia Room Free

1. Người dùng có thể vào `Free` mà không cần nạp.
2. Client gọi Colyseus room `snake_game` như hiện tại.
3. Server Colyseus chạy như phiên bản cũ (chỉ update cosmetic/leaderboards nếu cần).

### 2.3 Tham Gia Room VIP

1. Client yêu cầu đang sở hữu ít nhất 1 credit (token) trên server.
2. Nếu chưa có credit: chuyển đến luồng nạp (2.4).
3. Sau khi credit ≥1: client được phép tham gia Colyseus room `snake_game_vip` (server xác thực JWT khi join).
4. Trạng thái `SnakeGameState` mở rộng để chứa `credit` cho từng player (đồng bộ với DB khi vào trận).

### 2.4 Nạp Token (Deposit)

1. Trong UI, user nhấn “Nạp token VIP” (số lượng tùy chọn, tối thiểu 1 token).
2. Client gọi SDK `@solana-payment/sdk` → thực hiện giao dịch gửi token đến smart contract (mint: `EweSxUxv3RRwmGwV4i77DkSgkgQt3CHbQc62YEwDEzC9`).
3. Sau khi transaction gửi đi: client bắt đầu polling `GET /wallet/credit` mỗi 2 giây.
4. Webhook (2.5) cập nhật DB; khi credit ≥1 → client cho phép join room VIP.

### 2.5 Webhook Deposit

1. Bên thứ ba gửi webhook JSON:
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
2. Endpoint Nest `/webhook/deposit` (bảo vệ secret).
3. Server xác thực signature + eventType, tra user qua `walletAddress`.
4. Ghi bảng `transactions` (type = deposit, amount = 1 token).
5. Cộng số dư trong `wallet_balances`.
6. Trả về 200 để webhook biết đã xử lý.

### 2.6 Chia Thưởng 90/10 Trong Room VIP

1. Khi `playerKilled` (kẻ giết có JWT hợp lệ):
   - Server Colyseus gọi API nội bộ tới Nest: `POST /game/kill` kèm killerId, victimId.
   - Nest kiểm tra credit của victim. Nếu victim còn `credit >= 1`, trừ 1 credit.
   - Cộng `+0.9` credit cho killer (giữ lại 0.1 trong quỹ hệ thống).
   - Ghi log vào `kill_logs` và `transactions` (type = reward).
2. Colyseus broadcast cập nhật credit hiện tại tới các client trong phòng.

### 2.7 Rút Token (Withdraw)

1. Người dùng gửi yêu cầu rút: `POST /wallet/withdraw` với `amount`.
2. Server kiểm tra credit khả dụng.
3. Nếu đủ:
   - Tạo record `transactions` (type = withdraw, status = pending).
   - Gọi API bên thứ ba:
     ```bash
     curl --location 'https://payment-server-production-84a0.up.railway.app/api/transfer' \
       --header 'Content-Type: application/json' \
       --data '{ "recipientAddress": "...", "amount": 11 }'
     ```
   - Nhận response → cập nhật trạng thái transaction (success/failed) và số dư (trừ ngay hoặc chờ confirm tùy theo yêu cầu).
   - Log đầy đủ.

---

## 3. Kế Hoạch Triển Khai (Đề Xuất)

### Giai đoạn 1 – Chuẩn bị hạ tầng

- Fork/start `startkit-nest`, cấu hình environment.
- Kết nối PostgreSQL, tạo migration cho các bảng trên.
- Thêm module Auth (nonce, verify, JWT).
- Thêm module Users, Wallet (credit CRUD).
- Tạo service gọi API bên thứ ba (HTTP module).

### Giai đoạn 2 – Tích hợp với game

- Tạo endpoint webhook deposit, kiểm tra bảo mật.
- API polling `GET /wallet/credit`.
- API join room VIP `POST /game/rooms/vip/token` (trả về ticket/flag để Colyseus xác thực).
- Cập nhật server Colyseus để:
  - Phân tách `snake_game` và `snake_game_vip`.
  - Gửi `playerKilled` => Nest API chia thưởng.

### Giai đoạn 3 – UI/Client

- Tích hợp Phantom login (wallet adapter) + lưu JWT.
- MenuScene: hiển thị nút Free/VIP.
- Tạo màn hình nạp token & polling trạng thái credit.
- Hiển thị credit trong HUD, cộng điểm khi kill.
- Form rút token (gọi API Nest).

### Giai đoạn 4 – Kiểm thử & bảo trì

- Viết test cho module Auth, Wallet, Webhook, Game reward.
- Kiểm tra luồng deposit → webhook → join VIP.
- Kiểm tra kill reward 90/10 với nhiều user.
- Test withdraw (thành công/thất bại).
- Thiết lập logging & monitoring cơ bản.

---

## 4. Sơ Đồ Luồng (Mô Tả Văn Bản)

### 4.1 Đăng nhập & vào phòng VIP

```
Client -> Auth API: request nonce
Auth API -> Client: nonce
Client -> Phantom: sign nonce
Client -> Auth API: wallet + signature
Auth API -> Client: JWT
Client -> Wallet API: GET credit (polling)
Webhook -> Wallet API: confirm deposit => credit++
Client -> Wallet API: credit >= 1
Client -> Game API: request VIP access
Game API -> Client: OK
Client -> Colyseus (snake_game_vip): join
```

### 4.2 Kill reward

```
Colyseus (VIP room) detects kill
Colyseus -> Game API: killer, victim
Game API -> DB: update balances (victim -1, killer +0.9)
Game API -> Colyseus: new balances
Colyseus -> Clients: broadcast credit updates
```

### 4.3 Withdraw

```
Client -> Wallet API: withdraw request
Wallet API -> DB: check balance, create transaction
Wallet API -> Third-party API: transfer
Third-party API -> Wallet API: result
Wallet API -> DB: update status, adjust balance
Wallet API -> Client: response
```

---

## 5. Ghi Chú & Mở Rộng

- Luồng webhook cần idempotent (dựa vào signature) để tránh cộng credit nhiều lần.
- Các API nội bộ (Colyseus → Nest) nên có auth token riêng.
- Có thể cân nhắc queue (BullMQ) nếu webhook/withdraw cần retry.
- Khi triển khai thực tế, cần thêm rate-limit cho polling và chống spam withdraw.
