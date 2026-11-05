import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  PlayCircle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { MDM_PROVIDER_TYPES, ROLES, type MdmProviderType, type RoleName } from '@school-mdm/contracts';

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
  currentProvider,
  onSelectRole,
  onSelectProvider,
  onNavigate,
}: OnboardingGuideProps): React.ReactElement | null {
  const [currentStep, setCurrentStep] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([1]);

  if (!isOpen) return null;

  const totalSteps = 5;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

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
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white flex items-center justify-between border-b border-indigo-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-700/60 rounded-xl border border-indigo-600/40">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Hướng Dẫn Khởi Động Nhanh (Onboarding)</h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                Vận hành Quản lý Tablet Giảng dạy Tại Lớp trong 5 bước đơn giản
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/10 transition"
          >
            Đóng
          </button>
        </div>

        {/* Stepper Progress */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
          {[
            { step: 1, label: 'Vai trò & Chế độ' },
            { step: 2, label: 'Lớp học' },
            { step: 3, label: 'Kết nối Tablet' },
            { step: 4, label: 'Chính sách Tiết học' },
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
                    Bước 1: Chọn Vai trò Quản trị & Chế độ MDM
                  </h4>
                  <p className="text-xs text-slate-500">
                    Hệ thống phân tách chặt chẽ quyền hạn và hỗ trợ 2 chế độ kết nối thiết bị.
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
                    Toàn quyền quản trị trường học: Tạo năm học, lớp học, phân công giáo viên, phê
                    duyệt ứng dụng, xuất bản chính sách và xem toàn bộ nhật ký hệ thống.
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
                    Dành cho giảng dạy: Chỉ xem và điều khiển các tablet thuộc lớp được phân công
                    (RBAC), tạo phiên học, khóa màn hình và bật Kiosk trong tiết học.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  Lựa chọn MDM Provider:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    onClick={() => onSelectProvider(MDM_PROVIDER_TYPES.CLASSROOM_DPC)}
                    className={`p-3 rounded-lg border cursor-pointer text-xs ${
                      currentProvider === MDM_PROVIDER_TYPES.CLASSROOM_DPC
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <p className="font-bold text-sm text-emerald-800">
                      CLASSROOM_DPC (Khuyến nghị • $0)
                    </p>
                    <p className="text-slate-600 mt-1">
                      Miễn phí 100% bản quyền. Hỗ trợ toàn diện Khóa màn hình tức thời (lockNow),
                      Kiosk Mode và Chặn ứng dụng thời gian thực.
                    </p>
                  </div>

                  <div
                    onClick={() => onSelectProvider(MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY)}
                    className={`p-3 rounded-lg border cursor-pointer text-xs ${
                      currentProvider === MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY
                        ? 'border-amber-600 bg-amber-50 text-amber-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <p className="font-bold text-sm text-amber-800">HEADWIND_COMMUNITY</p>
                    <p className="text-slate-600 mt-1">
                      Bản Community mã nguồn mở. Hệ thống sẽ trung thực đánh dấu UNSUPPORTED với các
                      lệnh Kiosk/Remote Lock nâng cao.
                    </p>
                  </div>
                </div>
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
                    Bước 2: Thiết lập Năm học, Lớp học & Phân công Giáo viên
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tổ chức dữ liệu sư phạm trước khi gán thiết bị vào các lớp.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                  Quy trình 3 bước chuẩn:
                </h5>
                <ol className="space-y-2.5 text-xs text-slate-700 list-decimal list-inside">
                  <li>
                    <strong>Tạo Năm học hiện hành:</strong> Vào mục{' '}
                    <span className="font-semibold text-indigo-600">Lớp học</span> để thiết lập mã
                    năm học (ví dụ: <code>2026-2027</code>) với ngày bắt đầu và kết thúc.
                  </li>
                  <li>
                    <strong>Tạo Lớp học theo khối:</strong> Thêm các lớp (ví dụ: <code>6A1</code>,{' '}
                    <code>6A2</code>, <code>7A1</code>) cùng phòng học tương ứng.
                  </li>
                  <li>
                    <strong>Phân công Giáo viên phụ trách (Homeroom / Subject):</strong> Gán giáo viên
                    vào lớp. Khi giáo viên đăng nhập, hệ thống tự động giới hạn phạm vi quan sát chỉ
                    trong các lớp được phân công.
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
                    Bước 3: Kết nối Máy tính bảng Android Thật (Enrollment)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Kích hoạt quyền Device Owner qua 1 lệnh ADB đơn giản trên 1–5 tablet thử nghiệm.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-900 text-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400">
                      Lệnh ADB Cấp quyền Device Owner ($0 Không tốn phí bản quyền):
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          'adb shell dpm set-device-owner vn.school.mdm.dpc/.ClassroomDeviceAdminReceiver',
                          'adb-cmd',
                        )
                      }
                      className="flex items-center gap-1 text-xs text-indigo-300 hover:text-white transition"
                    >
                      {copiedCode === 'adb-cmd' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedCode === 'adb-cmd' ? 'Đã sao chép' : 'Sao chép lệnh'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs bg-slate-950 p-2.5 rounded-lg text-emerald-400 overflow-x-auto select-all">
                    adb shell dpm set-device-owner vn.school.mdm.dpc/.ClassroomDeviceAdminReceiver
                  </pre>
                  <p className="text-[11px] text-slate-400">
                    * Yêu cầu: Bật USB Debugging trên tablet và tạm thời chưa đăng nhập tài khoản
                    Google cá nhân tại thời điểm chạy lệnh.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <p className="font-bold">✓ Cơ chế Heartbeat LAN thời gian thực:</p>
                  <p>
                    Agent trên tablet tự động gửi thông tin pin, phiên bản Android và danh sách ứng
                    dụng về <code>/api/v1/mdm/agent/heartbeat</code> mỗi 15 giây. Sau 45 giây không
                    nhận được phản hồi, Portal sẽ tự động chuyển sang trạng thái <strong>OFFLINE</strong>{' '}
                    (tuyệt đối không giả lập online).
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
                    Bước 4: Thiết lập Kho Ứng dụng & Chính sách Tiết học
                  </h4>
                  <p className="text-xs text-slate-500">
                    Bảo đảm học sinh chỉ tập trung vào ứng dụng học tập, không bị xao nhãng.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h5 className="font-bold text-slate-900">2 Loại Chính sách trọng tâm:</h5>
                  <ul className="space-y-2 list-disc list-inside text-slate-700">
                    <li>
                      <strong>Chế độ Kiosk (Lock Task Mode):</strong> Ghim duy nhất 1 ứng dụng học
                      tập lên màn hình (ví dụ: ứng dụng Manabie Learner hoặc GeoGebra). Nút Home và
                      phím điều hướng bị vô hiệu hóa hoàn toàn.
                    </li>
                    <li>
                      <strong>Chế độ Cho phép danh sách (App Allowlist):</strong> Chỉ cho phép học
                      sinh mở các ứng dụng trong danh mục môn học. Các ứng dụng như YouTube, game,
                      mạng xã hội tự động bị ẩn hoặc tạm khóa.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <p className="font-bold">⚠️ Kiểm tra tính tương thích trước khi Xuất bản:</p>
                  <p>
                    Hệ thống sẽ đối chiếu các quy tắc trong chính sách với năng lực thực tế của MDM
                    Provider. Phiên bản chính sách sau khi đã phát hành (PUBLISHED) là bất biến
                    (immutable) để đảm bảo an toàn tuyệt đối cho phiên học.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('/policies');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5"
                  >
                    Tạo Chính sách Tiết học <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                    Bước 5: Vận hành Tiết học & Điều khiển Tablet Lớp học
                  </h4>
                  <p className="text-xs text-slate-500">
                    Giáo viên trực tiếp quản lý tất cả thiết bị trong giờ học chỉ với 1 cú nhấp.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-700">
                <h5 className="font-bold text-slate-900 text-sm">Các thao tác trên lớp học:</h5>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-indigo-700">• Bắt đầu Tiết học:</span>
                    <span>
                      Tự động gửi chính sách xuống tất cả tablet trong lớp. Máy trực tuyến sẽ áp dụng
                      trong ≤ 2 giây.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-indigo-700">• Xử lý máy mất mạng:</span>
                    <span>
                      Máy ngoại tuyến được đánh dấu <code>WAITING_DEVICE_ONLINE</code>. Ngay khi học
                      sinh bật Wi-Fi trở lại, hệ thống lập tức tự động đồng bộ chính sách (Reconnect
                      Reconciliation).
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-rose-700">• Khóa màn hình tức thời:</span>
                    <span>
                      Nút "Khóa màn hình lớp học" lập tức tắt/khóa màn hình toàn bộ tablet khi giáo
                      viên cần học sinh chú ý lên bảng.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-emerald-700">• Kết thúc an toàn:</span>
                    <span>
                      Khi hết giờ, chỉ máy thực sự xác nhận giải phóng mới chuyển sang <code>RELEASED</code>.
                      Máy mất mạng được giữ lại mở khóa tự động khi trực tuyến.
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('/sessions');
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow"
                  >
                    Bắt đầu Phiên học Ngay <ExternalLink className="w-3.5 h-3.5" />
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
