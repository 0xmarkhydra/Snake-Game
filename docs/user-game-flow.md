# Luồng Người Chơi Và Logic Multiplayer

Tài liệu này mô tả chi tiết quá trình một người chơi tham gia game Snake multiplayer và cách client – server phối hợp xử lý gameplay. Nội dung giúp bạn hiểu rõ hiện trạng trước khi mở rộng tính năng.

## 1. Kiến trúc tổng quan

- **Client**: Phaser 3 trong `ui/src/game`, chạy trong React shell (`App.tsx`). Colyseus client (`ui/src/services/ColyseusClient.ts`) chịu trách nhiệm kết nối WebSocket tới server.
- **Server**: Colyseus (`server/src`), quản lý các phòng thông qua `SnakeGameRoom.ts` và trạng thái đồng bộ `SnakeGameState.ts`.
- **Phòng chơi**: Mỗi phòng `snake_game` chứa tối đa 20 người (`maxClients = 20`), chạy vòng lặp game 60 FPS (tick 16 ms).

## 2. Luồng người chơi từ giao diện

1. **LoadingScene → MenuScene**: game khởi tạo từ `ui/src/game/main.ts`. `MenuScene` hiển thị form nhập tên, chọn skin.
2. **Nhấn “PLAY”**: Menu gọi `this.scene.start('GameScene', { playerName, skinId })`. Các tham số này truyền sang `GameScene` để dùng khi kết nối server.
3. **GameScene tạo kết nối**:
   - Gọi `colyseusClient.joinOrCreate('snake_game', { name, skinId })`.
   - Nếu phòng hiện tại chưa đủ người, server cho vào phòng; nếu đầy, Colyseus sinh phòng mới.
4. **Sau khi kết nối**:
   - Client nhận `room.sessionId` làm định danh.
   - Đăng ký các handler: `onStateChange`, `foodSpawned`, `foodConsumed`, `playerDied`, `playerKilled`, `welcome`…
   - Camera, UI, minimap được chuẩn bị và đồng bộ theo state.

## 3. Chu trình server `SnakeGameRoom`

1. **onCreate**:
   - Khởi tạo `SnakeGameState` (kích thước map 8000×8000, tối đa 1000 food).
   - Đăng ký message handler: `move`, `boost`, `respawn`, `eatFood`, `playerDied`.
   - Tạo sẵn lượng food ban đầu, mở vòng lặp game `gameLoop()` mỗi 16 ms.
2. **onJoin**:
   - Random vị trí spawn, gán màu theo skin, tạo 5 segment đầu tiên.
   - Lưu player trong `state.players`, gửi cho client gói `welcome` và danh sách `initialFoods`.
3. **gameLoop**:
   - Lặp qua từng player còn sống → `movePlayer()` theo góc mới nhất.
   - Kiểm tra va chạm với snake khác và biên map (`checkPlayerCollisions()`).
   - Tự động bổ sung food nếu thiếu.
4. **onLeave/onDispose**: dọn state khi người chơi rời phòng hoặc phòng bị hủy.

## 4. Giao tiếp client ↔ server trong trận

- **Điều khiển hướng** (`move`): Mỗi frame client gửi góc mới (đã giới hạn tốc độ đổi góc để tránh giật). Server cập nhật hướng và vị trí trong state, chỉ đồng bộ lại đầu snake (`headPosition`) để giảm tải.
- **Boost** (`boost`): Khi giữ chuột, client gửi trạng thái boost. Server xác thực và trừ điểm/dài nếu giữ boost lâu.
- **Ăn thức ăn** (`eatFood`):
  - Client chỉ báo cáo khi nghĩ rằng đã chạm food (đã ẩn sprite tại chỗ để tạo cảm giác mượt).
  - Server kiểm tra player còn sống, food còn tồn tại và khoảng cách hợp lệ (giới hạn 250). Nếu hợp lệ → tăng `score`, thêm segment, broadcast `foodConsumed`, spawn food mới.
- **Chết** (`playerDied` / `playerKilled`):
  - Server phát hiện va chạm hoặc ra ngoài map, đặt `player.alive = false`, broadcast `playerDied`.
  - Nếu có kẻ giết (va vào thân snake khác), server cộng điểm và kill count cho người đó, phát `playerKilled`.
  - Server spawn food tại các segment của snake chết để những người khác thu gom.
- **Respawn** (`respawn`): Client có thể gửi yêu cầu hồi sinh. Server đặt lại vị trí, reset điểm, bật `invulnerable` 3 giây, tái tạo 5 segment cơ bản.

## 5. Đồng bộ state và hiển thị client

- `room.onStateChange` nhận toàn bộ `SnakeGameState` định kỳ. Client lưu lại để dùng trong update loop.
- Vì segment không đồng bộ đầy đủ qua schema (chỉ head), client dựng lại thân snake bằng nội suy vị trí giữa các frame và dữ liệu cục bộ.
- UI (điểm số, leaderboard, minimap) đọc từ `gameState` và cập nhật mỗi 1 giây hoặc theo sự kiện.
- Âm thanh và hiệu ứng (ăn, chết, boost) kích hoạt dựa trên thông điệp server gửi về.

## 6. Các điểm cần lưu ý khi mở rộng

- **Giới hạn phòng**: `maxClients = 20`. Nếu cần nhiều người hơn, cân nhắc tăng số phòng hoặc cấu trúc sharding.
- **Log**: nhiều `console.log` tồn tại để debug; nên giảm khi lên production tránh nghẽn I/O.
- **Bảo toàn server authority**: mọi thay đổi quan trọng (điểm, chiều dài, spawn food) đều diễn ra bên server. Khi thêm tính năng mới, giữ nguyên nguyên tắc “client báo cáo, server quyết định”.
- **Mở rộng gameplay**: Có thể thêm loại food mới, kỹ năng, nhiệm vụ bằng cách mở rộng schema `SnakeGameState` và các handler tương ứng. Đừng quên cập nhật cả client lẫn server để tránh mismatch.

---

Bằng cách hiểu rõ các bước trên, bạn có thể tự tin điều chỉnh hoặc mở rộng game mà không phá vỡ flow hiện tại.
