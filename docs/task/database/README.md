# SnakeGame Database Overview

## 1. Mục Tiêu & Phạm Vi
- Chuẩn hóa lưu trữ dữ liệu cho backend NestJS (auth, wallet, game, webhook).
- Theo dõi dòng tiền (credit/token) xuyên suốt: nạp, tham gia phòng VIP, chia thưởng, rút.
- Hỗ trợ mở rộng nhiều loại phòng VIP (chi phí 1, 5, 100 token...) mà không phá vỡ dữ liệu cũ.

## 2. Sơ Đồ Tổng Quan
Các nhóm bảng chính:
- **Danh tính & session**: `users`, `user_sessions`.
- **Ví & giao dịch**: `wallet_balances`, `transactions`, `webhook_events`.
- **Trận đấu & vé**: `game_sessions`, `game_session_players`, `game_tickets`.
- **Nhật ký gameplay**: `kill_logs`.
- **Cấu hình hệ thống**: `admin_configs` (đã có sẵn trong codebase).

> Credit hiện tại của user được lấy từ `wallet_balances.available_amount`. Mọi thay đổi credit phải đi qua `transactions` để đảm bảo audit.

## 3. Chi Tiết Từng Bảng
### 3.1 `users`
- Lưu thông tin cơ bản của người chơi.
- `wallet_address` là khóa duy nhất (Solana wallet).
- `display_name`, `avatar_url`, `metadata` lưu dữ liệu hiển thị/phụ.

### 3.2 `user_sessions`
- Theo dõi phiên đăng nhập, phục vụ bỏ token (JWT revoke, device management).
- `jwt_id` (jti) và `refresh_token` giúp kiểm soát từng session.

### 3.3 `wallet_balances`
- Một user ⇢ một dòng (unique `user_id`).
- `available_amount`: credit có thể dùng ngay.
- `locked_amount`: credit tạm giữ (ví dụ yêu cầu rút đang chờ duyệt).
- `last_transaction_id`: liên kết tới giao dịch gần nhất để dễ truy vết.

### 3.4 `transactions`
- Ghi log mọi biến động credit với enum:
  - `type`: deposit, withdraw, reward, penalty, system_adjust.
  - `status`: pending, confirmed, failed, reversed.
- `amount`, `fee_amount`, `signature`, `reference_code`, `metadata` phục vụ audit.
- `webhook_event_id` kết nối với payload gốc (nếu giao dịch sinh từ webhook).

### 3.5 `webhook_events`
- Lưu toàn bộ payload webhook (ví dụ DepositEvent) để xử lý idempotent.
- `external_signature` unique giúp tránh cộng credit hai lần.
- `status` phản ánh tiến trình xử lý webhook.

### 3.6 `game_sessions`
- Mỗi lần tạo phòng (free hoặc VIP) sẽ có một bản ghi.
- `room_type`: enum free/vip.
- `status`: active/completed/aborted.
- `metadata`: tuỳ chọn (lưu config, entry cost...)

### 3.7 `game_session_players`
- Liệt kê người chơi tham gia một session.
- `ticket_id`: vé được dùng để join (nếu là VIP).
- `starting_credit`, `ending_credit`: dùng để đối chiếu trước-sau trận.
- `kill_count`, `death_count`, `is_winner`: thống kê gameplay.

### 3.8 `kill_logs`
- Ghi lại mỗi lần tiêu diệt trong phòng VIP (phục vụ reward 90/10).
- `amount_earned`: credit thưởng cho killer.
- `transaction_id`: liên kết tới giao dịch credit tương ứng.

### 3.9 `game_tickets`
- Vé vào phòng VIP.
- `ticket_code`: gửi cho client khi join Colyseus.
- `status`: issued/consumed/expired.
- `expires_at`, `consumed_at`: kiểm soát vòng đời vé.
- `metadata`: lưu thông tin bổ sung (ví dụ entry_cost, session_id dự kiến...).

