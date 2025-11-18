# Kế Hoạch Chi Tiết Update Room VIP

Tài liệu này mô tả chi tiết những việc cần làm để nâng cấp hệ thống hiện tại, bổ sung room `snake_game_vip` với cơ chế credit/thưởng. Nội dung chia thành hai phần chính: backend (NestJS + PostgreSQL + Colyseus server) và client (Phaser/React). Mục tiêu bảo đảm mọi thao tác liên quan đến tiền đều được kiểm soát chặt chẽ server-side, giảm tối đa nguy cơ gian lận.

---

## 1. Mục Tiêu & Phạm Vi

- Cho phép người chơi đăng nhập bằng Phantom, nạp credit, tham gia room VIP, nhận thưởng 90/10 khi kill.
- Giữ nguyên flow phòng Free hiện tại.
- Đảm bảo trạng thái credit luôn đồng bộ giữa server NestJS, Colyseus và client.
- Tạo nền tảng cho việc audit, monitoring và mở rộng sau này (leaderboard VIP, nhiệm vụ...).

---

## 2. Backend (NestJS + PostgreSQL)

### 2.1 Kiến Trúc Module

- **Auth Module**: nonce, verify signature, phát JWT. Middleware decode JWT cho các route bảo vệ.
- **Users Module**: quản lý thông tin người dùng (wallet, displayName).
- **Wallet Module**: số dư credit, deposit (webhook), withdraw.
- **Game Module**: control room VIP, phát ticket, xử lý kill, đồng bộ với Colyseus.
- **Transactions Module**: log mọi biến động credit (deposit, reward, withdraw, fee).

### 2.2 Database Schema (Migration)

| Bảng | Cột chính | Ghi chú |
|------|-----------|---------|
| `users` | `id`, `wallet_address`, `display_name`, `created_at` | Unique index trên `wallet_address`. |
| `user_sessions` | `id`, `user_id`, `jwt_id`, `issued_at`, `expires_at` | Hỗ trợ revoke token. |
| `wallet_balances` | `user_id`, `credit`, `updated_at` | One-to-one với `users`. |
| `transactions` | `id`, `user_id`, `type`, `amount`, `status`, `reference_id`, `metadata`, `created_at` | `type`: deposit, reward, fee, withdraw. |
| `vip_tickets` | `id`, `user_id`, `entry_fee`, `room_type`, `room_instance_id`, `consumed_at`, `expires_at`, `status` | `status`: issued, consumed, cancelled. |
| `kill_logs` | `id`, `room_instance_id`, `killer_user_id`, `victim_user_id`, `reward_amount`, `fee_amount`, `created_at` | Lưu lịch sử kill. |
| `vip_room_config` | `id`, `room_type`, `entry_fee`, `reward_rate_player`, `reward_rate_treasury`, `respawn_cost`, `max_clients`, `tick_rate`, `created_at` | Cho phép thay đổi config không sửa code. |
| `webhook_logs` (optional) | `id`, `source`, `payload_hash`, `status`, `created_at` | Đảm bảo idempotent webhook. |

### 2.3 API & Service Flow

1. **Check quyền vào VIP**  
   - `POST /game/rooms/vip/check`  
     - Input: JWT (header), optional `roomType`.  
     - Validate credit ≥ `entry_fee`. Nếu đủ, tạo `vip_ticket` (status `issued`).  
     - Output: `{ canJoin, ticketId, credit, config }`.

2. **Consume ticket khi join thành công**  
   - `POST /game/rooms/vip/consume`  
     - Input: `{ ticketId, roomInstanceId }`.  
     - Kiểm tra ticket `issued`, đánh dấu `consumed_at`, trừ `entry_fee` khỏi `wallet_balances`, ghi `transactions` (fee).  
     - Trả credit mới để Colyseus sync.

3. **Xử lý kill reward**  
   - `POST /game/vip/kill`  
     - Input: `{ killerTicketId, victimTicketId, killId, roomInstanceId }`.  
     - Transaction DB:  
       - Map ticket → user.  
       - Kiểm tra `killId` chưa xử lý (idempotent).  
       - Nếu victim credit ≥ `reward_rate_player + reward_rate_treasury` (thường = 1):  
         - Trừ credit victim.  
         - Cộng `reward_rate_player` cho killer.  
         - Ghi phí treasury (`reward_rate_treasury`, ví dụ 0.1).  
         - Lưu `kill_logs`, `transactions`.  
       - Trả về `{ killerCredit, victimCredit }`.  
     - Nếu victim không đủ credit → trả `errorCode` để Colyseus bỏ qua reward.

