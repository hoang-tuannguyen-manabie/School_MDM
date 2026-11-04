# HƯỚNG DẪN TRIỂN KHAI LOCAL SERVER, VẬN HÀNH & PILOT TRÊN THIẾT BỊ ANDROID THẬT (PHASE 12)

Tài liệu này hướng dẫn quy trình vận hành hệ thống **School MDM Portal** trên máy chủ nội bộ (LAN Server) của trường học và quy trình thử nghiệm (Pilot) trên **1–5 máy tính bảng Android thật** với **0đ chi phí bản quyền phát sinh**.

---

## 1. Khởi chạy Hệ thống trên Máy chủ LAN tại Trường

### 1.1. Cấu hình biến môi trường (`.env`)
Hệ thống đã được cấu hình sẵn kết nối tới **Supabase PostgreSQL** (Pooler IPv4 `aws-0-ap-northeast-2.pooler.supabase.com:5432`) và sử dụng `CLASSROOM_DPC` làm MDM Provider mặc định miễn phí.

Kiểm tra các thông số quan trọng trong `school-mdm/.env`:
```env
NODE_ENV=development
API_PORT=4000
WEB_ORIGIN=http://localhost:5173
PUBLIC_LAN_URL=https://192.168.1.79:8443
MDM_DEFAULT_PROVIDER=CLASSROOM_DPC
CLASSROOM_HEARTBEAT_INTERVAL_SEC=15
CLASSROOM_OFFLINE_THRESHOLD_SEC=45
```

### 1.2. Các lệnh kiểm tra và khởi chạy
Tại thư mục `school-mdm/`:
```powershell
# Kiểm tra toàn bộ mã nguồn (Lint, Typecheck, Unit & Integration Tests)
pnpm lint
pnpm typecheck
pnpm test

# Build toàn bộ các gói và ứng dụng
pnpm build
```

---

## 2. Thiết lập HTTPS Nội bộ (LAN TLS) với `mkcert`

Để các thiết bị Android (từ Android 9+) tải APK và gửi Heartbeat qua HTTPS nội bộ mà không bị lỗi `CLEARTEXT_NOT_PERMITTED` hoặc lỗi chứng chỉ tự ký:

1. Tạo Root CA nội bộ trên máy chủ của trường:
   ```powershell
   mkcert -install
   mkcert -key-file infrastructure/nginx/certs/school-lan.key -cert-file infrastructure/nginx/certs/school-lan.crt 192.168.1.79 mdm.school.local localhost
   ```
2. Cài đặt file `rootCA.pem` (lấy từ `mkcert -CAROOT`) vào mục **Chứng chỉ CA tin cậy** trên 1–5 tablet thử nghiệm, hoặc khai báo `network_security_config.xml` trong ứng dụng `Classroom DPC Agent`.

---

## 3. Hướng dẫn Kích hoạt Chế độ Device Owner Miễn phí (`CLASSROOM_DPC`) trên 1–5 Tablet Android Thật

Chế độ **Device Owner** là tính năng gốc miễn phí 100% của hệ điều hành Android (`android.app.admin.DevicePolicyManager`), cho phép khóa màn hình tức thời (`lockNow`), ghim ứng dụng học tập (`startLockTask`), và khóa các ứng dụng gây xao nhãng (`setPackagesSuspended`).

### Bước 1: Chuẩn bị trên Tablet Android
1. Nếu tablet đang có tài khoản Google cá nhân, hãy vào **Cài đặt → Tài khoản** và tạm thời gỡ tài khoản Google (Android yêu cầu không có tài khoản nào trên máy tại thời điểm gán quyền Device Owner; sau khi gán xong có thể đăng nhập lại bình thường).
2. Bật **Tùy chọn nhà phát triển (Developer Options)** → Bật **Gỡ lỗi USB (USB Debugging)**.

### Bước 2: Kết nối cáp USB với máy tính của trường và kiểm tra ADB
```powershell
adb devices
```
Đảm bảo thiết bị hiển thị trạng thái `device` (nhấn *Cho phép USB Debugging* trên màn hình tablet nếu được hỏi).

