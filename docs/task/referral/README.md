# Referral System Flow

## 1. Mục Tiêu
- Cho phép user tạo và chia sẻ referral code để giới thiệu người chơi mới.
- Tự động ghi nhận quan hệ referrer-referee khi user đăng ký với referral code.
- Tự động thưởng cho referrer khi referee chơi game và có hành động: giết người (nhận reward) hoặc chết (bị penalty).
- Đảm bảo mọi reward đều được ghi vào transactions và có audit trail đầy đủ.

## 2. Kiến Trúc Database

### 2.1 Bảng `users` - Thêm các trường
```sql
ALTER TABLE "users" 
ADD COLUMN "referral_code" VARCHAR(16) UNIQUE,
ADD COLUMN "referred_by_id" UUID REFERENCES "users"("id"),
ADD COLUMN "referred_at" TIMESTAMPTZ;

CREATE INDEX "IDX_users_referral_code" ON "users"("referral_code");
CREATE INDEX "IDX_users_referred_by_id" ON "users"("referred_by_id");
```

**Mô tả:**
- `referral_code`: Mã giới thiệu duy nhất của user (8-16 ký tự alphanumeric, tự động tạo khi đăng ký).
- `referred_by_id`: ID của user đã giới thiệu user này (nullable, chỉ set 1 lần khi đăng ký).
- `referred_at`: Thời điểm user được giới thiệu (nullable).

### 2.2 Bảng mới `referral_rewards`
```sql
CREATE TYPE "referral_reward_type" AS ENUM (
  'game_commission'
);

CREATE TYPE "referral_reward_status" AS ENUM (
  'pending',
  'confirmed',
  'failed'
);

CREATE TABLE "referral_rewards" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "referrer_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referee_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reward_type" "referral_reward_type" NOT NULL,
  "amount" NUMERIC(18,6) NOT NULL,
  "transaction_id" UUID REFERENCES "transactions"("id"),
  "status" "referral_reward_status" DEFAULT 'pending',
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);

CREATE INDEX "IDX_referral_rewards_referrer_id" ON "referral_rewards"("referrer_id");
CREATE INDEX "IDX_referral_rewards_referee_id" ON "referral_rewards"("referee_id");
CREATE INDEX "IDX_referral_rewards_transaction_id" ON "referral_rewards"("transaction_id");
CREATE INDEX "IDX_referral_rewards_status" ON "referral_rewards"("status");
```

**Mô tả:**
- `referrer_id`: User nhận thưởng (người giới thiệu).
- `referee_id`: User được giới thiệu (người thực hiện hành động).
- `reward_type`: Loại thưởng (chỉ có `game_commission`).
- `amount`: Số tiền thưởng (numeric 18,6).
- `transaction_id`: Liên kết với bảng `transactions` để audit.
- `status`: Trạng thái xử lý (pending → confirmed/failed).
- `metadata`: Thông tin bổ sung (ví dụ: kill_log_id, action_type: 'kill' | 'death', reward_amount, penalty_amount, etc.).

## 3. Cấu Hình Hệ Thống

Lưu trong `admin_configs` hoặc environment variables:

```typescript
// Config keys
REFERRAL_GAME_KILL_COMMISSION_RATE = "0.02"    // 2% commission từ fee (10% của 1 token) khi referee giết người
REFERRAL_GAME_DEATH_COMMISSION_RATE = "0.01"  // 1% commission từ fee (10% của 1 token) khi referee chết
REFERRAL_COMMISSION_CAP_PER_USER = "100.0"     // Giới hạn tổng commission từ 1 referee (optional)
REFERRAL_CODE_LENGTH = 8                       // Độ dài referral code
```

**Ví dụ tính toán:**
- Khi referee giết người: victim mất 1 token, killer nhận 0.9 token, system giữ 0.1 token (fee)
  - Referrer nhận: 0.1 token × 2% = **0.002 token**
- Khi referee chết: victim mất 1 token, system giữ 0.1 token (fee)
  - Referrer nhận: 0.1 token × 1% = **0.001 token**

## 4. Luồng Chức Năng Chi Tiết

### 4.1 Tạo Referral Code Khi Đăng Ký