4. **Respawn thu phí (nếu có)**  
   - `POST /game/vip/respawn`  
     - Input: `{ ticketId }`.  
     - Nếu `respawn_cost > 0`, trừ credit và trả credit mới.

5. **Webhook deposit**  
   - `POST /webhook/deposit`  
     - Verify signature/secret, check `payload_hash` chống duplicate.  
     - Tăng credit, ghi `transactions` (deposit).  
     - Trả 200 ngay cả khi duplicate (đã xử lý) để tránh retry vô hạn.

6. **Withdraw**  
   - `POST /wallet/withdraw` → tạo transaction `pending`, call service bên ngoài, update kết quả.

### 2.4 Bảo Mật & Logging

- JWT kiểm tra ở middleware, attach `userId` vào request.
- Nest ↔ Colyseus dùng API key riêng (header `x-internal-key`), whitelist IP.
- Mọi transaction liên quan tiền đều chạy trong DB transaction (TypeORM manager).
- Log event quan trọng (issue ticket, consume, reward, withdraw) để audit.
- Rate limit trên các endpoint public (`/wallet/credit`, `/wallet/withdraw`).

---

## 3. Colyseus Server (Node.js)

### 3.1 Room `snake_game_vip`

- **onAuth**  
  - Nhận `{ jwt, ticketId }`.  
  - Gọi Nest `/game/rooms/vip/check-ticket` (hoặc reuse `/consume`) để xác thực ticket, lấy `userId`, `credit`, config.  
  - Nếu fail → reject join.

- **onJoin**  
  - Lưu `player.ticketId`, `player.userId`, `player.credit`.  
  - Nếu `entry_fee` > 0 và chưa trừ, call `/game/rooms/vip/consume`.  
  - Broadcast `creditUpdated`.

- **Game Loop**  
  - Giữ nguyên logic di chuyển, food.  
  - Khi `checkPlayerCollisions` phát hiện kill:  
    - Tạo `killId` (UUID).  
    - Gọi Nest `/game/vip/kill`.  
    - Nếu trả về success → cập nhật `player.credit` cho killer/victim, emit `creditUpdated`.  
    - Nếu lỗi (ví dụ timeout) → retry 1 lần; nếu tiếp tục lỗi, log và không phát thưởng (fail-safe).

- **Respawn**  
  - Khi client gửi `respawn`, nếu config có `respawn_cost`, call `/game/vip/respawn`.  
  - Nếu trả credit < cost → thông báo client rời phòng hoặc chuyển sang spectator.

- **onLeave**  
  - Gửi `POST /game/rooms/vip/leave` (optional) để backend cập nhật trạng thái ticket nếu player disconnect sớm.  
  - Nếu player reconnect trong grace period, cho phép join lại với ticket cũ.

### 3.2 Logging & Monitoring

- Log nội bộ: ticketId, userId, roomInstanceId cho mỗi event quan trọng.  
- Sử dụng `pino` hoặc tương đương, gửi log tới hệ thống tập trung nếu có (ELK, CloudWatch...).
- Metric: số kill, tổng reward, error rate khi call backend.

---

## 4. Client (React + Phaser)

### 4.1 Auth & State Management

- Tạo service `AuthStore` (hoặc reuse context hiện có) để lưu JWT, thông tin user.
- Sau khi login Phantom, lưu JWT vào `localStorage`, set header mặc định cho API client.

### 4.2 MenuScene Updates

- **UI**  
  - Hai nút `Play Free` và `Play VIP`.  
  - Tooltip hiển thị credit hiện tại và yêu cầu entry fee.
- **Logic**  
  - Khi mở MenuScene, gọi `GET /wallet/credit`, start polling 5s/lần.  
  - Bấm `Play VIP`:  
    1. Call `POST /game/rooms/vip/check`.  
    2. Nếu `canJoin=true`: lưu `ticketId`, `config`, chuyển `scene.start('GameScene', { roomType: 'vip', ticketId })`.  
    3. Nếu false: mở modal hướng dẫn nạp (liên kết tới flow deposit).

