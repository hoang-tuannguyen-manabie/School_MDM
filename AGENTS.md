# AGENTS.md – Quy Tắc Bắt Buộc Cho AI Agent & Kỹ Sư Phát Triển

Tài liệu này quy định các nguyên tắc bắt buộc khi làm việc trên repository `school-mdm`.

## 1. Nguyên tắc An toàn Hệ thống (BẮT BUỘC)
- **Không tự ý thay đổi môi trường máy chủ:** Không ghi đè PowerShell profile, cấu hình WSL, hoặc xóa container/image/volume/network của Docker khi chưa được xác nhận.
- **Cấm các lệnh phá hủy dữ liệu:** Tuyệt đối không chạy `docker system prune`, `docker volume prune`, `wsl --unregister`, `DROP DATABASE`, hay `prisma db push` trên môi trường production.
- **Bảo mật thông tin:** Không bao giờ commit file `.env`, private key, chứng chỉ, hoặc API token vào Git.

## 2. Nguyên tắc Trung thực MDM (No Fake MDM State)
- **Không giả lập trạng thái Online:** Trạng thái `ONLINE` của thiết bị phải dựa trên dữ liệu heartbeat hoặc đồng bộ thực tế từ provider trong ngưỡng thời gian hợp lệ.
- **Không giả lập lệnh thành công:** Mọi lệnh gửi xuống thiết bị phải đi qua trạng thái thực tế: `PENDING` → `SENT` → `ACKNOWLEDGED` → `SUCCESS` / `FAILED` / `TIMEOUT` / `UNSUPPORTED`.
- **Kiểm tra Capability trước khi thực thi:** Mọi thao tác hoặc cấu hình chính sách (như `kioskMode`, `appAllowlist`, `remoteLock`, `urlFiltering`) phải đối chiếu với `getCapabilities()` của provider hiện tại. Nếu provider không hỗ trợ, bắt buộc trả về/hiển thị `UNSUPPORTED` kèm lý do rõ ràng.

## 3. Quy tắc Kiến trúc & Mã nguồn
- **Phân tách tầng:**
  - Frontend (`apps/web`) chỉ gọi `School API` (`apps/api`), tuyệt đối không gọi trực tiếp MDM Provider hay Database.
  - `School API` không truy cập trực tiếp database nội bộ của Headwind MDM; mọi tương tác đi qua interface `MdmAdapter`.
- **RBAC tại Backend:** Mọi API endpoint và Socket.IO room phải kiểm tra vai trò (`ADMIN` / `TEACHER`) và phạm vi lớp học (`Class Scope`) ở tầng Backend.
- **TypeScript Strict:** Bật `strict: true` trên toàn bộ packages và apps; không sử dụng `any` tùy tiện.
- **Quy trình Milestone:** Sau mỗi milestone phải chạy thành công `lint`, `typecheck` và `test` trước khi báo cáo hoàn thành.