**Trigger:** Khi user mới verify signature lần đầu (`AuthService.verifySignature`).

**Flow:**
1. User gọi `POST /auth/verify` với `walletAddress`, `signature`, `nonce`.
2. Server verify signature thành công.
3. Kiểm tra user đã tồn tại:
   - Nếu **chưa tồn tại** (user mới):
     - Tạo `referral_code` duy nhất (8 ký tự alphanumeric).
     - Kiểm tra `referralCode` trong request body (optional):
       - Nếu có → validate và lưu `referred_by_id`, `referred_at`.
     - Lưu user vào database.
   - Nếu **đã tồn tại**:
     - Bỏ qua việc tạo referral code (giữ nguyên code cũ).
     - Bỏ qua việc set `referred_by_id` (không cho phép thay đổi).

**Validation:**
- Referral code phải tồn tại trong database.
- Không được tự refer chính mình.
- Mỗi user chỉ có thể có 1 referrer (không đổi sau khi set).

**Code Reference:**
```typescript
// backend/src/modules/business/services/auth.service.ts
async verifySignature(
  walletAddress: string,
  nonce: string,
  signature: string,
  referralCode?: string,  // Optional
  metadata?: { userAgent?: string; ipAddress?: string },
): Promise<LoginResult> {
  // ... verify signature ...
  
  if (!user) {
    // Generate unique referral code
    const referralCode = await this.generateUniqueReferralCode();
    
    // Validate and set referrer if provided
    let referredBy: UserEntity | null = null;
    if (referralCode) {
      referredBy = await this.validateAndGetReferrer(referralCode, normalizedWallet);
    }
    
    user = this.userRepository.create({
      walletAddress: normalizedWallet,
      displayName: normalizedWallet.slice(0, 8),
      referralCode,
      referredBy: referredBy ? { id: referredBy.id } : undefined,
      referredAt: referredBy ? new Date() : undefined,
    });
  }
  
  // ... save user and issue tokens ...
}
```

### 4.2 Thưởng Khi Referee Chơi Game (Game Commission)

Có 2 trường hợp referee chơi game để tính commission:

#### 4.2.1 Commission Khi Referee Giết Người (Kill Reward)

**Trigger:** Khi referee giết người và nhận reward trong VIP room (sau khi `processKillReward` thành công).

**Flow:**
1. Trong `VipGameService.processKillReward` (sau khi cộng reward cho killer):
   - Kiểm tra killer (referee) có `referred_by_id` không.
   - Nếu có:
     - Đọc config `REFERRAL_GAME_KILL_COMMISSION_RATE`.
     - Lấy `fee_amount` từ kill log (10% của 1 token = 0.1 token).
     - Tính commission: `commission = fee_amount * kill_commission_rate`.
     - Kiểm tra commission cap (nếu có): `total_commission_from_referee <= commission_cap`.
     - Gọi `ReferralService.processGameCommission(refereeId, referrerId, feeAmount, killLogId, 'kill')`:
       - Tạo `referral_rewards`:
         - `referrer_id = referrerId`
         - `referee_id = refereeId`
         - `reward_type = game_commission`
         - `amount = commission`
         - `status = pending`
         - `metadata.action_type = 'kill'`
         - `metadata.fee_amount = feeAmount`
         - `metadata.reward_amount = rewardAmount` (để tham khảo)
         - `metadata.kill_log_id = killLogId`
       - Tạo transaction cho referrer:
         - `type = reward`
         - `amount = commission`
         - `status = confirmed`
         - `metadata.referral_reward_id = referral_rewards.id`
         - `metadata.reward_type = game_commission`
         - `metadata.action_type = 'kill'`
         - `metadata.kill_log_id = killLogId`
       - Cập nhật `wallet_balances` của referrer.
       - Cập nhật `referral_rewards.status = confirmed`.

**Lưu ý:**
- Commission tính trên **fee amount** (10% của 1 token = 0.1 token) mà system giữ lại, không phải reward amount của killer.
- Ví dụ: fee = 0.1 token → referrer nhận 0.1 × 2% = 0.002 token.
- Mỗi kill chỉ tính commission 1 lần (idempotent dựa trên kill_log_id).

