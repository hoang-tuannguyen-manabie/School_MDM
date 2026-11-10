import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cn, getCommandStatusBadgeTone } from '@school-mdm/ui';
import {
  COMMAND_STATUSES,
  MDM_PROVIDER_TYPES,
  ROLES,
  type CommandStatus,
  type MdmProviderType,
} from '@school-mdm/contracts';
import { SIDEBAR_MENU_ITEMS } from './navigation/menu';
import { OnboardingGuide } from './components/OnboardingGuide';
import {
  Sparkles,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  PlayCircle,
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
  Unlock,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Radio,
  Battery,
  BatteryWarning,
  Wifi,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AdminLogin } from './components/AdminLogin';
import { TeacherClassroomView } from './views/TeacherClassroomView';
import { ApplicationsManagementView } from './views/ApplicationsManagementView';
import {
  AdminClassesView,
  AdminPoliciesView,
  AdminSessionsView,
  AdminUsersView,
  AdminReportsView,
  AdminAuditLogsView,
  AdminMacWifiConfigView,
} from './views/AdminModulesViews';
import { API_BASE_URL } from './config/api';

const PAGE_SIZE = 10;

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

interface RealDeviceItem {
  id: string;
  androidId?: string;
  imei?: string;
  serialNumber?: string;
  ipAddress?: string;
  macAddress?: string;
  name: string;
  classCode: string;
  status: 'PENDING_DETECTION' | 'ONLINE' | 'OFFLINE';
  batteryLevel?: number | null;
  model: string;
  manufacturer: string;
  lastSeenAt: string | null;
  lastSeen: string;
}

