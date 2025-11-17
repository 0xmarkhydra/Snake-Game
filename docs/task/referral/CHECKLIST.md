# Referral System - Checklist Triển Khai

## ✅ Checklist

### 1. Database Migration
- [ ] Chạy migration để tạo tables và columns
  ```bash
  cd backend
  pnpm run migration:run
  ```
- [ ] Verify migration thành công:
  ```sql
  -- Kiểm tra columns trong users table
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'users' 
  AND column_name IN ('referral_code', 'referred_by_id', 'referred_at');
  
  -- Kiểm tra bảng referral_rewards
  SELECT * FROM referral_rewards LIMIT 1;
  ```

### 2. Environment Variables
Thêm vào file `backend/.env`:

```bash
# Referral System Configuration
REFERRAL_GAME_KILL_COMMISSION_RATE=0.02      # 2% của fee khi referee giết người
REFERRAL_GAME_DEATH_COMMISSION_RATE=0.01     # 1% của fee khi referee chết
REFERRAL_COMMISSION_CAP_PER_USER=100.0       # Giới hạn commission từ 1 referee (optional, 0 = không giới hạn)
REFERRAL_CODE_LENGTH=8                       # Độ dài referral code
```

**Lưu ý:** Config được đọc qua `configService.get('referral.gameKillCommissionRate')`, cần đảm bảo format đúng.

### 3. Code Implementation ✅
- [x] Migration script đã tạo
- [x] Entities đã tạo (ReferralRewardEntity, UserEntity updated)
- [x] Repositories đã tạo
- [x] Services đã tạo (ReferralService)
- [x] Controllers đã tạo (ReferralController)
- [x] DTOs đã tạo
- [x] Integration với AuthService
- [x] Integration với VipGameService
- [x] Auto-generate referral code cho user cũ

### 4. API Endpoints ✅
- [x] `POST /referral/validate` - Validate referral code (public)
- [x] `GET /referral/my-code` - Get referral code và stats (JWT required)
- [x] `GET /referral/stats` - Get detailed stats (JWT required)
- [x] `POST /auth/verify` - Login với referral code support

### 5. Test Files ✅
- [x] `docs/task/referral/test-referral.html` - HTML test playground
- [x] `docs/task/referral/FLOW_GUIDE.md` - Flow documentation
- [x] `docs/task/referral/MIGRATION_GUIDE.md` - Migration guide

### 6. Testing
- [ ] Test login flow → User tự động có referral code
- [ ] Test GET /referral/my-code → Thấy referral code
- [ ] Test POST /referral/validate → Validate code thành công
- [ ] Test đăng ký với referral code → User mới có referredById
- [ ] Test GET /referral/stats → Thấy stats chi tiết
- [ ] Test game commission flow → Referee chơi game, referrer nhận commission

---

## 🚀 Quick Start

### Bước 1: Chạy Migration
```bash
cd backend
pnpm run migration:run
```

### Bước 2: Thêm Config vào .env
Thêm các dòng sau vào `backend/.env`:
```bash
REFERRAL_GAME_KILL_COMMISSION_RATE=0.02
REFERRAL_GAME_DEATH_COMMISSION_RATE=0.01
REFERRAL_COMMISSION_CAP_PER_USER=100.0
REFERRAL_CODE_LENGTH=8
```

### Bước 3: Restart Backend
```bash
cd backend
pnpm run start:dev
```

### Bước 4: Test với HTML File
1. Mở `docs/task/referral/test-referral.html` trong browser
2. Kết nối Phantom Wallet
3. Test các luồng:
   - Login → Xem referral code
   - Validate referral code
   - Đăng ký với referral code
   - Xem stats chi tiết

---

## 📝 Test Scenarios

### Scenario 1: User mới đăng nhập
```
1. User chưa tồn tại → Login
2. → Tự động tạo referral code
3. → Gọi GET /referral/my-code
4. → Thấy referral code và stats
```

### Scenario 2: User đăng ký với referral code
```
1. User A: Login → Có referral code "ABC12345"
2. User B: Validate "ABC12345" → OK
3. User B: Login với referralCode="ABC12345"
4. → User B có referredById = User A's ID
```

### Scenario 3: Referee chơi game
```
1. User A refer User B
2. User B chơi VIP room
3. User B giết người → User A nhận 0.002 token
4. User B bị giết → User A nhận 0.001 token
5. User A: GET /referral/stats → Thấy earnings
```

---

## 🔍 Troubleshooting

### Lỗi: "column UserEntity.referral_code does not exist"
**Giải pháp:** Chạy migration:
```bash
cd backend
pnpm run migration:run
```

### Lỗi: "Referral code is null"
**Giải pháp:** 
- User cũ sẽ tự động có referral code khi login lại
- Hoặc gọi GET /referral/my-code → Tự động tạo

### Commission không được tính
**Kiểm tra:**
1. Referee có referredById không?
2. Config đã set đúng chưa?
3. Game service đã gọi ReferralService.processGameCommission() chưa?

---

## 📚 Documentation

- [FLOW_GUIDE.md](./FLOW_GUIDE.md) - Chi tiết các luồng
- [README.md](./README.md) - Tài liệu tổng quan
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Hướng dẫn migration