#### 4.2.2 Commission Khi Referee Chết (Death Penalty)

**Trigger:** Khi referee chết (wall collision hoặc bị giết) và bị trừ penalty trong VIP room (sau khi `processWallCollisionPenalty` hoặc `processKillReward` với referee là victim).

**Flow:**
1. Trong `VipGameService.processWallCollisionPenalty` (sau khi trừ penalty cho victim):
   - Kiểm tra victim (referee) có `referred_by_id` không.
   - Nếu có:
     - Đọc config `REFERRAL_GAME_DEATH_COMMISSION_RATE`.
     - Lấy `fee_amount` từ kill log (10% của 1 token = 0.1 token).
     - Tính commission: `commission = fee_amount * death_commission_rate`.
     - Kiểm tra commission cap (nếu có): `total_commission_from_referee <= commission_cap`.
     - Gọi `ReferralService.processGameCommission(refereeId, referrerId, feeAmount, killLogId, 'death')`:
       - Tạo `referral_rewards`:
         - `referrer_id = referrerId`
         - `referee_id = refereeId`
         - `reward_type = game_commission`
         - `amount = commission`
         - `status = pending`
         - `metadata.action_type = 'death'`
         - `metadata.fee_amount = feeAmount`
         - `metadata.penalty_amount = penaltyAmount` (để tham khảo)
         - `metadata.kill_log_id = killLogId`
       - Tạo transaction cho referrer:
         - `type = reward`
         - `amount = commission`
         - `status = confirmed`
         - `metadata.referral_reward_id = referral_rewards.id`
         - `metadata.reward_type = game_commission`
         - `metadata.action_type = 'death'`
         - `metadata.kill_log_id = killLogId`
       - Cập nhật `wallet_balances` của referrer.
       - Cập nhật `referral_rewards.status = confirmed`.

2. Trong `VipGameService.processKillReward` (khi referee là victim):
   - Sau khi trừ penalty cho victim.
   - Kiểm tra victim (referee) có `referred_by_id` không.
   - Nếu có:
     - Xử lý tương tự như trên với `action_type = 'death'`.

**Lưu ý:**
- Commission tính trên **fee amount** (10% của 1 token = 0.1 token) mà system giữ lại, không phải penalty amount của victim.
- Ví dụ: fee = 0.1 token → referrer nhận 0.1 × 1% = 0.001 token.
- Mỗi death chỉ tính commission 1 lần (idempotent dựa trên kill_log_id).
- Có thể tính commission cho cả 2 trường hợp: referee giết người VÀ referee chết trong cùng 1 kill event (mỗi trường hợp tính từ fee riêng).

## 5. API Endpoints

### 5.1 `GET /referral/my-code`
**Mô tả:** Lấy referral code và thông tin referral của user hiện tại.

**Authentication:** Required (JWT).

**Response:**
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "referralCode": "ABC12345",
    "referralLink": "https://game.com?ref=ABC12345",
    "totalReferrals": 10,
    "activeReferrals": 7,
    "totalEarned": "4.5",
    "earnedFromKills": "3.0",
    "earnedFromDeaths": "1.5"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Logic:**
- Query `users` để lấy `referral_code`.
- Đếm số lượng referee: `SELECT COUNT(*) FROM users WHERE referred_by_id = userId`.
- Tính tổng earned từ `referral_rewards` với `status = confirmed`.

### 5.2 `GET /referral/stats`
**Mô tả:** Lấy thống kê chi tiết về referral của user.

**Authentication:** Required (JWT).

**Query Parameters:**
- `page` (optional): Số trang, default 1.
- `limit` (optional): Số item mỗi trang, default 10.

