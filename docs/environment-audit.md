# Báo Cáo Kiểm Tra Hiện Trạng Môi Trường (Phase 0 – Environment Audit)

**Dự án:** School MDM Portal  
**Ngày kiểm tra:** 04/11/2026  
**Thư mục Workspace:** `c:\Users\Manabie\OneDrive\Documents\manabie\coding\DMD_Manabie`  
**Trạng thái thực thi:** Chỉ đọc (Read-only Audit) – Chưa cài đặt hay thay đổi bất kỳ cấu hình hệ thống nào.

---

## 1. Tóm tắt kiến trúc & Yêu cầu từ Tài liệu Đặc tả

### 1.1. Tóm tắt kiến trúc tổng thể
Hệ thống **School MDM Portal** được thiết kế theo kiến trúc phân tách rõ ràng giữa **Nghiệp vụ trường học (School Domain)** và **Nền tảng quản trị thiết bị (MDM Provider)**:
- **Frontend (`apps/web`):** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query + React Hook Form + Zod + Socket.IO Client. Giao diện theo chuẩn School Management System phục vụ 2 vai trò `ADMIN` và `TEACHER`.
- **Backend API (`apps/api`):** NestJS + TypeScript + Prisma ORM. Đảm nhiệm Authentication (JWT + HttpOnly Refresh Cookie), RBAC cấp độ endpoint & phạm vi lớp học (Class Scope), quản lý năm học/lớp/thiết bị/chính sách/phiên học, Audit Logging và giao tiếp với MDM qua `MdmAdapter`.
- **Background Worker (`apps/worker`):** NestJS Worker + BullMQ/Redis. Xử lý đồng bộ thiết bị định kỳ/thủ công, hàng đợi lệnh (`Command Engine`) với cơ chế Idempotency, Retry, Timeout, Expiration và phát sự kiện Realtime qua Socket.IO.
- **Cơ sở dữ liệu (`School DB`):** PostgreSQL độc lập hoàn toàn với database nội bộ của Headwind MDM.
- **Lớp tích hợp (`MdmAdapter`):** Giao tiếp với **Headwind MDM Community** (giai đoạn MVP) qua REST API chuẩn và sẵn sàng chuyển đổi sang **Custom Android DPC** (định hướng dài hạn) mà không cần viết lại logic nghiệp vụ trường học.

### 1.2. Yêu cầu chức năng (Functional Requirements)
1. **Authentication & Session:** Đăng nhập, làm mới token (`HttpOnly, Secure, SameSite`), đăng xuất, đổi mật khẩu, quản lý phiên đăng nhập.
2. **Users & RBAC:** Phân quyền `ADMIN` (toàn quyền hệ thống) và `TEACHER` (chỉ truy cập lớp và thiết bị được phân công, tạo/kết thúc phiên học và gửi lệnh trong phạm vi cho phép). Kiểm tra quyền bắt buộc tại Backend.
3. **Quản lý trường học (School Structure):** Quản lý năm học (`academic_years`), lớp học (`classes`), học sinh (`students`), phân công giáo viên – lớp (`teacher_classes`).
4. **Quản lý thiết bị (Device Inventory):** Danh sách & chi tiết thiết bị, trạng thái thực tế (`Online`, `Offline`, `Unknown`, `Pending`, `Error`), `lastSeen`, hãng/model/Android version, danh sách ứng dụng đã cài, lịch sử gán lớp (`device_assignments` chỉ 1 bản ghi active tại một thời điểm).
5. **Tích hợp MDM & Đồng bộ (`MDM Integration`):** Cấu hình kết nối provider, kiểm tra kết nối, khám phá năng lực thực tế (`getCapabilities`), đồng bộ thiết bị/ứng dụng (Initial, Scheduled, Manual), ánh xạ `externalDeviceId` chống trùng lặp.
6. **Quản lý ứng dụng (`App Catalog`):** Danh mục ứng dụng, phê duyệt ứng dụng, theo dõi trạng thái cài đặt trên từng thiết bị, gửi lệnh cài/cập nhật/gỡ nếu provider hỗ trợ.
7. **Quản lý chính sách (`Policy Engine`):** Tạo, nhân bản, quản lý phiên bản (`policy_versions`), xuất bản (`Published` là bất biến/immutable), kiểm tra tương thích với capability thực tế của provider. Vô hiệu hóa và giải thích rõ các tính năng không được Headwind Community hỗ trợ.
8. **Quản lý lệnh (`Command Engine`):** Hàng đợi lệnh có `idempotency_key`, `expires_at`, retry policy, lịch sử `command_attempts`, theo dõi trạng thái trên từng thiết bị (`Pending`, `Sent`, `Acknowledged`, `Success`, `Failed`, `Timeout`, `Unsupported`).
9. **Phiên học (`Class Sessions`):** Giáo viên tạo, bắt đầu, giám sát thiết bị/lệnh trong tiết học, xử lý thiết bị mất kết nối Wi-Fi và kết nối lại (offline reconciliation), kết thúc phiên học.
10. **Realtime, Audit & Báo cáo:** Cập nhật trạng thái tức thời qua Socket.IO (kiểm tra quyền theo room), ghi nhận `audit_logs` cho mọi thao tác nhạy cảm và xuất báo cáo vận hành.

