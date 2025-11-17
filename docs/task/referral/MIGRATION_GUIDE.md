# Hướng Dẫn Chạy Migration Referral System

## Vấn đề
Lỗi: `column UserEntity.referral_code does not exist` - Migration chưa được chạy.

## Giải pháp

### Bước 1: Đảm bảo Database đang chạy
```bash
# Kiểm tra PostgreSQL đang chạy
# Nếu dùng Docker:
docker ps | grep postgres

# Hoặc kiểm tra connection
psql -h localhost -U postgres -d postgres
```

### Bước 2: Kiểm tra Environment Variables
Đảm bảo file `.env` trong `backend/` có các biến:
```bash
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=your_database_name
```

### Bước 3: Chạy Migration
```bash
cd backend
pnpm run migration:run
```

### Bước 4: Kiểm tra kết quả
Sau khi chạy migration thành công, bạn sẽ thấy:
```
Data Source has been initialized!
Running migrations...
Migrations executed: 1
  - AddReferralSystem1723400000000
Migration completed!
```

### Bước 5: Verify trong Database
```sql
-- Kiểm tra columns đã được thêm vào users table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('referral_code', 'referred_by_id', 'referred_at');

-- Kiểm tra bảng referral_rewards đã được tạo
SELECT * FROM referral_rewards LIMIT 1;
```

## Rollback Migration (nếu cần)
```bash
cd backend
pnpm run migration:revert
```

## Lưu ý
- Migration sẽ tự động tạo referral code cho các user hiện có
- Migration không ảnh hưởng đến dữ liệu hiện có
- Đảm bảo backup database trước khi chạy migration trên production

