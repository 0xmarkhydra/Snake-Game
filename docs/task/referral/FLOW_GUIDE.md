# Referral System - Flow Guide

Tài liệu này mô tả chi tiết các luồng hoạt động của Referral System.

## 📋 Tổng Quan Các Luồng

1. **Luồng 1: Login** - Đăng nhập và tự động tạo referral code
2. **Luồng 2: Get My Referral Code** - Lấy referral code và stats của mình
3. **Luồng 3: Đăng ký với Referral Code** - User mới đăng ký với referral code của người khác
4. **Luồng 4: Thống kê Referral** - Xem stats chi tiết về referrals và earnings

---

## 🔐 Luồng 1: Login

### Mục đích
User đăng nhập vào hệ thống. Nếu user chưa có referral code, hệ thống sẽ tự động tạo.

### Endpoints
- `POST /auth/nonce` - Lấy nonce
- `POST /auth/verify` - Verify signature và đăng nhập

### Flow

```
1. User kết nối Phantom Wallet
   ↓
2. Gọi POST /auth/nonce với walletAddress
   Response: { nonce: "..." }
   ↓
3. User ký nonce bằng Phantom
   ↓
4. Gọi POST /auth/verify với:
   {
     walletAddress: "...",
     nonce: "...",
     signature: "..."
   }
   ↓
5. Server xử lý:
   - Verify signature
   - Kiểm tra user đã tồn tại?
     ├─ Chưa tồn tại → Tạo user mới + Tạo referral code
     └─ Đã tồn tại → Kiểm tra có referral code?
         ├─ Có → Giữ nguyên
         └─ Không → Tạo referral code mới
   ↓
6. Response:
   {
     user: {
       id: "...",
       walletAddress: "...",
       referralCode: "ABC12345",  // ✅ Tự động có
       referredById: null
     },
     tokens: { accessToken, refreshToken }
   }
```

### Test Case
```bash
# 1. Get nonce
POST /auth/nonce
Body: { "walletAddress": "HPfcPDMfcMsYdhiF8Z8iYwP6M9dTQdZJxrwK1kDiJCWq" }

# 2. Sign nonce với Phantom

# 3. Verify
POST /auth/verify
Body: {
  "walletAddress": "HPfcPDMfcMsYdhiF8Z8iYwP6M9dTQdZJxrwK1kDiJCWq",
  "nonce": "...",
  "signature": "..."
}
```

---

## 🎫 Luồng 2: Get My Referral Code

### Mục đích
Lấy referral code của user hiện tại và stats tổng quan.

### Endpoint
- `GET /referral/my-code` - Lấy referral code và stats cơ bản

### Flow

```
1. User đã đăng nhập (có JWT token)
   ↓
2. Gọi GET /referral/my-code
   Headers: { Authorization: "Bearer <accessToken>" }
   ↓
3. Server xử lý:
   - Kiểm tra user có referral code?
     ├─ Có → Dùng code hiện tại
     └─ Không → Tạo referral code mới → Lưu vào DB
   - Tính toán stats:
     * totalReferrals: Số người đã được giới thiệu
     * activeReferrals: Số người đã chơi game
     * totalEarned: Tổng tiền đã kiếm được
     * earnedFromKills: Tiền từ kills
     * earnedFromDeaths: Tiền từ deaths
   ↓
4. Response:
   {
     referralCode: "ABC12345",
     referralLink: "https://game.com?ref=ABC12345",
     totalReferrals: 5,
     activeReferrals: 3,
     totalEarned: "0.012000",
     earnedFromKills: "0.008000",
     earnedFromDeaths: "0.004000"
   }
```

### Test Case
```bash
GET /referral/my-code
Headers: {
  "Authorization": "Bearer <accessToken>"
}
```

---

## 👥 Luồng 3: Đăng ký với Referral Code

### Mục đích
User mới đăng ký và sử dụng referral code của người khác để tạo quan hệ referrer-referee.

### Endpoints
- `POST /referral/validate` - Validate referral code (public, không cần login)
- `POST /auth/verify` - Đăng ký với referral code

### Flow

