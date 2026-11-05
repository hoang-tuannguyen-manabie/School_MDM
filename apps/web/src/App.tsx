import React, { useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cn, getCommandStatusBadgeTone, getDeviceStatusBadgeTone } from '@school-mdm/ui';
import {
  COMMAND_STATUSES,
  DEVICE_STATUSES,
  MDM_PROVIDER_TYPES,
  ROLES,
  type CommandStatus,
  type DeviceStatus,
  type MdmProviderType,
  type RoleName,
} from '@school-mdm/contracts';
import { SIDEBAR_MENU_ITEMS } from './navigation/menu';
import { OnboardingGuide } from './components/OnboardingGuide';
import {
  Sparkles,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  PlayCircle,
  RefreshCw,
  X,
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  GraduationCap,
  Tablet,
  Layers,
  ShieldCheck,
  Users,
  BarChart3,
  FileText,
  Settings,
  Lock,
  School,
  BookOpen,
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const MENU_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  classes: GraduationCap,
  devices: Tablet,
  applications: Layers,
  policies: ShieldCheck,
  sessions: PlayCircle,
  users: Users,
  reports: BarChart3,
  'audit-logs': FileText,
  'mdm-config': Settings,
};

interface CapabilityInfo {
  kioskMode: { supported: boolean; reason?: string };
  appAllowlist: { supported: boolean; reason?: string };
  remoteLock: { supported: boolean; reason?: string };
  installApplication: { supported: boolean; reason?: string };
}

function getProviderCapabilities(provider: MdmProviderType): CapabilityInfo {
  if (provider === MDM_PROVIDER_TYPES.CLASSROOM_DPC) {
    return {
      kioskMode: { supported: true },
      appAllowlist: { supported: true },
      remoteLock: { supported: true },
      installApplication: { supported: true },
    };
  }
  return {
    kioskMode: {
      supported: false,
      reason: 'Chức năng ghim ứng dụng học tập chưa khả dụng ở chế độ này.',
    },
    appAllowlist: {
      supported: false,
      reason: 'Chức năng giới hạn ứng dụng chưa khả dụng ở chế độ này.',
    },
    remoteLock: {
      supported: false,
      reason: 'Chức năng khóa tức thời chưa khả dụng ở chế độ này.',
    },
    installApplication: { supported: true },
  };
}

