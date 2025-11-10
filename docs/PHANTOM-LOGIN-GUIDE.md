# Hướng Dẫn Đăng Nhập Phantom Wallet

Tài liệu này mô tả cách sử dụng tính năng đăng nhập Phantom wallet đã được tích hợp vào game Snake.

---

## 🎯 Tính Năng Đã Triển Khai

### ✅ UI Components:
1. **MenuScene (Updated)** - Vừa là màn hình chính, hiển thị connect prompt, wallet info, credit và nút Free/VIP
2. **AuthService** - Xử lý authentication với Phantom
3. **WalletService** - Quản lý credit và polling

### ✅ Features:
- ✨ Kết nối Phantom wallet
- 🔐 Sign message và verify signature
- 💾 Lưu JWT token (access + refresh)
- 💎 Hiển thị credit real-time
- 🎮 2 chế độ chơi: Free và VIP
- 🚪 Logout và quay lại menu chính
- 👤 Có thể chơi Free mà không cần đăng nhập; VIP yêu cầu Phantom + credit

---

## 🔄 Luồng Đăng Nhập

```
LoadingScene 
    ↓
MenuScene (màn hình chính)
    ├─ Chơi Free ngay lập tức
    └─ Chọn VIP → (nếu chưa login) Connect Phantom → Sign → JWT → Nạp credit → Vào VIP
```

### Chi Tiết Flow:

#### **1. MenuScene (khởi đầu):**
- LoadingScene sau khi hoàn tất sẽ chuyển thẳng sang MenuScene.
- Ngay trung tâm: 2 lựa chọn `PLAY FREE` và `PLAY VIP`.
- Top-right:
  - Nếu chưa đăng nhập: panel nhỏ “Kết nối Phantom” với nút connect.
  - Nếu đã đăng nhập: panel wallet hiển thị địa chỉ + credit + nút Logout.

#### **2. Connect Phantom Flow (kích hoạt từ panel hoặc khi chọn VIP):**
1. Click nút **Kết nối Phantom**.
2. Phantom popup yêu cầu connect.
3. User approve → lấy wallet address.
4. Client gọi `POST /auth/nonce` → nhận nonce.
5. Phantom popup yêu cầu sign message.
6. User sign → gửi `POST /auth/verify` với signature.
7. Server verify → trả JWT (access + refresh token).
8. Lưu tokens vào localStorage và panel top-right chuyển sang trạng thái đã đăng nhập.
9. Tự động gọi `GET /wallet/credit` để hiển thị credit.

#### **3. MenuScene (Authenticated):**
- Panel top-right: wallet address (rút gọn), credit real-time, nút Logout.
- Nút `PLAY VIP` mở modal nạp tiền nếu credit < 1:
  - Nhập `Amount` và bấm `Deposit`.
  - Client gọi `POST /wallet/deposit`, build giao dịch, ký & gửi qua Phantom.
  - Sau khi confirm, tự động gọi `GET /wallet/credit` để kiểm tra số dư → đủ ≥ 1 sẽ vào VIP.
- Nút `PLAY FREE` vẫn hoạt động bình thường (không tốn credit).

#### **4. MenuScene (Chưa login / free mode):**
- Không hiển thị panel credit, chỉ có nút kết nối Phantom.
- Người chơi vẫn có thể:
  - Nhập tên, chọn skin.
  - Bấm `PLAY FREE` để vào phòng free ngay lập tức.
  - Nếu bấm `PLAY VIP`, modal sẽ yêu cầu kết nối Phantom trước khi nạp credit.

---

## 📁 Files Đã Tạo/Sửa

### Tạo Mới:
```
ui/src/
├── types/
│   └── Auth.types.ts          # Type definitions cho auth
├── services/
│   ├── AuthService.ts         # Phantom authentication service
│   └── WalletService.ts       # Credit management service
└── game/scenes/
    └── (không còn LoginScene riêng, MenuScene đảm nhiệm luôn)
```

### Đã Cập Nhật:
```
ui/src/
├── services/
│   └── ApiService.ts          # Thêm auth header interceptor
├── game/
│   ├── main.ts                # Chạy LoadingScene → MenuScene trực tiếp
│   └── scenes/
│       ├── LoadingScene.ts    # Sau loading chuyển thẳng vào MenuScene
│       └── MenuScene.ts       # Tích hợp connect Prompt + deposit modal
└── configs/
    └── game.ts                # Thêm version number
```

---

## 🔑 Storage Keys

Dữ liệu được lưu trong `localStorage`:

```typescript
'auth_access_token'    // JWT access token
'auth_refresh_token'   // JWT refresh token  
'wallet_address'       // Solana wallet address
'user_profile'         // User profile JSON
'wallet_credit'        // Cached credit balance
```

---

## 🎨 UI Design