### 1.3. Yêu cầu phi chức năng (Non-Functional Requirements)
- **Tính trung thực của trạng thái MDM:** Tuyệt đối không giả lập thiết bị online, không trả về kết quả thành công giả khi chưa có phản hồi từ provider, không suy diễn API của Headwind.
- **Bảo mật:** HTTPS nội bộ với chứng chỉ được Android tin cậy; cô lập DB/Redis khỏi mạng học sinh; không lưu secrets trong mã nguồn; rate-limit đăng nhập.
- **An toàn dữ liệu & Migration:** Dùng UUID, soft-delete khi phù hợp, migration có quy trình rollback, tuyệt đối không chạy `prisma db push` trên production.
- **Chất lượng mã nguồn:** Monorepo (`pnpm` + `Turborepo`), TypeScript `strict`, kiểm thử Unit, Integration, RBAC và Pilot thực tế trên 1–5 thiết bị Android.

### 1.4. Các điểm chưa rõ cần xác nhận trước các Phase tiếp theo
1. **Máy chủ triển khai thực tế:** Máy hiện tại (Dell Latitude 5420, RAM 16 GB, đang dùng Wi-Fi `192.168.1.79` và thư mục làm việc nằm trong `OneDrive`) là **máy phát triển (dev machine)** kiêm máy thử nghiệm ban đầu, hay sẽ có một máy chủ cố định riêng tại trường?
2. **Tiến trình `java.exe` trên cổng `8443` / `8000`:** Hiện có một tiến trình `java.exe` (PID `29980`) đang lắng nghe trên cổng `8443` và `8000`. Cần xác nhận đây là dịch vụ gì để tránh xung đột với cổng HTTPS/Tomcat thường dùng của Headwind MDM.
3. **Thông tin chi tiết 1–5 thiết bị Android thử nghiệm:** Hiện chưa có thiết bị cắm qua USB/ADB và chưa cài `adb`. Cần danh sách cụ thể (Hãng, Model, phiên bản Android, có Google Play Services hay không, máy mới hay đang có dữ liệu cần sao lưu).
4. **Phiên bản Headwind MDM Community dự kiến cài đặt:** Sẽ xác minh chính xác bản build/version và Swagger/API sau khi cài đặt ở môi trường cô lập được phê duyệt.

---

## 2. Bảng Hiện Trạng Môi Trường (Environment Summary)