### 4.3 GameScene Updates

- **Join Room**  
  - Dựa vào `roomType`. Nếu VIP:  
    - `colyseusClient.joinOrCreate('snake_game_vip', { jwt, ticketId })`.  
    - Chặn input nếu join thất bại, hiển thị thông báo từ backend.
- **HUD**  
  - Thêm widget hiển thị credit hiện tại (đồng bộ qua event `creditUpdated`).  
  - Thêm log nhỏ hiển thị lịch sử reward (killer, amount).  
  - Highlight khi nhận thưởng (`rewardEvent`).
- **Controls**  
  - Giữ nguyên. Riêng `respawn`: nếu backend trả `insufficient_credit`, disable respawn và show popup.

### 4.4 Deposit & Withdraw UI

- Từ menu hoặc HUD, cung cấp nút đi tới màn hình nạp/rút.  
- Deposit: sử dụng SDK hiện có, sau khi submit giao dịch → polling `GET /wallet/credit`.  
- Withdraw: form `POST /wallet/withdraw`, hiển thị trạng thái `pending` / `success`.

---

## 5. Luồng Trình Tự (Sequence Text)

### 5.1 Join VIP

```
Client -> Auth API: (JWT có sẵn)
Client -> Game API: POST /game/rooms/vip/check
Game API -> DB: validate credit, issue ticket
Game API -> Client: ticketId + config
Client -> Colyseus VIP: join(ticketId, jwt)
Colyseus -> Game API: POST /game/rooms/vip/consume
Game API -> DB: trừ entry fee, mark ticket consumed
Game API -> Colyseus: credit mới
Colyseus -> Clients: creditUpdated
```

### 5.2 Kill Reward

```
Colyseus detects kill -> create killId
Colyseus -> Game API: POST /game/vip/kill
Game API -> DB: trừ victim, cộng killer, log transaction
Game API -> Colyseus: killerCredit, victimCredit
Colyseus -> Clients: creditUpdated + rewardEvent
```

### 5.3 Deposit/Withdraw

```
Client -> Phantom SDK: send token
Webhook -> Game API: POST /webhook/deposit
Game API -> DB: update credit, log transaction
Client polling GET /wallet/credit: thấy credit tăng

Client -> Game API: POST /wallet/withdraw
Game API -> DB: create transaction pending
Game API -> Third-party: transfer
Third-party -> Game API: result
Game API -> DB: update status, adjust balance
Game API -> Client: response
```

---

## 6. Kiểm Thử & Triển Khai

- **Unit Test**  
  - Auth: nonce, verify.  
  - Wallet: deposit webhook, withdraw flow.  
  - Game: issue ticket, consume ticket, kill reward (bao gồm idempotent).  
  - Transactions: đảm bảo log chính xác.

- **Integration Test (Staging)**  
  - Flow: deposit → check VIP → join Colyseus → kill → nhận thưởng → withdraw.  
  - Edge cases: thiếu credit, kill liên tiếp nhanh, disconnect giữa chừng, webhook gửi lại.

- **Deployment**  
  - Roll out backend trước (đảm bảo API backward compatible).  
  - Update Colyseus và client sau khi backend ổn định.  
  - Monitor log/metric (số kill, reward, lỗi API) ít nhất 24h.

---

## 7. Checklist Triển Khai

- [ ] **DB & Migration**
  - [ ] Rà soát entity hiện tại (`users`, `wallet_balances`, `transactions`) và bổ sung cột cần thiết (referenceId, metadata JSON).  
  - [ ] Tạo file migration mới `AddVipTicketAndKillTables` (TypeORM) bao gồm bảng `vip_tickets`, `kill_logs`, `vip_room_config`.  
  - [ ] Seed `vip_room_config` mặc định (`entry_fee = 1`, `reward_rate_player = 0.9`, `reward_rate_treasury = 0.1`, `respawn_cost = 0`).  
  - [ ] Viết migration rollback rõ ràng (drop bảng, revert cột).  
  - [ ] Chạy thử migration trên môi trường local/staging DB.