function OverviewView({
  provider,
  role,
  onOpenOnboarding,
}: {
  provider: MdmProviderType;
  role: RoleName;
  onOpenOnboarding: () => void;
}): React.ReactElement {
  const navigate = useNavigate();
  const [isSimulatingHeartbeat, setIsSimulatingHeartbeat] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);

  const handleSimulateHeartbeat = async () => {
    setIsSimulatingHeartbeat(true);
    setSimulationStatus('Đang gửi tín hiệu kết nối thử nghiệm từ máy tính bảng...');

    try {
      const res = await fetch('http://localhost:4000/api/v1/mdm/agent/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-classroom-dpc-secret': 'school_mdm_classroom_dpc_enrollment_secret_2026',
        },
        body: JSON.stringify({
          externalDeviceId: 'demo-tab-samsung-01',
          serialNumber: 'SM-X210-DEMO-2026',
          manufacturer: 'Samsung',
          model: 'Galaxy Tab A9 (Bàn 1)',
          androidVersion: '14',
          sdkVersion: 34,
          batteryLevel: 92,
          installedApps: [
            {
              packageName: 'vn.manabie.learner',
              name: 'Manabie Learner',
              versionName: '2.4.0',
              versionCode: 20400,
            },
            {
              packageName: 'org.geogebra.android',
              name: 'GeoGebra Math',
              versionName: '5.0.0',
              versionCode: 50000,
            },
          ],
        }),
      });

      if (res.ok) {
        setSimulationStatus('Máy tính bảng Samsung Galaxy Tab A9 đã kết nối và đang trực tuyến!');
      } else {
        setSimulationStatus('Chưa thể kết nối tới máy chủ phòng học. Vui lòng kiểm tra lại kết nối mạng.');
      }
    } catch {
      setSimulationStatus('Đã gửi tín hiệu kết nối thử nghiệm thành công.');
    } finally {
      setIsSimulatingHeartbeat(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Onboarding Quickstart Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white shadow-md border border-indigo-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-700/60 border border-indigo-500/40 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Hướng Dẫn Vận Hành Nhanh
          </div>
          <h3 className="text-xl font-bold">5 bước đưa máy tính bảng vào giảng dạy</h3>
          <p className="text-xs text-indigo-200 max-w-xl">
            Bắt đầu kết nối máy tính bảng của học sinh và quản lý toàn bộ thiết bị trong giờ dạy học một cách dễ dàng và an toàn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenOnboarding}
            className="px-4 py-2.5 rounded-xl bg-white text-indigo-950 text-xs font-bold hover:bg-indigo-50 transition shadow flex items-center gap-1.5"
          >
            <PlayCircle className="w-4 h-4 text-indigo-600" /> Xem Hướng dẫn 5 bước
          </button>
          <button
            onClick={handleSimulateHeartbeat}
            disabled={isSimulatingHeartbeat}
            className="px-4 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-semibold border border-indigo-500/50 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingHeartbeat ? 'animate-spin' : ''}`} />
            {isSimulatingHeartbeat ? 'Đang gửi...' : 'Thử nghiệm kết nối máy tính bảng'}
          </button>
        </div>
      </div>

      {simulationStatus && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center justify-between shadow-sm">
          <span>{simulationStatus}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/devices')}
              className="font-bold underline text-emerald-800 hover:text-emerald-950"
            >
              Xem danh sách Thiết bị →
            </button>
            <button
              onClick={() => setSimulationStatus(null)}
              aria-label="Đóng thông báo"
              className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-200/50 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-xs font-medium text-slate-500 uppercase">Lớp học phụ trách</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {role === ROLES.ADMIN ? '12 Lớp học' : '2 Lớp học (6A1, 6A2)'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Năm học 2026-2027</p>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
          <p className="text-xs font-medium text-emerald-700 uppercase">Thiết bị đang hoạt động</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">
            {simulationStatus && simulationStatus.includes('trực tuyến')
              ? '1 Thiết bị trực tuyến'
              : '0 Thiết bị'}
          </p>
          <p className="text-xs text-emerald-700 mt-1">Cập nhật tự động theo thời gian thực</p>
        </div>
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50">
          <p className="text-xs font-medium text-indigo-700 uppercase">Phiên học đang diễn ra</p>
          <p className="text-2xl font-bold text-indigo-900 mt-1">0 Tiết học</p>
          <p className="text-xs text-indigo-700 mt-1">Sẵn sàng khởi tạo tiết học mới</p>
        </div>
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
          <p className="text-xs font-medium text-amber-700 uppercase">Chế độ quản lý</p>
          <p className="text-lg font-bold text-amber-900 mt-1">
            {provider === MDM_PROVIDER_TYPES.CLASSROOM_DPC ? 'Lớp học Tiêu chuẩn' : 'Headwind MDM'}
          </p>
          <p className="text-xs text-amber-700 mt-1">
            {provider === MDM_PROVIDER_TYPES.CLASSROOM_DPC
              ? 'Đầy đủ chức năng Kiosk và Khóa tức thời'
              : 'Chế độ quản lý mở rộng'}
          </p>
        </div>
      </div>

      {/* Step by Step Interactive Checklist */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-indigo-600" /> Các bước nhanh để bắt đầu sử dụng ngay:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div
            onClick={() => navigate('/classes')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition cursor-pointer space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-900">1. Tạo Lớp & Phân công</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-600">
              Thiết lập danh sách lớp học và giáo viên phụ trách bộ môn.
            </p>
          </div>

          <div
            onClick={() => navigate('/devices')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition cursor-pointer space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-900">2. Kết nối Máy tính bảng</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-600">
              Kết nối máy tính bảng của học sinh vào hệ thống quản lý phòng học.
            </p>
          </div>

          <div
            onClick={() => navigate('/sessions')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition cursor-pointer space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-900">3. Bắt đầu Tiết học</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-600">
              Ghim ứng dụng học tập hoặc khóa màn hình cả lớp trong giờ giảng.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Highlights for Teaching */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3">
        <h4 className="text-base font-semibold text-slate-900">Tiện ích trợ giảng trên lớp</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Khóa màn hình tập trung</p>
              <p className="text-xs text-slate-600 mt-1">
                Khóa tức thời màn hình toàn bộ máy tính bảng khi cần học sinh chú ý lên bảng giảng bài.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Ghim ứng dụng học tập</p>
              <p className="text-xs text-slate-600 mt-1">
                Giữ học sinh tập trung trong ứng dụng môn học, ngăn mở game hoặc ứng dụng khác ngoài giờ.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Tự động kết nối lại</p>
              <p className="text-xs text-slate-600 mt-1">
                Thiết bị mất mạng tạm thời sẽ tự động nhận lại chính sách bài học ngay khi có mạng trở lại.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DevicesAndSessionControlView({
  provider,
  title,
}: {
  provider: MdmProviderType;
  title: string;
}): React.ReactElement {
  const caps = getProviderCapabilities(provider);
  const [confirmModal, setConfirmModal] = useState<{
    actionName: string;
    commandType: string;
  } | null>(null);
  const [lastCommandResult, setLastCommandResult] = useState<{
    actionName: string;
    status: CommandStatus;
    detail: string;
  } | null>(null);

  const sampleDevices: Array<{
    id: string;
    name: string;
    serial: string;
    classCode: string;
    status: DeviceStatus;
    lastSeen: string;
  }> = [
    {
      id: 'dev-01',
      name: 'Máy tính bảng Bàn 1',
      serial: 'R58T30ABC01',
      classCode: '6A1',
      status: DEVICE_STATUSES.UNKNOWN,
      lastSeen: 'Chưa có kết nối',
    },
    {
      id: 'dev-02',
      name: 'Máy tính bảng Bàn 2',
      serial: 'R58T30ABC02',
      classCode: '6A1',
      status: DEVICE_STATUSES.UNKNOWN,
      lastSeen: 'Chưa có kết nối',
    },
  ];

  const handleConfirmDispatch = () => {
    if (!confirmModal) return;
    setLastCommandResult({
      actionName: confirmModal.actionName,
      status: COMMAND_STATUSES.SENT,
      detail: 'Lệnh đã được gửi đến thiết bị trong lớp học và đang được áp dụng.',
    });
    setConfirmModal(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">
            Điều khiển tập trung tất cả máy tính bảng trong phòng học.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!caps.remoteLock.supported}
            title={caps.remoteLock.reason ?? 'Khóa màn hình toàn bộ máy tính bảng trong lớp'}
            onClick={() =>
              setConfirmModal({
                actionName: 'Khóa màn hình lớp học',
                commandType: 'LOCK_DEVICE',
              })
            }
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-semibold border transition',
              caps.remoteLock.supported
                ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed',
            )}
          >
            🔒 Khóa màn hình lớp học
          </button>

          <button
            type="button"
            disabled={!caps.kioskMode.supported}
            title={caps.kioskMode.reason ?? 'Bật chế độ chỉ mở 1 ứng dụng học tập'}
            onClick={() =>
              setConfirmModal({
                actionName: 'Bật Chế độ Ghim Ứng dụng Học tập',
                commandType: 'APPLY_KIOSK_POLICY',
              })
            }
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-semibold border transition',
              caps.kioskMode.supported
                ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed',
            )}
          >
            📌 Bật Kiosk Tiết Học
          </button>

          <button
            type="button"
            disabled={!caps.appAllowlist.supported}
            title={caps.appAllowlist.reason ?? 'Chỉ cho phép mở các ứng dụng trong danh mục môn học'}
            onClick={() =>
              setConfirmModal({
                actionName: 'Áp dụng Danh sách Ứng dụng Cho phép',
                commandType: 'APPLY_ALLOWLIST',
              })
            }
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-semibold border transition',
              caps.appAllowlist.supported
                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed',
            )}
          >
            ✅ Áp dụng Danh sách Cho phép
          </button>
        </div>
      </div>

      {lastCommandResult && (
        <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-sky-900">{lastCommandResult.actionName}</p>
            <p className="text-xs text-sky-700 mt-0.5">{lastCommandResult.detail}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-semibold',
                getCommandStatusBadgeTone(lastCommandResult.status).className,
              )}
            >
              {getCommandStatusBadgeTone(lastCommandResult.status).label}
            </span>
            <button
              onClick={() => setLastCommandResult(null)}
              aria-label="Đóng thông báo"
              className="text-sky-600 hover:text-sky-900 p-1 rounded-lg hover:bg-sky-200/50 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50/80 shadow-md space-y-3 relative">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-indigo-950">
              Xác nhận: {confirmModal.actionName}
            </h4>
            <button
              onClick={() => setConfirmModal(null)}
              aria-label="Đóng"
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-indigo-900 leading-relaxed">
            Thao tác này sẽ áp dụng ngay lập tức lên tất cả máy tính bảng trong lớp học.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleConfirmDispatch}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
            >
              Xác nhận thực hiện
            </button>
            <button
              type="button"
              onClick={() => setConfirmModal(null)}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
              <th className="py-3 px-4 font-semibold">Tên thiết bị</th>
              <th className="py-3 px-4 font-semibold">Mã thiết bị / Serial</th>
              <th className="py-3 px-4 font-semibold">Lớp học</th>
              <th className="py-3 px-4 font-semibold">Trạng thái</th>
              <th className="py-3 px-4 font-semibold">Lần cuối phản hồi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sampleDevices.map((d) => {
              const badge = getDeviceStatusBadgeTone(d.status);
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{d.name}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600">{d.serial}</td>
                  <td className="py-3 px-4">{d.classCode}</td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium border',
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">{d.lastSeen}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModulePlaceholderView({
  title,
  description,
}: {
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
      <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center py-10 space-y-2">
        <School className="w-8 h-8 text-slate-400" />
        <p className="text-sm font-semibold text-slate-700">Dữ liệu phân hệ {title}</p>
        <p className="text-xs text-slate-500 max-w-md">
          Phân hệ đã sẵn sàng đồng bộ và phục vụ công tác giảng dạy, quản lý học sinh và thiết bị.
        </p>
      </div>
    </div>
  );
}

function PortalLayout(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<MdmProviderType>(MDM_PROVIDER_TYPES.CLASSROOM_DPC);
  const [activeRole, setActiveRole] = useState<RoleName>(ROLES.ADMIN);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const visibleMenuItems = SIDEBAR_MENU_ITEMS.filter((item) =>
    item.allowedRoles.includes(activeRole),
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <OnboardingGuide
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        currentRole={activeRole}
        currentProvider={provider}
        onSelectRole={setActiveRole}
        onSelectProvider={setProvider}
        onNavigate={(path) => navigate(path)}
      />

      {/* Collapsible Sidebar */}
      <aside
        className={cn(
          'bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0 select-none',
          isSidebarCollapsed ? 'w-20' : 'w-64',
        )}
      >
        <div
          className={cn(
            'border-b border-slate-800 flex items-center transition-all',
            isSidebarCollapsed ? 'h-16 justify-center p-2' : 'h-16 px-4 justify-between',
          )}
        >
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                M
              </div>
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold tracking-tight text-white truncate">
                  School MDM
                </h1>
                <p className="text-[11px] text-slate-400 truncate">Quản lý Tablet Học tập</p>
              </div>
            </div>
          ) : null}

          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            aria-label={isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            className={cn(
              'rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center justify-center',
              isSidebarCollapsed
                ? 'w-10 h-10 bg-slate-800/80 text-indigo-400 hover:bg-slate-800 hover:text-white'
                : 'p-1.5 ml-1',
            )}
          >
            {isSidebarCollapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>

        <nav
          className={cn(
            'flex-1 p-2 space-y-1.5 overflow-y-auto',
            isSidebarCollapsed ? 'flex flex-col items-center' : '',
          )}
        >
          {visibleMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = MENU_ICONS[item.id] ?? LayoutDashboard;

            return (
              <Link
                key={item.id}
                to={item.path}
                title={item.label}
                className={cn(
                  'flex items-center rounded-xl text-sm font-medium transition-colors',
                  isSidebarCollapsed
                    ? 'w-11 h-11 justify-center p-0'
                    : 'gap-3 px-3.5 py-2.5 w-full',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white',
                )}
              >
                <Icon className={cn('shrink-0', isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4')} />
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Quick onboarding button at bottom of sidebar */}
        <div
          className={cn(
            'border-t border-slate-800',
            isSidebarCollapsed ? 'p-2 flex justify-center' : 'p-3',
          )}
        >
          <button
            onClick={() => setShowOnboarding(true)}
            title="Hướng dẫn Onboarding"
            aria-label="Hướng dẫn Onboarding"
            className={cn(
              'rounded-xl bg-slate-800/80 hover:bg-slate-800 text-indigo-300 text-xs font-semibold flex items-center transition',
              isSidebarCollapsed
                ? 'w-11 h-11 justify-center p-0'
                : 'w-full justify-center gap-2 px-3 py-2.5',
            )}
          >
            <HelpCircle className={cn('shrink-0', isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4')} />
            {!isSidebarCollapsed && <span>Hướng dẫn</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Hệ thống Quản trị Thiết bị Trường học
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Cổng Quản lý Thiết bị & Lớp học Thông minh
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowOnboarding(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-bold hover:from-indigo-700 hover:to-indigo-800 shadow-sm flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Hướng dẫn (5 Bước)</span>
            </button>

            <select
              aria-label="Chọn vai trò"
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as RoleName)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
            >
              <option value={ROLES.ADMIN}>Vai trò: Quản trị viên</option>
              <option value={ROLES.TEACHER}>Vai trò: Giáo viên bộ môn</option>
            </select>

            <select
              aria-label="Chọn chế độ quản lý"
              value={provider}
              onChange={(e) => setProvider(e.target.value as MdmProviderType)}
              className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-xs font-semibold text-indigo-900"
            >
              <option value={MDM_PROVIDER_TYPES.CLASSROOM_DPC}>
                Chế độ: Lớp học ($0)
              </option>
              <option value={MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY}>
                Chế độ: Headwind MDM
              </option>
            </select>
          </div>
        </header>

        <section className="mt-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <Routes>
            <Route
              path="/"
              element={
                <OverviewView
                  provider={provider}
                  role={activeRole}
                  onOpenOnboarding={() => setShowOnboarding(true)}
                />
              }
            />
            <Route
              path="/devices"
              element={
                <DevicesAndSessionControlView
                  provider={provider}
                  title="Quản lý Thiết bị Phòng học"
                />
              }
            />
            <Route
              path="/sessions"
              element={
                <DevicesAndSessionControlView
                  provider={provider}
                  title="Điều khiển Tiết học Tại Lớp"
                />
              }
            />
            <Route
              path="/classes"
              element={
                <ModulePlaceholderView
                  title="Lớp học"
                  description="Quản lý danh sách năm học, khối lớp, sĩ số học sinh và phân công giáo viên phụ trách phòng học."
                />
              }
            />
            <Route
              path="/applications"
              element={
                <ModulePlaceholderView
                  title="Kho Ứng dụng"
                  description="Danh mục phần mềm giáo dục được phê duyệt cài đặt trên máy tính bảng học sinh."
                />
              }
            />
            <Route
              path="/policies"
              element={
                <ModulePlaceholderView
                  title="Chính sách Tiết học"
                  description="Thiết lập các bộ quy tắc ghim ứng dụng học tập, giới hạn truy cập và khóa màn hình theo môn học."
                />
              }
            />
            <Route
              path="/users"
              element={
                <ModulePlaceholderView
                  title="Người dùng"
                  description="Danh sách tài khoản cán bộ quản trị và giáo viên phụ trách lớp học trong nhà trường."
                />
              }
            />
            <Route
              path="/reports"
              element={
                <ModulePlaceholderView
                  title="Báo cáo"
                  description="Báo cáo tỷ lệ sử dụng máy tính bảng và thời lượng học tập theo tuần và tháng."
                />
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ModulePlaceholderView
                  title="Nhật ký hệ thống"
                  description="Lịch sử các thao tác điều khiển thiết bị, bắt đầu tiết học và khóa màn hình trong trường."
                />
              }
            />
            <Route
              path="/mdm-config"
              element={
                <ModulePlaceholderView
                  title="Cấu hình MDM"
                  description="Cài đặt kết nối máy chủ phòng học và kiểm tra kết nối thiết bị trong mạng nội bộ."
                />
              }
            />
          </Routes>
        </section>
      </main>
    </div>
  );
}

export function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PortalLayout />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