### Bước 3: Cài đặt APK Agent và kích hoạt quyền Device Owner
```powershell
# 1. Cài đặt Classroom DPC Agent lên tablet
adb install -r classroom-dpc-agent.apk

# 2. Cấp quyền Device Owner cho Agent
adb shell dpm set-device-owner vn.school.mdm.dpc/.ClassroomDeviceAdminReceiver
```
Khi màn hình trả về:
```text
Success: Active admin and device owner set to ComponentInfo{vn.school.mdm.dpc/vn.school.mdm.dpc.ClassroomDeviceAdminReceiver}
```
Tablet đã chính thức nằm dưới sự quản lý toàn diện của **School MDM Portal** mà không tốn bất kỳ chi phí license nào.

---

## 4. Kịch bản Kiểm thử Pilot (Acceptance Checklist trên 1–5 Tablet Thật)

| STT | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả nghiệm thu thực tế (Pass Criteria) |
| :--- | :--- | :--- | :--- |
| **1** | **Đăng ký & Đồng bộ Heartbeat** | Mở Classroom DPC Agent trên tablet, nhập IP LAN máy chủ (`http://192.168.1.79:4000`). | Agent gửi `POST /api/v1/mdm/agent/heartbeat` mỗi 15 giây; Portal hiển thị trạng thái `ONLINE` kèm % pin và danh sách ứng dụng thực tế. |
| **2** | **Kiểm chứng phát hiện Offline thật** | Tắt Wi-Fi trên 1 tablet trong lớp và chờ 45 giây. | Sau 45 giây không có heartbeat mới, Portal tự động chuyển trạng thái tablet đó sang `OFFLINE` (tuyệt đối không giữ trạng thái `ONLINE` giả). |
| **3** | **Khóa màn hình tức thời (`LOCK_DEVICE`)** | Giáo viên chọn lớp `6A1` → Nhấn **Khóa màn hình lớp học** → Xác nhận. | Lệnh chuyển từ `PENDING` → `SENT`. Tablet đang bật Wi-Fi tắt/khóa màn hình trong ≤ 2 giây và gửi ACK `SUCCESS`. |
| **4** | **Bắt đầu Phiên học Kiosk khi có máy Offline** | Tạo phiên học Tiết Toán (Kiosk: `vn.manabie.learner`) khi Tablet 1 `ONLINE` và Tablet 2 `OFFLINE`. | Tablet 1 vào chế độ Kiosk (`POLICY_APPLIED`). Tablet 2 hiển thị `WAITING_DEVICE_ONLINE` (không báo thành công giả). |
| **5** | **Tự động đồng bộ khi Tablet kết nối lại (Reconnect Reconciliation)** | Bật lại Wi-Fi trên Tablet 2 đang ở trong tiết học `ACTIVE`. | Ngay khi Tablet 2 gửi heartbeat đầu tiên, `SessionsService.reconcileDeviceOnHeartbeat` tự động đẩy lệnh Kiosk xuống Tablet 2. |
| **6** | **Kết thúc tiết học (`endSession`) an toàn** | Giáo viên nhấn **Kết thúc tiết học**. | Chỉ những tablet đã phản hồi gỡ Kiosk thành công mới chuyển sang `RELEASED`; tablet mất mạng giữ trạng thái `WAITING_RELEASE_ONLINE`. |

---

## 5. Quy trình Sao lưu & Phục hồi Dữ liệu (Backup & Restore)

### 5.1. Sao lưu Cơ sở dữ liệu PostgreSQL
```powershell
pg_dump --dbname="$env:DATABASE_URL" --format=custom --file="backups/school_mdm_$(Get-Date -Format 'yyyyMMdd_HHmm').dump"
```

### 5.2. Phục hồi Cơ sở dữ liệu khi cần thiết
```powershell
pg_restore --dbname="$env:DATABASE_URL" --clean --if-exists "backups/school_mdm_YYYYMMDD_HHMM.dump"
```
> **Lưu ý an toàn**: Luôn kiểm tra bản sao lưu trên môi trường staging trước khi chạy phục hồi và không bao giờ sử dụng `prisma db push` trên dữ liệu vận hành thực tế.