### 2.1. Hệ điều hành & Phần cứng
| Hạng mục | Giá trị ghi nhận thực tế | Đánh giá |
| :--- | :--- | :--- |
| **Thiết bị máy chủ** | Dell Inc. Latitude 5420 | Laptop doanh nhân, phù hợp làm môi trường Dev / Pilot nhỏ (1–5 máy) |
| **Hệ điều hành** | Microsoft Windows 11 Pro (64-bit) – Build `26200` (Version `10.0.26200`) | Hỗ trợ đầy đủ WSL2 và Hyper-V |
| **CPU** | 11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz (4 nhân / 8 luồng) | Đủ đáp ứng stack NestJS + React + Postgres + Redis + Headwind cho 1–5 thiết bị |
| **Ảo hóa (Hypervisor)** | `HypervisorPresent: true` (`HvHost` service đang chạy) | Đã bật ảo hóa nền tảng Windows |
| **RAM vật lý** | **15.41 GB** (Tổng 16 GB) – **RAM trống tại thời điểm đo: ~1.74 GB** | **Cảnh báo:** Dung lượng RAM trống hiện tại khá thấp (~1.74 GB), cần giới hạn bộ nhớ nếu chạy WSL2/Docker |
| **Ổ cứng (`C:`)** | NTFS – Tổng **475.96 GB**, Trống **328.87 GB** | Rất dồi dào cho Docker images, database và kho APK của Headwind |
| **Thư mục Workspace** | `c:\Users\Manabie\OneDrive\Documents\manabie\coding\DMD_Manabie` | Đang trống (chỉ chứa báo cáo này). **Lưu ý:** Nằm trong thư mục đồng bộ OneDrive |

### 2.2. Công cụ & Dịch vụ Nền tảng (WSL, Docker, CLI)
| Công cụ / Dịch vụ | Trạng thái | Chi tiết |
| :--- | :--- | :--- |
| **WSL / WSL2** | **Chưa cài đặt** | `wsl --status` báo: *The Windows Subsystem for Linux is not installed.* |
| **Docker / Docker Compose** | **Chưa cài đặt** | Chưa có `docker` CLI, Docker Desktop hoặc Docker Engine trên máy. |
| **Node.js & npm** | **Đã cài đặt** | `node.exe` v24.21.0 (`C:\Program Files\nodejs\node.exe`), `npm` có sẵn. |
| **pnpm** | **Chưa cài đặt** | Cần cài đặt (hoặc bật qua `corepack enable`) khi bước sang Phase 1. |
| **Git** | **Đã cài đặt** | `git.exe` v2.55.0.5 (`C:\Program Files\Git\cmd\git.exe`). |
| **ADB (Android Platform Tools)** | **Chưa cài đặt** | Không tìm thấy `adb` trong `PATH` hoặc `%LOCALAPPDATA%\Android\Sdk`. |
| **PostgreSQL / Redis (Native)** | **Chưa cài đặt** | Không có dịch vụ Postgres hay Redis chạy trực tiếp trên Windows. |

---

## 3. Hiện Trạng Mạng & Cổng Kết Nối (Network & Port Conflicts)

### 3.1. Cấu hình mạng LAN hiện tại
- **Giao diện mạng đang hoạt động:** `Wi-Fi` (`Up`)
- **Địa chỉ IPv4 LAN:** `192.168.1.79`
- **Default Gateway:** `192.168.1.1`
- **DNS Servers:** `8.8.8.8`, `116.97.90.127`

### 3.2. Kiểm tra các cổng mục tiêu
Đã kiểm tra các cổng: `80`, `443`, `3000`, `3001`, `4000`, `5173`, `5432`, `6379`, `8000`, `8080`, `8443`, `9000`, `31000`.

| Cổng (Port) | Mục đích dự kiến | Trạng thái hiện tại | Tiến trình chiếm giữ | Mức độ xung đột |
| :---: | :--- | :--- | :--- | :--- |
| `80` | Nginx HTTP / Redirect | Trống | Không có | An toàn |
| `443` | Nginx HTTPS (School Portal & MDM Proxy) | Trống | Không có | An toàn |
| `3000` / `4000` | School API (NestJS) | Trống | Không có | An toàn |
| `5173` | School Web Dev Server (Vite) | Trống | Không có | An toàn |
| `5432` | PostgreSQL | Trống | Không có | An toàn |
| `6379` | Redis | Trống | Không có | An toàn |
| `8080` | Headwind MDM (HTTP/Tomcat mặc định) | Trống | Không có | An toàn |
| **`8443`** | **Headwind MDM / HTTPS Tomcat** | **ĐANG BẬN (`::`)** | `java.exe` (PID `29980`) | **XUNG ĐỘT TRỰC TIẾP** |
| **`8000`** | **Tomcat Shutdown / Dev Port** | **ĐANG BẬN (`127.0.0.1`)** | `java.exe` (PID `29980`) | **XUNG ĐỘT TIỀM ẨN** |
| `31000` | Headwind Push / MQTT / WebSocket | Trống | Không có | An toàn |