**Response:**
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "totalReferrals": 10,
    "activeReferrals": 7,
    "totalEarned": "4.5",
    "earnedFromKills": "3.0",
    "earnedFromDeaths": "1.5",
    "referrals": [
      {
        "refereeId": "uuid",
        "refereeWallet": "ABC...XYZ",
        "refereeDisplayName": "ABC...XYZ",
        "joinedAt": "2024-01-01T00:00:00Z",
        "totalEarned": "5.5",
        "earnedFromKills": "4.0",
        "earnedFromDeaths": "1.5",
        "lastActivityAt": "2024-01-15T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 10,
      "totalPages": 1
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Logic:**
- Query `users` với `referred_by_id = userId` (paginated).
- Với mỗi referee, tính tổng earned từ referral_rewards.
- Group by `metadata.action_type` để tính earnedFromKills, earnedFromDeaths.

### 5.3 `POST /referral/validate`
**Mô tả:** Validate referral code trước khi đăng ký (public endpoint, không cần auth).

**Request Body:**
```json
{
  "referralCode": "ABC12345"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "Referral code is valid",
  "data": {
    "valid": true,
    "referrerWallet": "XYZ...ABC",
    "referrerDisplayName": "XYZ...ABC"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Logic:**
- Query `users` với `referral_code = referralCode`.
- Nếu tồn tại → `valid = true`, trả về thông tin referrer (ẩn một phần wallet address).
- Nếu không tồn tại → `valid = false`.

### 5.4 `POST /auth/verify` - Mở rộng
**Mô tả:** Thêm parameter `referralCode` (optional) vào request body.

**Request Body:**
```json
{
  "walletAddress": "ABC...XYZ",
  "signature": "...",
  "nonce": "...",
  "referralCode": "ABC12345"  // Optional
}
```

**Logic:**
- Nếu có `referralCode`:
  - Validate referral code tồn tại.
  - Kiểm tra không tự refer chính mình.
  - Lưu `referred_by_id` và `referred_at` khi tạo user mới.
  - **Không có signup bonus** - chỉ ghi nhận quan hệ referrer-referee.

## 6. Business Rules

1. **Mỗi user chỉ có 1 referrer:**
   - `referred_by_id` chỉ được set 1 lần khi đăng ký.
   - Không cho phép thay đổi sau khi đã set.

2. **Không tự refer:**
   - User không thể sử dụng referral code của chính mình.

3. **Referral code unique:**
   - Mỗi user có 1 referral code duy nhất.
   - Tự động tạo khi đăng ký (không cho phép user tự tạo).

4. **Commission chỉ tính khi referee chơi game:**
   - Game commission (kill): chỉ tính khi referee giết người, tính từ fee (2% của fee).
   - Game commission (death): chỉ tính khi referee chết, tính từ fee (1% của fee).
   - Fee = 10% của 1 token = 0.1 token (phần system giữ lại).

5. **Idempotent:**
   - Mỗi hành động chỉ tính reward 1 lần (dựa trên kill_log_id).
   - Một kill event có thể tạo 2 commission: 1 cho killer (referee) và 1 cho victim (referee) nếu cả 2 đều có referrer.

6. **Commission cap (optional):**
   - Có thể giới hạn tổng commission từ 1 referee (ví dụ: tối đa 100 token).

7. **Audit trail:**
   - Mọi reward đều có record trong `referral_rewards` và `transactions`.
   - `referral_rewards.transaction_id` liên kết với `transactions.id`.

## 7. Tích Hợp Vào Code Hiện Tại

### 7.1 AuthService.verifySignature
**File:** `backend/src/modules/business/services/auth.service.ts`

**Thay đổi:**
- Thêm parameter `referralCode?: string`.
- Validate và lưu `referred_by_id` nếu có.
- Tạo referral code cho user mới.
- **Không gọi signup bonus** - chỉ ghi nhận quan hệ.

### 7.2 VipGameService.processKillReward
**File:** `backend/src/modules/business/services/vip-game.service.ts`

**Thay đổi:**
- Sau khi xử lý kill reward và có `fee_amount`:
  - Kiểm tra killer có `referred_by_id` không.
  - Gọi `ReferralService.processGameCommission()` với `fee_amount` và `action_type = 'kill'` nếu có.
- Sau khi trừ penalty cho victim và có `fee_amount`:
  - Kiểm tra victim có `referred_by_id` không.
  - Gọi `ReferralService.processGameCommission()` với `fee_amount` và `action_type = 'death'` nếu có.

### 7.3 VipGameService.processWallCollisionPenalty
**File:** `backend/src/modules/business/services/vip-game.service.ts`

**Thay đổi:**
- Sau khi xử lý wall collision penalty và có `fee_amount`.
- Kiểm tra victim có `referred_by_id` không.
- Gọi `ReferralService.processGameCommission()` với `fee_amount` và `action_type = 'death'` nếu có.

### 7.4 Tạo ReferralService mới
**File:** `backend/src/modules/business/services/referral.service.ts`

**Chức năng:**
- `generateUniqueReferralCode()`: Tạo referral code duy nhất.
- `validateAndGetReferrer(referralCode, walletAddress)`: Validate referral code.
- `processGameCommission(refereeId, referrerId, feeAmount, killLogId, actionType: 'kill' | 'death')`: Xử lý game commission (cho cả kill và death). Tính commission từ fee_amount.
- `getReferralStats(userId, page, limit)`: Lấy thống kê referral.

## 8. Migration Script

**File:** `backend/src/modules/database/migrations/[timestamp]-AddReferralSystem.ts`

```typescript
export class AddReferralSystem[timestamp] implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns to users table
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "referral_code" VARCHAR(16) UNIQUE,
      ADD COLUMN "referred_by_id" UUID REFERENCES "users"("id"),
      ADD COLUMN "referred_at" TIMESTAMPTZ;
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_referral_code" ON "users"("referral_code");
      CREATE INDEX "IDX_users_referred_by_id" ON "users"("referred_by_id");
    `);

    // Create referral_rewards table
    await queryRunner.query(`
      CREATE TYPE "referral_reward_type" AS ENUM (
        'game_commission'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "referral_reward_status" AS ENUM (
        'pending',
        'confirmed',
        'failed'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "referral_rewards" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "referrer_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "referee_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "reward_type" "referral_reward_type" NOT NULL,
        "amount" NUMERIC(18,6) NOT NULL,
        "transaction_id" UUID REFERENCES "transactions"("id"),
        "status" "referral_reward_status" DEFAULT 'pending',
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ DEFAULT now(),
        "updated_at" TIMESTAMPTZ DEFAULT now(),
        "deleted_at" TIMESTAMPTZ
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_referral_rewards_referrer_id" ON "referral_rewards"("referrer_id");
      CREATE INDEX "IDX_referral_rewards_referee_id" ON "referral_rewards"("referee_id");
      CREATE INDEX "IDX_referral_rewards_transaction_id" ON "referral_rewards"("transaction_id");
      CREATE INDEX "IDX_referral_rewards_status" ON "referral_rewards"("status");
    `);

    // Generate referral codes for existing users
    await queryRunner.query(`
      UPDATE "users" 
      SET "referral_code" = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 8))
      WHERE "referral_code" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "referral_rewards";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "referral_reward_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "referral_reward_type";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_referred_by_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_referral_code";`);
    
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "referred_at";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "referred_by_id";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "referral_code";`);
  }
}
```

## 9. Checklist Triển Khai

### Phase 1: Database & Entities
- [ ] Tạo migration script cho `users` table (thêm referral columns).
- [ ] Tạo migration script cho `referral_rewards` table.
- [ ] Tạo entity `ReferralRewardEntity`.
- [ ] Update entity `UserEntity` (thêm referral fields).
- [ ] Tạo repository `ReferralRewardRepository`.

### Phase 2: Service Layer
- [ ] Tạo `ReferralService` với các methods:
  - [ ] `generateUniqueReferralCode()`
  - [ ] `validateAndGetReferrer()`
  - [ ] `processGameCommission()` (hỗ trợ cả 'kill' và 'death')
  - [ ] `getReferralStats()`
- [ ] Update `AuthService.verifySignature()` (thêm referralCode parameter, không có signup bonus).
- [ ] Update `VipGameService.processKillReward()` (thêm game commission cho cả killer và victim).
- [ ] Update `VipGameService.processWallCollisionPenalty()` (thêm game commission cho victim).

### Phase 3: API Layer
- [ ] Tạo DTOs:
  - [ ] `ReferralCodeResponseDto`
  - [ ] `ReferralStatsResponseDto`
  - [ ] `ValidateReferralCodeDto`
  - [ ] Update `VerifySignatureDto` (thêm referralCode field).
- [ ] Tạo `ReferralController` với endpoints:
  - [ ] `GET /referral/my-code`
  - [ ] `GET /referral/stats`
  - [ ] `POST /referral/validate`
- [ ] Update `AuthController.verify()` (thêm referralCode trong body).

### Phase 4: Configuration
- [ ] Thêm config keys vào `admin_configs` hoặc env:
  - [ ] `REFERRAL_GAME_KILL_COMMISSION_RATE` (2% = 0.02)
  - [ ] `REFERRAL_GAME_DEATH_COMMISSION_RATE` (1% = 0.01)
  - [ ] `REFERRAL_COMMISSION_CAP_PER_USER` (optional)
  - [ ] `REFERRAL_CODE_LENGTH`

### Phase 5: Testing
- [ ] Unit test `ReferralService`.
- [ ] Integration test flow đăng ký với referral code (không có signup bonus).
- [ ] Integration test game commission khi referee giết người.
- [ ] Integration test game commission khi referee chết (wall collision).
- [ ] Integration test game commission khi referee chết (bị giết).
- [ ] Integration test cả 2 commission trong cùng 1 kill event (referee vừa giết vừa bị giết).
- [ ] E2E test API endpoints.

### Phase 6: UI Integration
- [ ] Thêm input field referral code trong form đăng ký.
- [ ] Hiển thị referral code trong profile page.
- [ ] Hiển thị referral stats trong dashboard.
- [ ] Nút copy referral link.

## 10. Ghi Chú & Mở Rộng

- **Referral code format:** Có thể dùng alphanumeric (A-Z, 0-9) hoặc chỉ uppercase để dễ đọc.
- **Referral link:** Có thể tạo link dạng `https://game.com?ref=ABC12345` hoặc `https://game.com/ref/ABC12345`.
- **Commission cap:** Có thể giới hạn theo thời gian (ví dụ: chỉ tính commission trong 30 ngày đầu).
- **Tier system:** Có thể mở rộng thêm tier system (ví dụ: referrer level 1, 2, 3 với commission rate khác nhau).
- **Analytics:** Có thể thêm bảng `referral_analytics` để track conversion rate, retention rate của referrals.