```
1. User A muốn giới thiệu User B
   ↓
2. User B validate referral code (optional):
   POST /referral/validate
   Body: { "referralCode": "ABC12345" }
   Response: {
     valid: true,
     referrerWallet: "...",
     referrerDisplayName: "..."
   }
   ↓
3. User B đăng ký với referral code:
   POST /auth/verify
   Body: {
     walletAddress: "UserB_Wallet",
     nonce: "...",
     signature: "...",
     referralCode: "ABC12345"  // ✅ Thêm referral code
   }
   ↓
4. Server xử lý:
   - Verify signature
   - Validate referral code:
     * Kiểm tra code tồn tại
     * Kiểm tra không phải tự refer chính mình
   - Tạo user mới:
     * referralCode: Tạo code mới cho User B
     * referredById: ID của User A
     * referredAt: Thời điểm hiện tại
   ↓
5. Response:
   {
     user: {
       id: "user_b_id",
       walletAddress: "UserB_Wallet",
       referralCode: "XYZ67890",  // Code mới của User B
       referredById: "user_a_id",  // ✅ Đã được refer bởi User A
       referredAt: "2025-01-17T..."
     },
     tokens: { ... }
   }
```

### Test Case

**Bước 1: Validate referral code (optional)**
```bash
POST /referral/validate
Body: { "referralCode": "ABC12345" }
```

**Bước 2: Đăng ký với referral code**
```bash
# Get nonce
POST /auth/nonce
Body: { "walletAddress": "NEW_USER_WALLET" }

# Sign và verify với referral code
POST /auth/verify
Body: {
  "walletAddress": "NEW_USER_WALLET",
  "nonce": "...",
  "signature": "...",
  "referralCode": "ABC12345"  // ✅ Referral code của User A
}
```

---

## 📊 Luồng 4: Thống kê Referral Chi Tiết

### Mục đích
Xem thống kê chi tiết về:
- Tổng số người đã được giới thiệu
- Danh sách từng người đã được giới thiệu
- Số tiền kiếm được từ mỗi người
- Phân tích theo kills và deaths

### Endpoint
- `GET /referral/stats?page=1&limit=10` - Lấy stats chi tiết với pagination

### Flow

```
1. User đã đăng nhập (có JWT token)
   ↓
2. Gọi GET /referral/stats?page=1&limit=10
   Headers: { Authorization: "Bearer <accessToken>" }
   ↓
3. Server xử lý:
   - Lấy danh sách users đã được giới thiệu (referredById = userId)
   - Với mỗi referee:
     * Tính tổng tiền đã kiếm được từ referee này
     * Phân tích theo kills và deaths
     * Lấy thời điểm hoạt động cuối cùng
   - Tính tổng stats:
     * totalReferrals: Tổng số người đã giới thiệu
     * activeReferrals: Số người đã chơi game (có commission)
     * totalEarned: Tổng tiền từ tất cả referrals
     * earnedFromKills: Tổng tiền từ kills
     * earnedFromDeaths: Tổng tiền từ deaths
   ↓
4. Response:
   {
     referralCode: "ABC12345",
     referralLink: "https://game.com?ref=ABC12345",
     totalReferrals: 5,
     activeReferrals: 3,
     totalEarned: "0.012000",
     earnedFromKills: "0.008000",
     earnedFromDeaths: "0.004000",
     referrals: [
       {
         refereeId: "referee_1_id",
         refereeWallet: "Wallet1...",
         refereeDisplayName: "User1",
         joinedAt: "2025-01-15T...",
         totalEarned: "0.005000",
         earnedFromKills: "0.003000",
         earnedFromDeaths: "0.002000",
         lastActivityAt: "2025-01-17T..."
       },
       {
         refereeId: "referee_2_id",
         refereeWallet: "Wallet2...",
         refereeDisplayName: "User2",
         joinedAt: "2025-01-16T...",
         totalEarned: "0.004000",
         earnedFromKills: "0.003000",
         earnedFromDeaths: "0.001000",
         lastActivityAt: "2025-01-17T..."
       },
       // ... more referrals
     ],
     pagination: {
       page: 1,
       limit: 10,
       total: 5,
       totalPages: 1
     }
   }
```