---

## 4. Mức Độ Sẵn Sàng Của Thiết Bị Android (Android Readiness)

- **Kết nối ADB hiện tại:** Chưa cài đặt `adb` trên máy chủ và chưa có thiết bị Android nào được kết nối qua USB/TCP.
- **Thông tin 1–5 thiết bị thử nghiệm:** Chưa thu thập được qua lệnh tự động (`ro.product.model`, `ro.build.version.release`, trạng thái Google Play Services).
- **Quy tắc an toàn áp dụng:**
  - Chưa cài đặt bất kỳ agent nào lên thiết bị.
  - Không thực hiện Factory Reset hay kích hoạt chế độ Device Owner cho đến khi xác minh được danh sách thiết bị, trạng thái dữ liệu trên máy và được phê duyệt kế hoạch sao lưu.

---

## 5. Phân Tích Rủi Ro (Risks)

1. **Rủi ro thiếu hụt RAM khả dụng (`High`):**
   - Máy có tổng 16 GB RAM nhưng tại thời điểm kiểm tra chỉ còn trống **~1.74 GB RAM**.
   - Nếu chạy Ubuntu VM (Hyper-V) cấp phát cứng 4–8 GB RAM, máy sẽ bị thiếu RAM nghiêm trọng. Ngay cả với WSL2 + Docker, nếu không cấu hình giới hạn `.wslconfig` (ví dụ `memory=6GB`), tiến trình `vmmemWSL` có thể chiếm hết bộ nhớ làm treo máy.
2. **Rủi ro xung đột cổng `8443` và `8000` bởi `java.exe` (PID `29980`) (`Medium`):**
   - Headwind MDM (chạy trên Tomcat) thường sử dụng cổng `8080`/`8443` và cổng shutdown `8005`/`8000`. Cần xác định rõ tiến trình `java.exe` (PID `29980`) hiện tại là ứng dụng gì (có phải một bản Tomcat hay dịch vụ nội bộ đang chạy ngầm không) và ánh xạ cổng container Headwind sang cổng riêng (ví dụ `18080` nội bộ sau Nginx Reverse Proxy `443`).
3. **Rủi ro đặt Monorepo trong thư mục `OneDrive` (`Medium-High`):**
   - Đường dẫn hiện tại `c:\Users\Manabie\OneDrive\Documents\manabie\coding\DMD_Manabie` nằm trong thư mục đồng bộ đám mây OneDrive.
   - Khi tạo monorepo có `node_modules` (hàng chục nghìn file nhỏ) và chạy trình biên dịch của Vite/NestJS/Turborepo, OneDrive sẽ liên tục quét và đồng bộ, gây khóa file (file lock trên Windows), làm chậm tốc độ build và tốn băng thông/CPU/RAM.
4. **Rủi ro mạng Wi-Fi & IP động (`Medium`):**
   - Máy đang kết nối qua Wi-Fi với IP `192.168.1.79` (DHCP). Nếu IP LAN của máy chủ thay đổi sau khi thiết bị Android đã enroll vào Headwind MDM (hoặc nếu Router Wi-Fi bật tính năng *AP Client Isolation*), thiết bị Android sẽ mất kết nối tới MDM server.
5. **Rủi ro giới hạn tính năng của Headwind Community (`High - Product Constraint`):**
   - Bản Community không hỗ trợ đầy đủ Kiosk Mode / App Allowlist / URL Filtering nâng cao như bản Enterprise. Giao diện và Backend bắt buộc phải kiểm tra `getCapabilities()` và hiển thị rõ trạng thái `Unsupported` thay vì giả lập thành công.

---

## 6. So Sánh & Đề Xuất Mô Hình Triển Khai (WSL2 vs. Ubuntu VM trên Hyper-V)