## 11. Environment Variables

```bash
# Referral System Configuration
# Commission tính từ fee (10% của 1 token = 0.1 token)
REFERRAL_GAME_KILL_COMMISSION_RATE=0.02    # 2% của fee khi referee giết người = 0.002 token
REFERRAL_GAME_DEATH_COMMISSION_RATE=0.01   # 1% của fee khi referee chết = 0.001 token
REFERRAL_COMMISSION_CAP_PER_USER=100.0
REFERRAL_CODE_LENGTH=8
```

## 12. Example Flow Diagram

```
User A (Referrer)
  ├─ Referral Code: ABC12345
  └─ Referral Link: https://game.com?ref=ABC12345

User B (Referee)
  ├─ Đăng ký với referralCode = "ABC12345"
  ├─ System: Set referred_by_id = UserA.id
  │  └─ Không có signup bonus
  │
  ├─ User B chơi game VIP, giết người
  │  ├─ Victim mất 1 token, User B nhận 0.9 token, System giữ 0.1 token (fee)
  │  └─ System: Process Game Commission (kill) → UserA nhận 0.002 token (2% của 0.1 token fee)
  │
  └─ User B chơi game VIP, chết (wall collision hoặc bị giết)
     ├─ User B mất 1 token, System giữ 0.1 token (fee)
     └─ System: Process Game Commission (death) → UserA nhận 0.001 token (1% của 0.1 token fee)
```

**Lưu ý:** 
- Commission tính từ **fee amount** (10% của 1 token = 0.1 token), không phải từ reward hay penalty.
- Trong cùng 1 kill event, nếu User B vừa giết người vừa bị giết, User A có thể nhận cả 2 commission:
  - Commission từ fee khi User B giết người (2% của fee)
  - Commission từ fee khi User B bị giết (1% của fee)