### MenuScene – khu trung tâm:
- Hai nút `PLAY FREE` (xanh) và `PLAY VIP` (cam) chiếm vị trí chính.
- Free luôn hoạt động; VIP sẽ mở modal login/nạp nếu thiếu điều kiện.
- Ô nhập tên và chọn skin giữ phong cách sáng – xanh dương.

### MenuScene – panel top-right:
- Khi chưa đăng nhập: panel nhỏ với nút **Kết nối Phantom**.
- Khi đã đăng nhập:
  - Hiển thị wallet rút gọn.
  - Credit realtime (polling 3s).
  - Nút Logout (đưa về trạng thái chưa đăng nhập).

### Modal nạp tiền (VIP):
- Nhập `Amount` và bấm `Deposit` → client tự động lấy metadata, ký & gửi giao dịch bằng Phantom.
- Sau khi confirm, modal gọi lại `GET /wallet/credit` để kiểm tra số dư mới.
- Credit ≥ 1 sẽ đóng modal và vào VIP; nếu chưa tăng, hiển thị thông báo chờ webhook.

---

## 🚀 Cách Sử Dụng

### Development:
```bash
# Chạy UI
cd ui
pnpm dev

# Đảm bảo backend đang chạy
cd ../backend
pnpm start:dev
```

### Testing:

#### **1. Test Free Mode (không login):**
1. Vào game → MenuScene xuất hiện cùng panel “Kết nối Phantom”.
2. Bỏ qua phần connect, nhập tên & chọn skin.
3. Click `PLAY FREE`.
4. ✅ Vào được free room mà không cần ví.

#### **2. Test Phantom Login:**
1. Cài Phantom extension: https://phantom.app/
2. Tạo hoặc import wallet
3. Vào game, click nút **Kết nối Phantom** ở góc trên phải hoặc trong modal VIP.
4. Approve connection trong Phantom
5. Sign message trong Phantom
6. ✅ Panel top-right đổi sang hiển thị wallet + credit

#### **3. Test VIP Room (cần có credit):**
1. Đăng nhập Phantom.
2. Nhấn `PLAY VIP` → nếu credit < 1, dùng modal để nạp trực tiếp.
3. Sau khi giao dịch confirm, bấm `Tôi đã nạp xong` → credit >= 1.
4. Modal đóng và tự động join VIP room.
5. ✅ Vào được VIP room (hiện dùng chung phòng với Free tới khi backend tách riêng).

---

## 🔧 Environment Variables

Cấu hình trong `ui/src/configs/env.ts`:

```typescript
VITE_API_URL=http://localhost:2567    // Backend API
VITE_COLYSEUS_SERVER_URL=ws://localhost:2567  // Colyseus WS
```

---

## 📝 API Endpoints Sử Dụng

### Auth:
- `POST /auth/nonce` - Tạo nonce
- `POST /auth/verify` - Verify signature và login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get user profile

### Wallet:
- `GET /wallet/credit` - Lấy số dư credit
- `POST /wallet/withdraw` - Rút token

---

## 🐛 Troubleshooting

### Lỗi "Phantom wallet not found":
- Cài Phantom extension từ https://phantom.app/
- Restart browser sau khi cài

### Lỗi "Failed to verify signature":
- Đảm bảo backend đang chạy
- Kiểm tra API URL trong env.ts
- Check console logs để xem error chi tiết

### VIP button bị disable:
- Kiểm tra credit balance (cần >= 1)
- Nếu chưa có credit, cần nạp qua API deposit

### Token expired:
- AuthService tự động refresh token khi expire
- Nếu refresh token cũng hết hạn, sẽ redirect về LoginScene

---

## 🔄 Next Steps

Để hoàn thiện hệ thống, cần thêm:

1. ✅ **Đã làm**: LoginScene + Phantom integration
2. ⏳ **Chưa làm**: 
   - Deposit UI (nạp token)
   - VIP room logic trên Colyseus server
   - Kill reward 90/10 system
   - Withdraw UI
   - Transaction history

Xem thêm tại: `/docs/task/0.expansion-system-flow.md`

---

## 👨‍💻 Developer Notes

### AuthService Singleton:
```typescript
import { authService } from '@/services/AuthService';

// Check authenticated
if (authService.isAuthenticated()) {
  const wallet = authService.getWalletAddress();
}

// Login
await authService.login();

// Logout
await authService.logout();
```

### WalletService Singleton:
```typescript
import { walletService } from '@/services/WalletService';

// Get credit
const credit = await walletService.getCredit();

// Start polling
walletService.startPolling(3000); // 3 seconds

// Stop polling
walletService.stopPolling();
```

---

## 📞 Support

Nếu có vấn đề, kiểm tra:
1. Console logs trong browser
2. Network tab để xem API calls
3. Backend logs
4. Phantom extension logs

Happy coding! 🚀