| Tiêu chí | Phương án A: Ubuntu 24.04 LTS trên WSL2 + Docker (ĐỀ XUẤT) | Phương án B: Ubuntu 24.04 LTS VM trên Hyper-V |
| :--- | :--- | :--- |
| **Tiêu thụ RAM & CPU** | **Thấp & Linh hoạt:** Chia sẻ nhân, thu hồi RAM động, có thể giới hạn qua `.wslconfig` (ví dụ tối đa 6 GB). Rất phù hợp với máy 16 GB RAM đang mở nhiều ứng dụng. | **Cao & Cố định:** Phải cấp phát cứng tối thiểu 4–6 GB RAM riêng cho VM, dễ gây quá tải khi máy chỉ còn ~1.74 GB RAM trống. |
| **Mạng LAN cho Android** | Windows 11 Build `26200` hỗ trợ chế độ **`networkingMode=mirrored`** trong `.wslconfig`, giúp WSL2 dùng chung IP LAN `192.168.1.79` với Windows mà không cần script `netsh interface portproxy` thủ công. | Cấp IP LAN riêng qua External Virtual Switch, nhưng dễ gặp lỗi kết nối khi dùng card mạng **Wi-Fi** (Hyper-V External Switch trên Wi-Fi thường không ổn định bằng Ethernet). |
| **Tích hợp công cụ Dev** | Rất thuận tiện: IDE trên Windows kết nối trực tiếp vào WSL2/Docker. | Phải quản lý qua SSH vào máy ảo riêng biệt. |

### Kết luận đề xuất Topology:
- **Chọn Phương án A: WSL2 (Ubuntu 24.04 LTS) với `networkingMode=mirrored` + Docker Compose.**
- **Cấu trúc vận hành trên máy Local:**
  - Cấu hình `.wslconfig` giới hạn RAM hợp lý (ví dụ `memory=6GB`, `processors=4`, `networkingMode=mirrored`).
  - Chạy **PostgreSQL**, **Redis**, **Headwind MDM Community**, và **Nginx Reverse Proxy (HTTPS)** trong Docker Compose trên WSL2.
  - Toàn bộ giao tiếp từ thiết bị Android trong mạng LAN (`192.168.1.x`) sẽ đi qua cổng `443` (Nginx HTTPS) và được định tuyến nội bộ tới `School API`, `School Web` và `Headwind MDM` (tránh xung đột trực tiếp với cổng `8443` đang bận trên host).

---

## 7. Kế Hoạch Cài Đặt & Điều Kiện Tiên Quyết (Installation Prerequisites)

Trước khi bắt đầu Phase 1 và Phase 5, các bước chuẩn bị môi trường cần được bạn phê duyệt gồm:
1. **Xác nhận vị trí thư mục dự án:**
   - Giữ nguyên tại `c:\Users\Manabie\OneDrive\Documents\manabie\coding\DMD_Manabie` (cần cấu hình loại trừ đồng bộ `node_modules` hoặc dùng pnpm store ngoài OneDrive), **HOẶC** chuyển sang thư mục ngoài OneDrive (ví dụ `C:\projects\school-mdm`) để tối ưu tốc độ I/O và tránh lỗi khóa file.
2. **Cài đặt nền tảng ảo hóa & container:**
   - Cài đặt **WSL2** và bản phân phối **Ubuntu 24.04 LTS** (`wsl --install -d Ubuntu-24.04`).
   - Cài đặt **Docker Engine** bên trong Ubuntu 24.04 WSL2 (nhẹ hơn nhiều so với Docker Desktop trên máy 16 GB RAM) hoặc **Docker Desktop** tùy sở thích của bạn.
3. **Cài đặt công cụ phát triển:**
   - Kích hoạt `pnpm` thông qua Corepack (`corepack enable && corepack prepare pnpm@latest --activate`) trên Node.js v24.21.0 hiện có.
   - Cài đặt **Android SDK Platform-Tools (`adb`)** để kiểm tra thông số 1–5 thiết bị Android thật.
4. **Thiết lập mạng nội bộ ổn định:**
   - Cố định địa chỉ IP LAN (DHCP Reservation trên Router hoặc Static IP cho `192.168.1.79`) để các thiết bị Android không bị mất kết nối tới máy chủ.
   - Chuẩn bị Root CA nội bộ (`mkcert` hoặc Internal CA) để cài đặt chứng chỉ tin cậy lên 1–5 thiết bị Android thử nghiệm cho kết nối HTTPS (`https://mdm.school.local`).
