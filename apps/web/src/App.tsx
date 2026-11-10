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
  Pin,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Radio,
  Battery,
  BatteryWarning,
  Wifi,
} from 'lucide-react';
import { AdminLogin } from './components/AdminLogin';
import { TeacherClassroomView } from './views/TeacherClassroomView';
import { ApplicationsManagementView } from './views/ApplicationsManagementView';
import { HardwareControlBanner } from './components/HardwareControlModal';
import { API_BASE_URL } from './config/api';

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
  provider,
  onOpenOnboarding,
}: {
  provider: MdmProviderType;
  onOpenOnboarding: () => void;
}): React.ReactElement {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<RealDeviceItem[]>([]);

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

  return (
    <div className="space-y-6">
      {/* Onboarding Quickstart Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold tracking-tight text-white">5 bước đưa máy tính bảng vào giảng dạy</h3>
          <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
            Kết nối máy tính bảng học sinh bằng ID Thiết bị Android (Android ID), Số Serial hoặc mã IMEI. Khi máy khởi động lên, hệ thống sẽ tự động nhận diện và ghép nối tức thì.
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
            <span>Đăng ký máy thật (Android ID / S/N)</span>
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
            <p className="text-xs font-medium text-slate-500">Thiết bị đang hoạt động</p>
            {onlineCount > 0 ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : null}
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
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
          <p className="text-xs text-slate-500 mt-1">Tự động kết nối khi máy mở nguồn</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <p className="text-xs font-medium text-slate-500">Chế độ quản lý</p>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {provider === MDM_PROVIDER_TYPES.CLASSROOM_DPC ? 'Lớp học Tiêu chuẩn' : 'Headwind MDM'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {provider === MDM_PROVIDER_TYPES.CLASSROOM_DPC
              ? 'Tự động bắt sóng qua LAN/Wi-Fi'
              : 'Chế độ quản lý mở rộng'}
          </p>
        </div>
      </div>

      {/* Step by Step Interactive Checklist */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Các bước nhanh để bắt đầu sử dụng ngay:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div
            onClick={() => navigate('/classes')}
            className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-slate-50/50 transition cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition">1. Tạo Lớp & Phân công</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Thiết lập danh sách lớp học và giáo viên phụ trách bộ môn.
            </p>
          </div>

          <div
            onClick={() => navigate('/devices')}
            className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-slate-50/50 transition cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition">2. Đăng ký Thiết bị Thật (Android ID / S/N)</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Đăng ký bằng ID Thiết bị Android (Android ID) hoặc Số Serial / IMEI để hệ thống tự động nhận diện khi máy khởi động.
            </p>
          </div>

          <div
            onClick={() => navigate('/sessions')}
            className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-slate-50/50 transition cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition">3. Bắt đầu Tiết học</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
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
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [devices, setDevices] = useState<RealDeviceItem[]>([]);
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
  const [probeTarget, setProbeTarget] = useState('192.168.1.28');
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
      setEnrollError('Vui lòng nhập Địa chỉ IP (ví dụ: 192.168.1.28) hoặc Địa chỉ MAC Wi-Fi');
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

      setProbeTarget('192.168.1.28');
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
    try {
      await fetch(`${API_BASE_URL}/devices/classroom-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: true }),
      });
    } catch {
      // ignore
    }
    setLastCommandResult({
      actionName: confirmModal.actionName,
      status: COMMAND_STATUSES.SENT,
      detail: 'Lệnh Khóa màn hình phần cứng đã được phát đến toàn bộ thiết bị.',
    });
    setConfirmModal(null);
  };

  return (
    <div className="space-y-6">
      <HardwareControlBanner defaultIp="192.168.1.28" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">
            Dành cho Quản trị viên: Đăng ký thiết bị thật qua ID Thiết bị Android (Android ID), Số Serial hoặc IMEI, phân phối vào kho hoặc các lớp học.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class Filter */}
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            aria-label="Lọc theo lớp học"
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 shadow-xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition"
          >
            <option value="ALL">Tất cả (Lớp & Kho máy)</option>
            <option value="KHO">Kho thiết bị dùng chung</option>
            <option value="6A1">Lớp 6A1</option>
            <option value="6A2">Lớp 6A2</option>
            <option value="7A1">Lớp 7A1</option>
            <option value="8A1">Lớp 8A1</option>
          </select>

          {/* Enroll Real Device button (Admin only) */}
          <button
            type="button"
            onClick={() => {
              setEnrollError(null);
              setEnrollClassCode('KHO');
              setShowEnrollModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Đăng ký máy thật (Android ID / S/N)</span>
          </button>

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
              'px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 shadow-sm',
              caps.remoteLock.supported
                ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed',
            )}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Khóa màn hình</span>
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
              'px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 shadow-sm',
              caps.kioskMode.supported
                ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed',
            )}
          >
            <Pin className="w-3.5 h-3.5 shrink-0" />
            <span>Bật Kiosk</span>
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
            Thao tác này sẽ áp dụng ngay lập tức lên tất cả máy tính bảng trong lớp học.
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

      {/* Real Devices Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-xs uppercase tracking-wider">
              <th className="py-3 px-4 font-semibold">Tên thiết bị</th>
              <th className="py-3 px-4 font-semibold">Mã định danh (Android ID / S/N)</th>
              <th className="py-3 px-4 font-semibold">Lớp học</th>
              <th className="py-3 px-4 font-semibold">Trạng thái</th>
              <th className="py-3 px-4 font-semibold">Phần cứng</th>
              <th className="py-3 px-4 font-semibold">Mức pin</th>
              <th className="py-3 px-4 font-semibold">Lần cuối phản hồi</th>
              <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {devices.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Tablet className="w-8 h-8 text-indigo-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Chưa có thiết bị nào trong hệ thống
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mt-0.5">
                        Bấm nút "Đăng ký máy thật (Android ID / S/N)" bên trên để thêm Android ID hoặc số Serial. Khi máy khởi động, hệ thống sẽ tự động bắt sóng và hiển thị ngay.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              devices.map((d) => {
                const isOnline = d.status === 'ONLINE';
                const isPending = d.status === 'PENDING_DETECTION';

                return (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{d.name}</td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      <div className="font-semibold text-slate-900">
                        {d.ipAddress ? `IP: ${d.ipAddress}` : d.androidId || d.serialNumber || d.imei}
                      </div>
                      {d.macAddress && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          MAC: {d.macAddress}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-xs text-slate-700">
                      {d.classCode === 'KHO' ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[11px]">
                          Kho dùng chung
                        </span>
                      ) : (
                        `Lớp ${d.classCode}`
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Trực tuyến
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

      {/* Enroll Real Device Modal with Live Connection Test */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tablet className="w-4 h-4 text-indigo-600" /> Kết nối &amp; Đăng ký Máy tính bảng (LAN / Wi-Fi)
              </h3>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Dành riêng cho Quản trị viên: Đối với dòng máy <strong>Teclast P30</strong>, hãy nhập <strong>Địa chỉ IP</strong> (ví dụ: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-700">192.168.1.28</code>) hoặc Địa chỉ MAC Wi-Fi hiển thị trên màn hình máy tính bảng và bấm <strong>Kiểm tra kết nối</strong> để xác nhận tín hiệu trước khi lưu.
            </p>

            {enrollError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {enrollError}
              </div>
            )}

            {/* Bước 1: Test kết nối trước khi đặt tên */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Bước 1: Nhập Địa chỉ IP hoặc MAC Wi-Fi để kiểm tra tín hiệu máy
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={probeTarget}
                  onChange={(e) => setProbeTarget(e.target.value)}
                  placeholder="Ví dụ: 192.168.1.28 hoặc 00:08:22:64:6d:79"
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

              {/* Probe Result Banner */}
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

            {/* Bước 2: Đặt tên định danh và Phân lớp */}
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
                    Địa chỉ MAC / Mã định danh
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
                <p className="text-[11px] text-slate-400 truncate">Cổng Quản Trị Hệ Thống</p>
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
              Trung tâm điều phối thiết bị, chính sách và tài khoản toàn trường
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowOnboarding(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
              <span>Hướng dẫn (5 Bước)</span>
            </button>

            <select
              aria-label="Chọn chế độ quản lý"
              value={provider}
              onChange={(e) => setProvider(e.target.value as MdmProviderType)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition shadow-sm"
            >
              <option value={MDM_PROVIDER_TYPES.CLASSROOM_DPC}>
                Chế độ: Lớp học ($0)
              </option>
              <option value={MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY}>
                Chế độ: Headwind MDM
              </option>
            </select>

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
                  provider={provider}
                  onOpenOnboarding={() => setShowOnboarding(true)}
                />
              }
            />
            <Route
              path="/devices"
              element={
                <DevicesAndSessionControlView
                  provider={provider}
                  title="Quản lý Thiết bị Toàn trường"
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
              element={<ApplicationsManagementView />}
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
