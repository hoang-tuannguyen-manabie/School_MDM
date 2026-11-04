# Tài Liệu Xác Minh Hợp Đồng Giao Tiếp MDM (MDM API Contract – Phase 5)

Tài liệu này định nghĩa hợp đồng API đã xác minh giữa **School MDM Portal (`apps/api`)** và 2 nhóm MDM Provider:
1. **Headwind MDM Community (`HEADWIND_COMMUNITY`)**
2. **Classroom DPC Gateway (`CLASSROOM_DPC` – Phương án 0 đồng điều khiển trực tiếp qua LAN)**

---

## 1. Bảng Đối Chiếu Năng Lực Thực Tế (Verified Capability Matrix)

| Capability Key | Ý nghĩa nghiệp vụ tại lớp học | Headwind MDM Community (Mặc định) | Classroom DPC (Android Device Owner - 0 đồng) | Xử lý trên Portal khi `Unsupported` |
| :--- | :--- | :---: | :---: | :--- |
| `deviceInventory` | Đồng bộ danh sách máy, model, OS, pin, `lastSeen` | **Hỗ trợ (`true`)** | **Hỗ trợ (`true`)** | Hoạt động bình thường |
| `appCatalog` | Quản lý danh mục gói APK của trường | **Hỗ trợ (`true`)** | **Hỗ trợ (`true`)** | Hoạt động bình thường |
| `installApplication` | Cài đặt/cập nhật APK xuống thiết bị | **Hỗ trợ (`true`)** *(qua Configuration)* | **Hỗ trợ (`true`)** *(Silent Install)* | Hoạt động bình thường |
| `removeApplication` | Gỡ ứng dụng khỏi thiết bị | **Hỗ trợ (`true`)** *(qua Configuration)* | **Hỗ trợ (`true`)** *(Silent Uninstall)* | Hoạt động bình thường |
| `applyConfiguration` | Áp dụng cấu hình thiết bị | **Hỗ trợ (`true`)** | **Hỗ trợ (`true`)** | Hoạt động bình thường |
| `kioskMode` | Khóa cứng máy vào 1 ứng dụng học/thi | **Không hỗ trợ (`false`)** *(Thuộc bản Enterprise)* | **Hỗ trợ (`true`)** *(`startLockTask`)* | Vô hiệu hóa nút & trả về `UNSUPPORTED` |
| `appAllowlist` | Ẩn/đóng băng YouTube, Game trong tiết học | **Không hỗ trợ (`false`)** | **Hỗ trợ (`true`)** *(`setPackagesSuspended`)* | Vô hiệu hóa nút & trả về `UNSUPPORTED` |
| `remoteLock` | Khóa tắt màn hình tức thì ("Chú ý lên bảng") | **Không hỗ trợ (`false`)** | **Hỗ trợ (`true`)** *(`lockNow()`)* | Vô hiệu hóa nút & trả về `UNSUPPORTED` |
| `remoteReboot` | Khởi động lại máy từ xa | **Không hỗ trợ (`false`)** | **Hỗ trợ (`true`)** *(`reboot()`)* | Vô hiệu hóa nút & trả về `UNSUPPORTED` |
| `urlFiltering` | Lọc danh sách đen/trắng URL trình duyệt | **Không hỗ trợ (`false`)** | **Không hỗ trợ (`false`)** *(Dùng DNS LAN/Chrome Policy)* | Vô hiệu hóa & hiển thị hướng dẫn DNS nội bộ |

---

## 2. Hợp Đồng Giao Tiếp Headwind MDM Community (`HEADWIND_COMMUNITY`)

- **Cơ chế xác thực:** JWT / Session Header tới `/rest/public/jwt/login`.
- **Danh sách thiết bị:** `POST /rest/private/devices/search` (lấy `id`, `number`, `imei`, `phone`, `configurationId`, `statusTime`, `info` JSON chứa `model`, `androidVersion`, `batteryLevel`, `files`/`applications`).
- **Danh mục ứng dụng:** `GET /rest/private/applications/search/{value}`.
- **Giới hạn bắt buộc tuân thủ:**
  - Headwind Community điều khiển thiết bị thông qua việc gán thiết bị vào một `Configuration` và chờ thiết bị đồng bộ định kỳ (pull config), không có lệnh khóa màn hình tức thời (`remoteLock`) hay đóng băng ứng dụng tạm thời theo tiết học (`appAllowlist`) nếu không mua plugin Enterprise.
  - Khi `HeadwindAdapter` đang được chọn, mọi yêu cầu `LOCK_DEVICE`, `APPLY_KIOSK_POLICY`, `APPLY_ALLOWLIST` phải trả về trạng thái `UNSUPPORTED` ngay lập tức, tuyệt đối không trả về `SUCCESS` giả.

---

## 3. Hợp Đồng Giao Tiếp Classroom DPC Agent (`CLASSROOM_DPC` – 0 Đồng)

Để đảm bảo giáo viên điều khiển được toàn bộ tablet trong lớp học với chi phí bản quyền **0 đồng** và độ trễ **< 0.5 giây**, các thiết bị Android (đã kích hoạt quyền `Device Owner` miễn phí qua `adb shell dpm set-device-owner`) giao tiếp trực tiếp với `School API` qua mạng LAN nội bộ:

### 3.1. Heartbeat & Đồng bộ Trạng thái Thiết bị
- **Endpoint:** `POST /api/v1/mdm/agent/heartbeat`
- **Header xác thực:** `x-classroom-dpc-secret: <CLASSROOM_DPC_SHARED_SECRET>`
- **Payload:**
  ```json
  {
    "externalDeviceId": "tab-6a1-01",
    "serialNumber": "R58T30ABCDE",
    "manufacturer": "Samsung",
    "model": "SM-X200",
    "androidVersion": "13",
    "sdkVersion": 33,
    "batteryLevel": 85,
    "installedApps": [
      {
        "packageName": "vn.edu.school.math",
        "name": "Toán Học Lớp 6",
        "versionName": "1.2.0",
        "versionCode": 12
      }
    ]
  }
  ```
- **Quy tắc tính trạng thái Online/Offline:**
  - Nếu chưa từng có `lastSeenAt` → `UNKNOWN`.
  - Nếu `now - lastSeenAt <= CLASSROOM_OFFLINE_THRESHOLD_SEC` (mặc định `45s`) → `ONLINE`.
  - Nếu `now - lastSeenAt > CLASSROOM_OFFLINE_THRESHOLD_SEC` → `OFFLINE`.

### 3.2. Phản hồi Kết quả Thực thi Lệnh từ Thiết bị
- **Endpoint:** `POST /api/v1/mdm/agent/commands/:externalCommandId/ack`
- **Header xác thực:** `x-classroom-dpc-secret: <CLASSROOM_DPC_SHARED_SECRET>`
- **Payload:**
  ```json
  {
    "status": "ACKNOWLEDGED | SUCCESS | FAILED",
    "reason": "Đã khóa màn hình qua DevicePolicyManager.lockNow()"
  }
  ```
