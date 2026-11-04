# School MDM Portal

Hệ thống Quản trị Thiết bị Máy tính bảng Android trong Môi trường Trường học (**School MDM Portal**).

## 1. Mục tiêu sản phẩm
- Quản lý tập trung thiết bị máy tính bảng Android theo **Năm học**, **Lớp học**, **Giáo viên**, **Ứng dụng**, **Chính sách (Policies)** và **Phiên học (Class Sessions)**.
- Phân quyền chặt chẽ ở cấp độ Backend (`ADMIN` và `TEACHER` theo phạm vi lớp học được phân công).
- Điều phối thiết bị thông qua kiến trúc **Provider Adapter (`MdmAdapter`)**, hỗ trợ:
  1. **Classroom DPC Mode (`CLASSROOM_DPC` – Khuyến nghị 0 đồng chi phí bản quyền):** Kết nối trực tiếp qua mạng Wi-Fi LAN lớp học tới Android Device Owner Agent để thực thi đầy đủ Kiosk Mode, Khóa màn hình tức thì, Chặn ứng dụng ngoài giờ học và Cài APK âm thầm.
  2. **Headwind MDM Community (`HEADWIND_COMMUNITY`):** Tích hợp đồng bộ thiết bị, ứng dụng và cấu hình theo đúng capability thực tế mà phiên bản Community hỗ trợ.
- **Nguyên tắc trung thực trạng thái:** Mọi lệnh đều phản ánh đúng trạng thái thực tế (`Pending`, `Sent`, `Acknowledged`, `Success`, `Failed`, `Timeout`, `Unsupported`). Tuyệt đối không giả lập thiết bị online hay kết quả thành công giả.

## 2. Cấu trúc Monorepo
```text
school-mdm/
├── apps/
│   ├── web/                # React + Vite + TypeScript + Tailwind CSS + shadcn/ui
│   ├── api/                # NestJS REST API + Socket.IO Gateway + RBAC + MdmAdapter
│   └── worker/             # NestJS Background Worker (Command Queue, Device Sync)
├── packages/
│   ├── contracts/          # Shared TypeScript types, DTO interfaces, MDM contracts
│   ├── validation/         # Shared Zod schemas & environment validators
│   └── ui/                 # Shared UI primitives & design tokens
├── database/
│   └── migrations/         # Prisma / SQL versioned migrations
├── infrastructure/
│   ├── compose/            # Docker Compose (PostgreSQL, Redis, Nginx)
│   └── nginx/              # Internal HTTPS Reverse Proxy config
└── docs/
    ├── architecture.md
    └── development-guide.md
```

## 3. Khởi chạy nhanh (Development)

```bash
# 1. Cài đặt dependencies
corepack pnpm install

# 2. Tạo file cấu hình môi trường
cp .env.example .env

# 3. Kiểm tra lint, typecheck và unit test toàn monorepo
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
```

Xem chi tiết tại [docs/architecture.md](./docs/architecture.md) và [docs/development-guide.md](./docs/development-guide.md).
