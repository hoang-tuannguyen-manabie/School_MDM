# Hướng Dẫn Phát Triển & Vận Hành (Development Guide)

## 1. Yêu cầu môi trường
- **Node.js:** `>= 20.0.0` (Hiện tại máy đang dùng `v24.21.0`).
- **Trình quản lý gói:** `pnpm` (chạy qua `corepack pnpm` để không cần cài đặt toàn cục).
- **Cơ sở dữ liệu & Hàng đợi:** PostgreSQL 16 + Redis 7 (chạy qua Docker Compose hoặc dịch vụ local nhẹ).

## 2. Lưu ý tối ưu hóa cho máy phát triển Windows + OneDrive (16 GB RAM)
1. **Cách ly `.pnpm-store` ngoài OneDrive:**
   File `.npmrc` đã cấu hình `store-dir=C:/Users/Manabie/.pnpm-store` để tránh việc OneDrive quét hàng chục nghìn file thư viện.
2. **Giới hạn luồng chạy Turborepo:**
   Các script trong `package.json` gốc đều đặt `--concurrency=2` để tiết kiệm bộ nhớ RAM trên laptop.

## 3. Các lệnh làm việc chuẩn
- Cài đặt gói phụ thuộc:
  ```bash
  corepack pnpm install
  ```
- Build toàn bộ packages và apps:
  ```bash
  corepack pnpm build
  ```
- Kiểm tra kiểu dữ liệu (TypeScript strict mode):
  ```bash
  corepack pnpm typecheck
  ```
- Kiểm tra quy chuẩn code (Lint):
  ```bash
  corepack pnpm lint
  ```
- Chạy Unit Tests:
  ```bash
  corepack pnpm test
  ```

## 4. Khởi động PostgreSQL & Redis (Khi đã bật Docker)
```bash
docker compose -f infrastructure/compose/docker-compose.yml up -d
```
Cấu hình Docker Compose đã giới hạn cứng bộ nhớ (`mem_limit: 256m` cho Postgres và `128m` cho Redis) để đảm bảo máy tính luôn mượt mà.
