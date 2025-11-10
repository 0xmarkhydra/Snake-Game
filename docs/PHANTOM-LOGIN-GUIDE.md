# Hướng Dẫn Đăng Nhập Phantom Wallet

Tài liệu này mô tả cách sử dụng tính năng đăng nhập Phantom wallet đã được tích hợp vào game Snake.

---

## 🎯 Tính Năng Đã Triển Khai

### ✅ UI Components:
1. **LoginScene** - Màn hình đăng nhập với Phantom wallet
2. **MenuScene (Updated)** - Hiển thị wallet info, credit và nút Free/VIP
3. **AuthService** - Xử lý authentication với Phantom
4. **WalletService** - Quản lý credit và polling

### ✅ Features:
- ✨ Kết nối Phantom wallet
- 🔐 Sign message và verify signature
- 💾 Lưu JWT token (access + refresh)
- 💎 Hiển thị credit real-time
- 🎮 2 chế độ chơi: Free và VIP
- 🚪 Logout và quay về màn hình login
- 👤 Play as Guest (không cần đăng nhập)

---

## 🔄 Luồng Đăng Nhập

```
LoadingScene 
    ↓
LoginScene
    ├─ Connect Phantom → Sign → JWT → MenuScene (Authenticated)
    └─ Play as Guest → MenuScene (Guest)
```

### Chi Tiết Flow:

#### **1. LoginScene:**
- Kiểm tra Phantom extension có cài không
- 2 options:
  - **Connect Phantom**: Full authentication flow
  - **Play as Guest**: Vào Free room, không cần đăng nhập

#### **2. Connect Phantom Flow:**
1. Click "Connect Phantom Wallet"
2. Phantom popup yêu cầu connect
3. User approve → lấy wallet address
4. Client gọi `POST /auth/nonce` → nhận nonce
5. Phantom popup yêu cầu sign message
6. User sign → gửi `POST /auth/verify` với signature
7. Server verify → trả JWT (access + refresh token)
8. Lưu tokens vào localStorage
9. Chuyển sang MenuScene với `isAuthenticated: true`

#### **3. MenuScene (Authenticated):**
- Top right: Wallet info panel
  - Wallet address (rút gọn)
  - Credit balance (real-time update)
  - Logout button
- Form nhập tên + chọn skin (như cũ)
- 2 nút play:
  - **Play Free** (màu xanh): Ai cũng chơi được
  - **Play VIP** (màu cam): Cần login + có credit ≥ 1

#### **4. MenuScene (Guest):**
- Không hiển thị wallet panel
- Form nhập tên + chọn skin
- 2 nút play:
  - **Play Free**: Chơi bình thường
  - **Play VIP**: Bị disable, hiện "🔒 Login required"

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
    └── LoginScene.ts          # Login screen
```

### Đã Cập Nhật:
```
ui/src/
├── services/
│   └── ApiService.ts          # Thêm auth header interceptor
├── game/
│   ├── main.ts                # Thêm LoginScene vào scene list
│   └── scenes/
│       ├── LoadingScene.ts    # Chuyển sang LoginScene thay vì MenuScene
│       └── MenuScene.ts       # Thêm wallet info + Free/VIP buttons
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

### LoginScene:
- **Theme**: Dark blue gradient với hexagon pattern (giống MenuScene)
- **Particles**: Food particles floating
- **Buttons**: 
  - Connect Phantom (màu cam #FF9500)
  - Play as Guest (màu xanh #4CAF50)
- **Status**: Hiển thị trạng thái connection real-time

### MenuScene Wallet Panel (Top Right):
```
┌─────────────────────────┐
│ 🔗 CWZDCm...2TrNz      │
│                         │
│ 💎 Credit: 12.50       │
│                         │
│ 🚪 Logout              │
└─────────────────────────┘
```

### Play Buttons:
```
┌─────────────┐  ┌─────────────┐
│  PLAY FREE  │  │  PLAY VIP   │
│   (Green)   │  │  (Orange)   │
└─────────────┘  └─────────────┘
                    ↓ (nếu không đủ credit)
               Need 1+ credit
```

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

#### **1. Test Guest Mode:**
1. Vào game
2. Click "Play as Guest"
3. Nhập tên, chọn skin
4. Click "PLAY FREE"
5. ✅ Vào được free room

#### **2. Test Phantom Login:**
1. Cài Phantom extension: https://phantom.app/
2. Tạo hoặc import wallet
3. Vào game
4. Click "Connect Phantom Wallet"
5. Approve connection trong Phantom
6. Sign message trong Phantom
7. ✅ Vào MenuScene với wallet info hiển thị

#### **3. Test VIP Room (cần có credit):**
1. Đăng nhập Phantom
2. Nạp credit (tạm thời cần API backend)
3. Trong MenuScene, credit >= 1
4. Click "PLAY VIP"
5. ✅ Vào được VIP room

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