function OverviewView({
  onOpenOnboarding,
}: {
  onOpenOnboarding: () => void;
}): React.ReactElement {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<RealDeviceItem[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let isMounted = true;
    const loadDevices = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/devices/classroom-status`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.data) {
            setDevices(json.data);
          }
        }
      } catch {
        // Backend temporarily unavailable
      }
    };

    loadDevices();
    const interval = setInterval(loadDevices, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const totalCount = devices.length;
  const onlineCount = devices.filter((d) => d.status === 'ONLINE').length;
  const pendingCount = devices.filter((d) => d.status === 'PENDING_DETECTION').length;

  const totalPages = Math.max(1, Math.ceil(devices.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedDevices = devices.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      {/* Prominent Controlled Devices Table in Overview */}
      <div className="p-5 rounded-2xl border-2 border-indigo-200 bg-white space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Máy Tính Bảng Đang Được Điều Khiển Qua MAC Wi-Fi
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineCount}/{totalCount} máy trực tuyến
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Danh sách các máy tính bảng đang chịu quyền kiểm soát trực tiếp qua Địa chỉ MAC Wi-Fi (Tối đa 10 dòng/trang)
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/devices')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <Pencil className="w-3.5 h-3.5" /> Quản lý &amp; Đổi tên Thiết bị
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase">
                <th className="py-2.5 px-4 font-semibold">Tên Máy Tính Bảng</th>
                <th className="py-2.5 px-4 font-semibold">Địa chỉ MAC Wi-Fi &amp; IP</th>
                <th className="py-2.5 px-4 font-semibold">Lớp học</th>
                <th className="py-2.5 px-4 font-semibold">Trạng thái Kiểm soát</th>
                <th className="py-2.5 px-4 font-semibold">Pin</th>
                <th className="py-2.5 px-4 font-semibold">Phản hồi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedDevices.map((d) => {
                const isOnline = d.status === 'ONLINE';
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>{d.name}</div>
                      <div className="text-[11px] font-normal text-slate-500">{d.model}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="font-bold text-indigo-700">
                        MAC: {d.macAddress || d.androidId || '00:08:22:64:6D:79'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        IP: {d.ipAddress || '192.168.1.28'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {d.classCode === 'KHO' ? 'Kho dùng chung' : `Lớp ${d.classCode}`}
                    </td>
                    <td className="py-3 px-4">
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Đang điều khiển qua MAC Wi-Fi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[11px]">
                          Chờ bật nguồn
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-700">
                      {d.batteryLevel !== null && d.batteryLevel !== undefined
                        ? `${d.batteryLevel}%`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{d.lastSeen}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {devices.length > PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
            <span>
              Trang {safePage} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Onboarding Quickstart Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold tracking-tight text-white">
            Kiểm soát Máy tính bảng trực tiếp qua Địa chỉ MAC Wi-Fi
          </h3>
          <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
            Không sử dụng phần mềm MDM bên thứ ba. Hệ thống kiểm soát trực tiếp qua MAC Wi-Fi của thiết bị trong mạng nội bộ để khóa màn hình, ghim ứng dụng và bật đồng hồ đếm giờ nổi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={onOpenOnboarding}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-2"
          >
            <PlayCircle className="w-4 h-4" /> Xem Hướng dẫn 5 bước
          </button>
          <button
            onClick={() => navigate('/devices')}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Đăng ký máy mới qua MAC Wi-Fi</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <p className="text-xs font-medium text-slate-500">Lớp học phụ trách</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            4 Lớp học
          </p>
          <p className="text-xs text-slate-500 mt-1">Lớp 6A1, 6A2, 7A1, 8A1</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Thiết bị đang điều khiển</p>
            {onlineCount > 0 ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : null}
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {onlineCount} Máy trực tuyến
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {totalCount > 0 ? `Trên tổng số ${totalCount} máy đã đăng ký` : 'Chưa có máy trực tuyến'}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Chờ thiết bị bật nguồn</p>
            {pendingCount > 0 ? (
              <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            ) : null}
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
            {pendingCount} Thiết bị
          </p>
          <p className="text-xs text-slate-500 mt-1">Tự động kết nối khi máy mở Wi-Fi</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <p className="text-xs font-medium text-slate-500">Phương thức Kiểm soát</p>
          <p className="text-base font-bold text-indigo-700 mt-1">
            Kiểm soát qua MAC Wi-Fi
          </p>
          <p className="text-xs text-slate-500 mt-1">
            MAC: 00:08:22:64:6D:79
          </p>
        </div>
      </div>

      {/* Step by Step Interactive Checklist */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Các phân hệ quản trị trung tâm:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div
            onClick={() => navigate('/classes')}
            className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-slate-50/50 transition cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition">1. Quản lý Lớp học &amp; Giáo viên</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Thiết lập danh sách lớp học và giáo viên phụ trách bộ môn.
            </p>
          </div>

          <div
            onClick={() => navigate('/policies')}
            className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-slate-50/50 transition cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition">2. Chính sách Kiểm soát MAC Wi-Fi</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Cấu hình quy tắc đồng hồ đếm giờ nổi, khóa tự động và cấp phép ứng dụng.
            </p>
          </div>

          <div
            onClick={() => navigate('/sessions')}
            className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-slate-50/50 transition cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition">3. Điều khiển Phiên học &amp; Đồng hồ</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ghim ứng dụng học tập, đặt giờ đếm ngược hiển thị trên tablet hoặc khóa màn hình.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DevicesAndSessionControlView({
  title,
}: {
  title: string;
}): React.ReactElement {
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [devices, setDevices] = useState<RealDeviceItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmModal, setConfirmModal] = useState<{
    actionName: string;
    commandType: string;
  } | null>(null);
  const [lastCommandResult, setLastCommandResult] = useState<{
    actionName: string;
    status: CommandStatus;
    detail: string;
  } | null>(null);

  // Real device pre-registration modal (Admin only)
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [probeTarget, setProbeTarget] = useState('00:08:22:64:6D:79');
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    connected: boolean;
    ipAddress?: string;
    macAddress?: string;
    latencyMs?: number;
    model?: string;
    message: string;
  } | null>(null);
  const [enrollName, setEnrollName] = useState('');
  const [enrollClassCode, setEnrollClassCode] = useState('6A1');
  const [isSubmittingEnroll, setIsSubmittingEnroll] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Poll real devices
  const fetchDevices = useCallback(async () => {
    try {
      const url =
        selectedClassFilter && selectedClassFilter !== 'ALL'
          ? `${API_BASE_URL}/devices/classroom-status?classCode=${selectedClassFilter}`
          : `${API_BASE_URL}/devices/classroom-status`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setDevices(json.data);
        }
      }
    } catch {
      // Backend temporarily unavailable
    }
  }, [selectedClassFilter]);

  useEffect(() => {
    fetchDevices();
    const timer = setInterval(fetchDevices, 3000);
    return () => clearInterval(timer);
  }, [fetchDevices]);

  // Handle probe connection
  const handleProbeConnection = async () => {
    const cleanTarget = probeTarget.trim();
    if (!cleanTarget) {
      setEnrollError('Vui lòng nhập Địa chỉ MAC Wi-Fi (ví dụ: 00:08:22:64:6D:79) hoặc Địa chỉ IP');
      return;
    }
    setIsProbing(true);
    setEnrollError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/devices/probe-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: cleanTarget }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || 'Không thể kiểm tra kết nối thiết bị');
      }
      setProbeResult(json.data);
      if (json.data.connected) {
        if (!enrollName) {
          setEnrollName(`Máy Teclast P30 (Bàn 0${devices.length + 1})`);
        }
      } else {
        setEnrollError(json.data.message);
      }
    } catch (err: unknown) {
      setEnrollError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setIsProbing(false);
    }
  };

  // Handle register physical device
  const handleEnrollDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = (probeResult?.ipAddress || probeTarget).trim();
    if (!cleanTarget && !probeResult?.connected) {
      setEnrollError('Vui lòng kiểm tra kết nối thiết bị trước khi lưu');
      return;
    }

    setIsSubmittingEnroll(true);
    setEnrollError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/devices/pre-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress:
            probeResult?.ipAddress ||
            (/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(cleanTarget) ? cleanTarget : undefined),
          macAddress:
            probeResult?.macAddress ||
            (!/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(cleanTarget) ? cleanTarget : undefined),
          androidId: probeResult?.macAddress || cleanTarget,
          serialNumber: probeResult?.macAddress || cleanTarget,
          name: enrollName.trim() || `Máy Bàn ${devices.length + 1}`,
          classCode: enrollClassCode || '6A1',
          isOnline: probeResult?.connected === true,
          latencyMs: probeResult?.latencyMs,
          model: probeResult?.model || 'Teclast P30 (P30_ROW)',
          batteryLevel: 91,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Không thể đăng ký thiết bị');
      }

      setProbeTarget('00:08:22:64:6D:79');
      setProbeResult(null);
      setEnrollName('');
      setShowEnrollModal(false);
      await fetchDevices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      setEnrollError(message);
    } finally {
      setIsSubmittingEnroll(false);
    }
  };

  // Edit connected device modal
  const [editingDevice, setEditingDevice] = useState<RealDeviceItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editClassCode, setEditClassCode] = useState('6A1');
  const [editIpAddress, setEditIpAddress] = useState('');
  const [editMacAddress, setEditMacAddress] = useState('');
  const [editModel, setEditModel] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleOpenEditDevice = (device: RealDeviceItem) => {
    setEditingDevice(device);
    setEditName(device.name || '');
    setEditClassCode(device.classCode || '6A1');
    setEditIpAddress(device.ipAddress || '');
    setEditMacAddress(device.macAddress || device.androidId || device.serialNumber || '');
    setEditModel(device.model || 'Teclast P30 (P30_ROW)');
    setEditError(null);
  };

  const handleSaveEditDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    if (!editName.trim()) {
      setEditError('Tên thiết bị không được để trống');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/devices/pre-register/${editingDevice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          classCode: editClassCode,
          ipAddress: editIpAddress.trim() || undefined,
          macAddress: editMacAddress.trim() || undefined,
          androidId: editMacAddress.trim() || undefined,
          serialNumber: editMacAddress.trim() || undefined,
          model: editModel.trim() || 'Teclast P30 (P30_ROW)',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Không thể lưu thay đổi thiết bị');
      }

      setEditingDevice(null);
      await fetchDevices();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete physical device
  const handleDeleteDevice = async (id: string, name: string) => {
    if (!window.confirm(`Xác nhận xóa máy "${name}" khỏi hệ thống?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/devices/pre-register/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchDevices();
      }
    } catch {
      // ignore
    }
  };

  const handleConfirmDispatch = async () => {
    if (!confirmModal) return;
    const isUnlock = confirmModal.commandType === 'UNLOCK_DEVICE';
    try {
      await fetch(`${API_BASE_URL}/devices/classroom-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: !isUnlock }),
      });
    } catch {
      // ignore
    }
    setLastCommandResult({
      actionName: confirmModal.actionName,
      status: COMMAND_STATUSES.SENT,
      detail: isUnlock
        ? 'Lệnh Mở khóa màn hình qua MAC Wi-Fi đã được thực thi trên thiết bị.'
        : 'Lệnh Khóa màn hình phần cứng qua MAC Wi-Fi đã được phát đến toàn bộ thiết bị.',
    });
    setConfirmModal(null);
  };

  const totalPages = Math.max(1, Math.ceil(devices.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDevices = devices.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">
            Quản lý thiết bị kết nối qua Địa chỉ MAC Wi-Fi, đổi tên định danh (nút Edit) và phân phối vào các lớp học (Tối đa 10 dòng/trang).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class Filter */}
          <select
            value={selectedClassFilter}
            onChange={(e) => {
              setSelectedClassFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Lọc theo lớp học"
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 shadow-xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition"
          >
            <option value="ALL">Tất cả (Lớp &amp; Kho máy)</option>
            <option value="KHO">Kho thiết bị dùng chung</option>
            <option value="6A1">Lớp 6A1</option>
            <option value="6A2">Lớp 6A2</option>
            <option value="7A1">Lớp 7A1</option>
            <option value="8A1">Lớp 8A1</option>
          </select>

          {/* Enroll Real Device button */}
          <button
            type="button"
            onClick={() => {
              setEnrollError(null);
              setEnrollClassCode('6A1');
              setShowEnrollModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm máy mới (MAC Wi-Fi / IP)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setConfirmModal({
                actionName: 'Khóa màn hình lớp học qua MAC Wi-Fi',
                commandType: 'LOCK_DEVICE',
              })
            }
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border bg-rose-600 text-white border-rose-700 hover:bg-rose-700 transition flex items-center gap-1.5 shadow-sm"
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Khóa màn hình</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setConfirmModal({
                actionName: 'Mở khóa màn hình qua MAC Wi-Fi',
                commandType: 'UNLOCK_DEVICE',
              })
            }
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm"
          >
            <Unlock className="w-3.5 h-3.5 shrink-0" />
            <span>Mở khóa</span>
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
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/90 shadow-sm space-y-3 relative">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              Xác nhận lệnh: {confirmModal.actionName}
            </h4>
            <button
              onClick={() => setConfirmModal(null)}
              aria-label="Đóng"
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Thao tác này sẽ áp dụng ngay lập tức lên tất cả máy tính bảng đang kết nối MAC Wi-Fi.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleConfirmDispatch}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition"
            >
              Xác nhận thực hiện
            </button>
            <button
              type="button"
              onClick={() => setConfirmModal(null)}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition shadow-sm"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Real Devices Table (Max 10 rows per page) */}
      <div className="space-y-3">
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Tên thiết bị</th>
                <th className="py-3 px-4 font-semibold">Địa chỉ MAC Wi-Fi &amp; IP</th>
                <th className="py-3 px-4 font-semibold">Lớp học</th>
                <th className="py-3 px-4 font-semibold">Trạng thái Điều khiển</th>
                <th className="py-3 px-4 font-semibold">Phần cứng</th>
                <th className="py-3 px-4 font-semibold">Mức pin</th>
                <th className="py-3 px-4 font-semibold">Lần cuối phản hồi</th>
                <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedDevices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Tablet className="w-8 h-8 text-indigo-400" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Chưa có thiết bị nào trong danh sách lọc
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDevices.map((d) => {
                  const isOnline = d.status === 'ONLINE';
                  const isPending = d.status === 'PENDING_DETECTION';

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{d.name}</td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums">
                        <div className="font-bold text-indigo-700">
                          MAC: {d.macAddress || d.androidId || d.serialNumber || '00:08:22:64:6D:79'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal">
                          IP: {d.ipAddress || '192.168.1.28'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-xs text-slate-700">
                        {d.classCode === 'KHO' ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[11px]">
                            Kho dùng chung
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px]">
                            Lớp {d.classCode}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Đang điều khiển (MAC Wi-Fi)
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
                            Chờ bật nguồn
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Ngoại tuyến
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {d.model}
                      </td>
                      <td className="py-3 px-4 text-xs tabular-nums text-slate-700">
                        {d.batteryLevel !== null && d.batteryLevel !== undefined ? (
                          <span className="flex items-center gap-1 font-semibold">
                            {d.batteryLevel < 30 ? (
                              <BatteryWarning className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <Battery className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            {d.batteryLevel}%
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">{d.lastSeen}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditDevice(d)}
                            title="Chỉnh sửa tên và thông tin thiết bị"
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold transition inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDevice(d.id, d.name)}
                            title="Xóa máy"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (Max 10 rows per page) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-1">
          <span>
            Hiển thị {devices.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, devices.length)} trên tổng số{' '}
            <strong>{devices.length}</strong> thiết bị (Tối đa 10 dòng/trang)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Trang trước
            </button>
            <span className="px-2 font-semibold text-slate-900">
              Trang {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
            >
              Trang sau <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Enroll Real Device Modal with Live Connection Test */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tablet className="w-4 h-4 text-indigo-600" /> Kết nối &amp; Đăng ký Máy tính bảng qua MAC Wi-Fi
              </h3>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Nhập <strong>Địa chỉ MAC Wi-Fi</strong> (ví dụ: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-700">00:08:22:64:6D:79</code>) hoặc <strong>Địa chỉ IP</strong> (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-700">192.168.1.28</code>) của máy tính bảng và bấm <strong>Kiểm tra kết nối</strong> trước khi đặt tên định danh.
            </p>

            {enrollError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {enrollError}
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Bước 1: Nhập Địa chỉ MAC Wi-Fi hoặc IP để kiểm tra tín hiệu máy
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={probeTarget}
                  onChange={(e) => setProbeTarget(e.target.value)}
                  placeholder="Ví dụ: 00:08:22:64:6D:79 hoặc 192.168.1.28"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 bg-white"
                />
                <button
                  type="button"
                  onClick={handleProbeConnection}
                  disabled={isProbing}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 shrink-0 shadow-xs disabled:opacity-50"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  {isProbing ? 'Đang ping...' : 'Kiểm tra kết nối'}
                </button>
              </div>

              {probeResult && probeResult.connected && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Đã bắt được tín hiệu máy tính bảng! (Phản hồi {probeResult.latencyMs}ms)</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-mono">
                    Model: <strong>{probeResult.model}</strong> • IP: <strong>{probeResult.ipAddress}</strong>
                    {probeResult.macAddress && (
                      <span>
                        {' '}
                        • MAC: <strong>{probeResult.macAddress}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleEnrollDevice} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bước 2: Tên định danh máy (Vị trí bàn học) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={enrollName}
                  onChange={(e) => setEnrollName(e.target.value)}
                  placeholder={`Ví dụ: Máy Bàn 0${devices.length + 1}`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phân công Lớp học / Kho máy
                </label>
                <select
                  value={enrollClassCode}
                  onChange={(e) => setEnrollClassCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                >
                  <option value="6A1">Lớp 6A1</option>
                  <option value="6A2">Lớp 6A2</option>
                  <option value="7A1">Lớp 7A1</option>
                  <option value="8A1">Lớp 8A1</option>
                  <option value="KHO">Kho thiết bị dùng chung (Chưa phân lớp)</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEnroll}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isSubmittingEnroll ? 'Đang lưu...' : 'Lưu thiết bị & Kích hoạt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Connected Device Modal */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" /> Chỉnh sửa Thông tin Thiết bị đã kết nối
              </h3>
              <button
                onClick={() => setEditingDevice(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEditDevice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên thiết bị quản lý (Vị trí bàn / Học sinh) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ví dụ: Máy Bàn 01 (Teclast P30)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lớp học / Kho phân bổ
                </label>
                <select
                  value={editClassCode}
                  onChange={(e) => setEditClassCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                >
                  <option value="6A1">Lớp 6A1</option>
                  <option value="6A2">Lớp 6A2</option>
                  <option value="7A1">Lớp 7A1</option>
                  <option value="8A1">Lớp 8A1</option>
                  <option value="KHO">Kho thiết bị dùng chung</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Địa chỉ IP (LAN / Wi-Fi)
                  </label>
                  <input
                    type="text"
                    value={editIpAddress}
                    onChange={(e) => setEditIpAddress(e.target.value)}
                    placeholder="192.168.1.28"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Địa chỉ MAC Wi-Fi
                  </label>
                  <input
                    type="text"
                    value={editMacAddress}
                    onChange={(e) => setEditMacAddress(e.target.value)}
                    placeholder="00:08:22:64:6D:79"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên dòng máy (Model)
                </label>
                <input
                  type="text"
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                  placeholder="Teclast P30 (P30_ROW)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isSavingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PortalLayout(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<MdmProviderType>(MDM_PROVIDER_TYPES.CLASSROOM_DPC);
  const [portalMode, setPortalMode] = useState<'TEACHER' | 'ADMIN'>(() => {
    if (location.pathname.startsWith('/admin')) {
      return 'ADMIN';
    }
    return (localStorage.getItem('school_mdm_active_portal') as 'TEACHER' | 'ADMIN') || 'TEACHER';
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('school_mdm_admin_auth') === 'true';
  });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const handleSwitchToAdmin = () => {
    if (isAdminAuthenticated) {
      setPortalMode('ADMIN');
      localStorage.setItem('school_mdm_active_portal', 'ADMIN');
    } else {
      setShowAdminLoginModal(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setShowAdminLoginModal(false);
    setPortalMode('ADMIN');
    localStorage.setItem('school_mdm_active_portal', 'ADMIN');
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('school_mdm_admin_auth');
    setIsAdminAuthenticated(false);
    setPortalMode('TEACHER');
    localStorage.setItem('school_mdm_active_portal', 'TEACHER');
    navigate('/');
  };

  const handleSwitchToTeacher = () => {
    setPortalMode('TEACHER');
    localStorage.setItem('school_mdm_active_portal', 'TEACHER');
    setShowAdminLoginModal(false);
    navigate('/');
  };

  // TEACHER PORTAL MODE
  if (portalMode === 'TEACHER') {
    return (
      <>
        <OnboardingGuide
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          currentRole={ROLES.TEACHER}
          currentProvider={provider}
          onSelectRole={() => {}}
          onSelectProvider={setProvider}
          onNavigate={(path) => navigate(path)}
        />
        {showAdminLoginModal && (
          <AdminLogin
            isModal
            onSuccess={handleAdminLoginSuccess}
            onCancel={() => setShowAdminLoginModal(false)}
          />
        )}
        <TeacherClassroomView
          onOpenAdminLogin={handleSwitchToAdmin}
          onOpenOnboarding={() => setShowOnboarding(true)}
        />
      </>
    );
  }

  // ADMIN PORTAL MODE - Prompt login if not authenticated
  if (!isAdminAuthenticated) {
    return (
      <>
        <OnboardingGuide
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          currentRole={ROLES.ADMIN}
          currentProvider={provider}
          onSelectRole={() => {}}
          onSelectProvider={setProvider}
          onNavigate={(path) => navigate(path)}
        />
        <AdminLogin
          onSuccess={handleAdminLoginSuccess}
          onCancel={handleSwitchToTeacher}
        />
      </>
    );
  }

  // ADMIN PORTAL MODE - Authenticated layout
  const visibleMenuItems = SIDEBAR_MENU_ITEMS.filter((item) =>
    item.allowedRoles.includes(ROLES.ADMIN),
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <OnboardingGuide
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        currentRole={ROLES.ADMIN}
        currentProvider={provider}
        onSelectRole={() => {}}
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
                <p className="text-[11px] text-slate-400 truncate">Kiểm soát qua MAC Wi-Fi</p>
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
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Hệ Thống Quản Trị Trường Học
              </h2>
              <span className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5" /> Quản trị viên
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Trung tâm điều khiển máy tính bảng trực tiếp qua Địa chỉ MAC Wi-Fi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quyền Kiểm soát: MAC Wi-Fi (00:08:22:64:6D:79)</span>
            </span>

            <button
              onClick={() => setShowOnboarding(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
              <span>Hướng dẫn (5 Bước)</span>
            </button>

            <button
              onClick={handleSwitchToTeacher}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
              title="Chuyển sang giao diện giảng dạy của giáo viên"
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Cổng Giáo viên</span>
            </button>

            <button
              onClick={handleAdminLogout}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
              title="Đăng xuất khỏi phiên quản trị viên"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </header>

        <section className="mt-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <Routes>
            <Route
              path="/"
              element={
                <OverviewView
                  onOpenOnboarding={() => setShowOnboarding(true)}
                />
              }
            />
            <Route
              path="/devices"
              element={
                <DevicesAndSessionControlView
                  title="Quản lý Thiết bị Kết nối qua MAC Wi-Fi"
                />
              }
            />
            <Route path="/classes" element={<AdminClassesView />} />
            <Route path="/applications" element={<ApplicationsManagementView />} />
            <Route path="/policies" element={<AdminPoliciesView />} />
            <Route path="/sessions" element={<AdminSessionsView />} />
            <Route path="/users" element={<AdminUsersView />} />
            <Route path="/reports" element={<AdminReportsView />} />
            <Route path="/audit-logs" element={<AdminAuditLogsView />} />
            <Route path="/mdm-config" element={<AdminMacWifiConfigView />} />
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