### Test Case
```bash
GET /referral/stats?page=1&limit=10
Headers: {
  "Authorization": "Bearer <accessToken>"
}
```

---

## 🎮 Luồng 5: Kiếm Tiền Từ Referral (Tự Động)

### Mục đích
Khi referee chơi game và có hành động (kill hoặc death), referrer tự động nhận commission.

### Flow

```
1. Referee (User B) chơi game VIP room
   ↓
2. Referee giết người (kill):
   - VipGameService.processKillReward() được gọi
   - Tính fee: 10% của 1 token = 0.1 token
   - Kiểm tra referee có referrer?
     ├─ Có → Gọi ReferralService.processGameCommission()
       * actionType: "kill"
       * commissionRate: 2% của fee = 0.002 token
       * Tạo ReferralRewardEntity
       * Tạo Transaction cho referrer
       * Cập nhật wallet balance của referrer
     └─ Không → Bỏ qua
   ↓
3. Referee bị giết (death):
   - VipGameService.processKillReward() được gọi (cho victim)
   - Tính fee: 10% của 1 token = 0.1 token
   - Kiểm tra victim có referrer?
     ├─ Có → Gọi ReferralService.processGameCommission()
       * actionType: "death"
       * commissionRate: 1% của fee = 0.001 token
       * Tạo ReferralRewardEntity
       * Tạo Transaction cho referrer
       * Cập nhật wallet balance của referrer
     └─ Không → Bỏ qua
   ↓
4. Commission được ghi vào:
   - referral_rewards table
   - transactions table
   - wallet_balances table
```

### Commission Rates
- **Kill Commission**: 2% của fee (0.1 token) = **0.002 token**
- **Death Commission**: 1% của fee (0.1 token) = **0.001 token**

---

## 📝 Test Scenarios

### Scenario 1: User mới đăng ký không có referral code
```
1. Login → Tự động có referral code
2. Gọi /referral/my-code → Thấy referral code
```

### Scenario 2: User đăng ký với referral code
```
1. User A: Login → Có referral code "ABC12345"
2. User B: Validate "ABC12345" → OK
3. User B: Login với referralCode="ABC12345"
4. User B: Kiểm tra referredById = User A's ID
```

### Scenario 3: Referee chơi game và referrer nhận commission
```
1. User A refer User B
2. User B chơi VIP room
3. User B giết người → User A nhận 0.002 token
4. User B bị giết → User A nhận 0.001 token
5. User A: Gọi /referral/stats → Thấy earnings từ User B
```

### Scenario 4: Xem thống kê chi tiết
```
1. User A đã refer nhiều người
2. User A: Gọi /referral/stats
3. Thấy:
   - Tổng số referrals
   - Danh sách từng referee
   - Earnings từ mỗi referee
   - Phân tích kills vs deaths
```

---

## 🔗 API Endpoints Summary

| Endpoint | Method | Auth | Mô tả |
|----------|--------|------|-------|
| `/auth/nonce` | POST | ❌ | Lấy nonce để đăng nhập |
| `/auth/verify` | POST | ❌ | Đăng nhập/Đăng ký (có thể kèm referralCode) |
| `/referral/validate` | POST | ❌ | Validate referral code (public) |
| `/referral/my-code` | GET | ✅ | Lấy referral code và stats cơ bản |
| `/referral/stats` | GET | ✅ | Lấy stats chi tiết với danh sách referrals |

---

## 💡 Lưu Ý

1. **Referral code tự động tạo**: User sẽ tự động có referral code khi login hoặc gọi endpoint referral
2. **Referral code chỉ set 1 lần**: Khi user đã có `referredById`, không thể thay đổi
3. **Commission tự động**: Khi referee chơi game, referrer tự động nhận commission
4. **Idempotent**: Mỗi kill/death chỉ tính commission 1 lần (dựa trên kill_log_id)
5. **Commission cap**: Có thể set giới hạn commission tối đa từ mỗi referee (config: `REFERRAL_COMMISSION_CAP_PER_USER`)