### 3.10 `admin_configs`
- Bảng cấu hình chung được dùng sẵn trong project (key/value/data JSON).
- Có thể lưu cấu hình phòng VIP, entry cost mặc định, fee system.

## 4. Luồng Nghiệp Vụ Chính
### 4.1 Nạp Credit (Deposit)
1. Người chơi thực hiện giao dịch on-chain thông qua SDK.
2. Hệ thống nhận webhook → tạo `webhook_events` (status pending).
3. Service xử lý webhook:
   - Tra `users` qua `wallet_address`.
   - Tạo `transactions` (type = deposit, status = confirmed, signature = signature Solana).
   - Cập nhật `wallet_balances.available_amount += amount`.
   - Đánh dấu `webhook_events.status = confirmed`.
4. Client polling API sẽ thấy credit mới.

### 4.2 Xin Vé & Join Phòng VIP
1. Client gọi API tạo ticket (truyền loại phòng mong muốn).
2. Service kiểm tra `wallet_balances.available_amount >= entry_cost`.
3. Tạo `game_tickets` (status issued, expires_at theo TTL), trừ credit:
   - Tạo `transactions` (type = penalty/system_adjust) để trừ entry cost nếu muốn blocking trước trận.
4. Client join Colyseus, gửi `ticket_code` + JWT.
5. Gateway kiểm tra ticket → `status = consumed` + ghi `game_session_players`.

### 4.3 Chia Thưởng 90/10 Khi Kill
1. Room phát hiện kill → gọi API nội bộ.
2. Service kiểm tra credit của victim (`wallet_balances.available_amount`).
3. Nếu đủ ≥1:
   - Tạo `transactions` cho victim (type penalty hoặc system_adjust, amount -1).
   - Tạo `transactions` cho killer (type reward, amount +0.9) và cho system (0.1 nếu cần tracking).
   - Cập nhật `wallet_balances` tương ứng.
   - Ghi `kill_logs` (room_type vip, amount_earned 0.9, transaction_id).
4. Room broadcast credit mới cho client.

### 4.4 Rút Credit (Withdraw)
1. Client gửi request `amount` muốn rút.
2. Service kiểm tra `wallet_balances.available_amount` đủ.
3. Tạo `transactions` (type withdraw, status pending), chuyển amount sang `locked_amount` nếu cần.
4. Gọi API bên thứ ba, nhận kết quả:
   - Thành công: cập nhật `transactions.status = confirmed`, trừ `locked_amount`.
   - Thất bại: `status = failed`, chuyển credit về `available_amount`.

## 5. Mở Rộng Multi-VIP Room
- Có thể thêm bảng cấu hình (`vip_room_configs`) hoặc sử dụng `admin_configs` để lưu mapping: `room_code`, `entry_cost`, `max_players`, `revenue_split`.
- `game_sessions.metadata` & `game_tickets.metadata` lưu lại `entry_cost` thực tế tại thời điểm phát hành.
- Logic chia thưởng vẫn dùng chung `transactions` + `wallet_balances`, không cần chỉnh schema.

## 6. Lưu Ý Triển Khai
- Mọi API xử lý dữ liệu phải trả về theo `StandardResponseDto` (đã có sẵn trong project).
- Dùng migration TypeORM để tạo bảng từ file `SnakeGame.sql`.
- Khi chạy webhook/withdraw nên đặt trong transaction DB hoặc lock phù hợp để tránh race condition.
- Thêm index theo nhu cầu (ví dụ `(user_id, status)` trên `transactions`, `(game_session_id, user_id)` trên `game_session_players`).

## 7. Checklist Khi Cập Nhật Schema
- [ ] Cập nhật migration (TypeORM).
- [ ] Update entity tương ứng trong `backend/src/modules/database/entities`.
- [ ] Viết lại tài liệu này nếu thêm bảng/cột quan trọng.
- [ ] Kiểm thử lại luồng deposit, join VIP, reward, withdraw.
