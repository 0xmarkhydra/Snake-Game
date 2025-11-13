# Landing page Slither.fun

## Tổng quan
- Thư mục `page/` chứa bản dựng tĩnh của landing page quảng bá cho dự án Snake Game.
- Nội dung được export từ Framer nên HTML có cấu trúc phức tạp, nhiều inline styles và assets tối ưu cho trình duyệt.
- Trang trình bày tổng quan game, tính năng, đối tác và kêu gọi người chơi tham gia.

## Cách xem nhanh
- Cách đơn giản nhất: mở trực tiếp `page/index.html` bằng trình duyệt.
- Nếu cần chạy trên server tĩnh để kiểm tra cross-origin, dùng lệnh:
  ```bash
  pnpm dlx serve page
  ```
  Sau đó truy cập địa chỉ hiển thị trên terminal (mặc định `http://localhost:3000`).

## Cấu trúc thư mục
- `index.html`: File chính của landing page.
- `styles/`: CSS bổ sung (layout tổng thể và các tiện ích được Framer chèn thêm).
- `scripts/`: Các đoạn JavaScript nhỏ để xử lý hành vi UI như breakpoints và semantic helpers.
- `assets/`: Hình ảnh, phông chữ, bundle script và media được export kèm từ Framer.

## Tuỳ biến
- Thay đổi nội dung: cập nhật trực tiếp trong `index.html` hoặc chỉnh sửa trên Framer rồi export lại để hạn chế sai lệch layout.
- Điều chỉnh giao diện: ưu tiên sửa trong các file CSS tại `styles/` (ví dụ `layout.css`). Giữ lại cấu trúc class mà Framer sinh để tránh vỡ layout.
- Thay đổi asset: đặt file mới vào `assets/` và cập nhật đường dẫn tương ứng trong HTML/CSS.

## Lưu ý
- Landing page hiện không có build tool, mọi asset nằm trong thư mục `page/`.
- Nếu cần tích hợp vào ứng dụng chính, nên tách riêng phần asset tĩnh và tối ưu lại kích thước hình ảnh.
- Kiểm tra hiển thị trên mobile sau mỗi lần chỉnh sửa vì Framer sử dụng nhiều breakpoint động.
