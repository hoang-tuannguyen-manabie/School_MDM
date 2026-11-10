import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Smartphone,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  PlayCircle,
  Sparkles,
  ExternalLink,
  X,
  Wifi,
} from 'lucide-react';
import { ROLES, type MdmProviderType, type RoleName } from '@school-mdm/contracts';

interface OnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: RoleName;
  currentProvider: MdmProviderType;
  onSelectRole: (role: RoleName) => void;
  onSelectProvider: (provider: MdmProviderType) => void;
  onNavigate: (path: string) => void;
}

export function OnboardingGuide({
  isOpen,
  onClose,
  currentRole,
  onSelectRole,
  onNavigate,
}: OnboardingGuideProps): React.ReactElement | null {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([1]);

  if (!isOpen) return null;

  const totalSteps = 5;

  const markStepDone = (step: number) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
  };

  const handleNext = () => {
    markStepDone(currentStep);
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Hướng Dẫn Vận Hành Qua MAC Wi-Fi
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                5 bước kết nối và điều khiển trực tiếp máy tính bảng học tập qua địa chỉ MAC Wi-Fi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
          {[
            { step: 1, label: 'Vai trò & MAC Wi-Fi' },
            { step: 2, label: 'Lớp học' },
            { step: 3, label: 'Kết nối Tablet' },
            { step: 4, label: 'Chính sách & App' },
            { step: 5, label: 'Điều khiển Lớp' },
          ].map((item) => {
            const isDone = completedSteps.includes(item.step);
            const isCurrent = currentStep === item.step;

            return (
              <button
                key={item.step}
                onClick={() => setCurrentStep(item.step)}
                className={`flex items-center gap-1.5 text-xs font-medium transition ${
                  isCurrent
                    ? 'text-indigo-700 font-bold'
                    : isDone
                      ? 'text-emerald-700'
                      : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow'
                      : isDone
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isDone && !isCurrent ? <Check className="w-3.5 h-3.5" /> : item.step}
                </div>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-sm text-slate-700">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    Bước 1: Phân quyền Quản trị &amp; Kiểm soát qua MAC Wi-Fi
                  </h4>
                  <p className="text-xs text-slate-500">
                    Hệ thống kiểm soát trực tiếp máy tính bảng học sinh qua MAC Wi-Fi trên mạng nội bộ mà không cần cài phần mềm bên thứ ba.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => onSelectRole(ROLES.ADMIN)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                    currentRole === ROLES.ADMIN
                      ? 'border-indigo-600 bg-indigo-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">1. Quản trị viên (ADMIN)</span>
                    {currentRole === ROLES.ADMIN && (
                      <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold">
                        Đang chọn
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    Toàn quyền quản trị trường học: Đăng ký thiết bị theo MAC Wi-Fi, đồng bộ danh mục ứng dụng từ tablet, thiết lập chính sách và xem báo cáo.
                  </p>
                </div>

                <div
                  onClick={() => onSelectRole(ROLES.TEACHER)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                    currentRole === ROLES.TEACHER
                      ? 'border-indigo-600 bg-indigo-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">2. Giáo viên (TEACHER)</span>
                    {currentRole === ROLES.TEACHER && (
                      <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold">
                        Đang chọn
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    Dành cho giảng dạy: Xem trực tiếp các máy đang được điều khiển, tự do ghim/bỏ ghim ứng dụng, khóa màn hình và bật đồng hồ đếm ngược.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  <span>Phương thức Kiểm soát độc quyền: Quyền Kiểm soát trực tiếp qua MAC Wi-Fi</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Hệ thống nhận diện máy tính bảng thông qua Địa chỉ MAC Wi-Fi (ví dụ: <code>00:08:22:64:6D:79</code>) và địa chỉ IP LAN (<code>192.168.1.28</code>), thực thi lệnh khóa màn hình, ghim ứng dụng và hiển thị đồng hồ đếm giờ nổi trực tiếp trên máy tính bảng.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    Bước 2: Thiết lập Lớp học &amp; Phân công Giáo viên
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tổ chức danh sách lớp học trước khi gán máy tính bảng vào từng phòng học.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <ol className="space-y-2.5 text-xs text-slate-700 list-decimal list-inside">
                  <li>
                    <strong>Quản lý Lớp học:</strong> Vào mục{' '}
                    <span className="font-semibold text-indigo-600">Lớp học</span> để xem và thêm các lớp (<code>6A1</code>, <code>6A2</code>, <code>7A1</code>, <code>8A1</code>).
                  </li>
                  <li>
                    <strong>Phân công Giáo viên:</strong> Gán giáo viên bộ môn phụ trách từng lớp học.
                  </li>
                  <li>
                    <strong>Gán máy tính bảng vào lớp:</strong> Đưa các máy tính bảng đã kết nối MAC Wi-Fi vào lớp tương ứng.
                  </li>
                </ol>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('/classes');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5"
                  >
                    Đi đến Quản lý Lớp học <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    Bước 3: Kết nối Máy tính bảng qua MAC Wi-Fi &amp; IP
                  </h4>
                  <p className="text-xs text-slate-500">
                    Kiểm tra kết nối trực tiếp qua MAC Wi-Fi trước khi đặt tên định danh và lưu thiết bị.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                <p className="font-bold">✓ Quy trình kết nối không cần thao tác phức tạp trên Tablet:</p>
                <p>
                  1. Nhập Địa chỉ MAC Wi-Fi (<code>00:08:22:64:6D:79</code>) hoặc IP (<code>192.168.1.28</code>) của máy tính bảng.<br />
                  2. Bấm <strong>Kiểm tra kết nối</strong> để xác nhận tín hiệu phản hồi.<br />
                  3. Đặt tên định danh máy (ví dụ: <em>Máy Bàn 01 - Teclast P30</em>) và bấm nút <strong>Edit</strong> bất kỳ lúc nào để đổi tên hoặc cập nhật thông tin.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('/devices');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5"
                >
                  Xem Danh sách Thiết bị <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    Bước 4: Đồng bộ Ứng dụng thực tế từ Tablet &amp; Chính sách
                  </h4>
                  <p className="text-xs text-slate-500">
                    Danh mục 34 ứng dụng lấy trực tiếp từ máy Teclast P30 với đúng biểu tượng gốc.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <ul className="space-y-2 list-disc list-inside text-slate-700">
                  <li>
                    <strong>Tự do Ghim / Bỏ ghim (Kiosk):</strong> Giáo viên và Quản trị viên có thể tự do ghim bất kỳ ứng dụng nào lên màn hình tablet hoặc bỏ ghim chỉ với 1 cú nhấp.
                  </li>
                  <li>
                    <strong>Đồng hồ Đếm ngược Nổi trên Tablet:</strong> Khi giáo viên đặt giờ hoạt động, đồng hồ đếm giờ sẽ hiển thị nổi trực tiếp trên màn hình tablet chạy song song với ứng dụng học tập.
                  </li>
                </ul>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('/applications');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5"
                >
                  Mở Kho Ứng dụng Tablet <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    Bước 5: Điều khiển Tiết học &amp; Theo dõi Hệ thống
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tất cả các phân hệ Chính sách, Phiên học, Người dùng, Báo cáo, Nhật ký và Cấu hình MAC Wi-Fi đều sẵn sàng.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-700">
                <p>
                  Mọi danh sách trong hệ thống đều được chuẩn hóa hiển thị gọn gàng tối đa <strong>10 dòng mỗi trang</strong>, giúp giáo viên và quản trị viên thao tác nhanh chóng.
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('/sessions');
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow"
                  >
                    Bắt đầu Điều khiển Phiên học <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={handleBack}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1 transition ${
              currentStep === 1
                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Quay lại
          </button>

          <span className="text-xs text-slate-500 font-medium">
            Bước {currentStep} trên {totalSteps}
          </span>

          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow transition flex items-center gap-1"
          >
            {currentStep === totalSteps ? 'Hoàn tất & Khám phá' : 'Tiếp theo'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
