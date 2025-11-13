# snake-game

This project contains both backend (NestJS + Colyseus) and UI (Phaser) components.

## Getting Started

1. Cài dependencies cho toàn bộ dự án:
   ```bash
   pnpm install:all
   ```
2. Khởi chạy đồng thời backend và UI:
   ```bash
   pnpm dev
   ```
   Lệnh này sẽ mở backend (Nest + Colyseus) trên `http://localhost:2567` và UI trên port do Vite cấp (mặc định `5173`).

## Project Structure

- `/backend`: Mã nguồn NestJS, bao gồm module Colyseus server, API, cấu hình cơ sở dữ liệu, queue và worker.
- `/ui`: Ứng dụng frontend Phaser/Vite hiển thị game, bao gồm các scene, services và cấu hình build.
- `/page`: Landing page tĩnh (export từ Framer) với `index.html`, `styles/`, `scripts/`, `assets/` dùng để giới thiệu sản phẩm.
- `/docs`: Tài liệu kỹ thuật, flow nghiệp vụ và hướng dẫn bổ trợ cho dự án.

> Yêu cầu: sử dụng `pnpm` cho toàn bộ thao tác cài đặt và chạy dự án.
