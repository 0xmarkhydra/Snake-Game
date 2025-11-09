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

- `/backend` - Backend NestJS (Colyseus server, APIs)
- `/ui` - Frontend UI (Phaser 2D game)

> Yêu cầu: sử dụng `pnpm` cho toàn bộ thao tác cài đặt và chạy dự án.