- [ ] **Backend – Module & Service**
  - [ ] Tạo DTO + controller route trong `modules/api/game` cho:  
    - `POST /api/game/rooms/vip/check`  
    - `POST /api/game/rooms/vip/consume`  
    - `POST /api/game/vip/kill`  
    - `POST /api/game/vip/respawn`  
    - `POST /api/game/rooms/vip/check-ticket` (dùng cho onAuth).  
  - [ ] Implement service `VipGameService` xử lý logic ticket, consume, reward với transaction.  
  - [ ] Bổ sung guard JWT cho route client-facing và guard API-key (`x-internal-key`) cho route Colyseus.  
  - [ ] Update `WalletService` để expose hàm `increaseCredit`, `decreaseCredit`, `getCreditByUserId`.  
  - [ ] Viết unit test cho service (mock repository, đảm bảo reward 90/10, idempotent killId).  
  - [ ] Cập nhật swagger (nếu đang dùng) với các endpoint mới.

- [ ] **Colyseus Server**
  - [ ] Tạo file `SnakeGameVipRoom.ts` kế thừa logic từ room thường.  
  - [ ] Trong `onAuth`, gọi API `/api/game/rooms/vip/check-ticket`, reject nếu ticket không hợp lệ.  
  - [ ] Trong `onJoin`, call `/api/game/rooms/vip/consume`, cập nhật `player.credit`.  
  - [ ] Hook vào collision để call `/api/game/vip/kill`, xử lý retry và cập nhật state.  
  - [ ] Thêm broadcast event `creditUpdated`, `rewardEvent` cho client.  
  - [ ] Viết unit/integration test giả lập kill để verify call API.  
  - [ ] Đảm bảo cấu hình room mới được đăng ký trong `game.gateway` hoặc bootstrap.

- [ ] **Client – Menu & Game**
  - [ ] Tạo store/service lưu JWT, credit, config VIP.  
  - [ ] MenuScene:  
    - [ ] Gọi `GET /api/wallet/credit` khi load, start polling.  
    - [ ] Nút `Play VIP`: call `POST /api/game/rooms/vip/check`, xử lý các trạng thái (đủ credit, thiếu, lỗi API).  
  - [ ] GameScene:  
    - [ ] Join room VIP với payload `{ jwt, ticketId }`.  
    - [ ] Lắng nghe message `creditUpdated`, cập nhật HUD.  
    - [ ] Hiển thị history reward (UI đơn giản).  
    - [ ] Xử lý respawn khi thiếu credit (show popup).  
  - [ ] HUD/Menu: bổ sung nút điều hướng nạp/rút (reuse trang hiện có).  
  - [ ] Viết test integration basic (nếu có khả năng, ví dụ Cypress/Playwright stub API).

- [ ] **Testing & QA**
  - [ ] Viết test e2e cho các API VIP (NestJS e2e test).  
  - [ ] Tạo script seed dữ liệu test (user A/B, credit).  
  - [ ] Chạy flow manual: deposit webhook → check VIP → join → kill → reward → withdraw.  
  - [ ] Test edge cases: victim credit < 1, double kill spam, leave room giữa chừng.  
  - [ ] Ghi lại bug/issue vào bảng tracking.

- [ ] **Logging, Monitoring, Ops**
  - [ ] Thiết lập logger cho service mới (level info/error).  
  - [ ] Thêm metric (nếu có Prometheus): `vip_reward_success_total`, `vip_reward_failed_total`.  
  - [ ] Cập nhật alert nếu API `/api/game/vip/kill` fail quá 5%.  
  - [ ] Viết doc vận hành: xử lý khi webhook lỗi, khi reward fail, manual adjust credit.

- [ ] **Deployment**
  - [ ] Tạo plan deploy: backend (Nest) → Colyseus → client.  
  - [ ] Chuẩn bị script rollback (migration down, disable room VIP).  
  - [ ] Cập nhật release note nội bộ.  
  - [ ] Thông báo QA/biz khi deploy staging & production.

---

Tài liệu này là cơ sở để triển khai. Vui lòng rà soát và điều chỉnh thông số (entry fee, reward rate, respawn cost) trước khi coding chính thức.


