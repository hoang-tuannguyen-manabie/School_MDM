import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  Pin,
  Sparkles,
  Shield,
  CheckCircle2,
  Clock,
  Battery,
  BatteryWarning,
  Send,
  X,
  Play,
  Square,
  Tablet,
  CheckSquare,
  MinusCircle,
  Radio,
  Layers,
  RefreshCw,
  Smartphone,
  Check,
  Pencil,
  Wifi,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@school-mdm/ui';
import { API_BASE_URL } from '../config/api';
import { AppDeviceIcon } from '../components/AppDeviceIcon';
import { ClassroomCountdownTimer } from '../components/ClassroomCountdownTimer';
import { ChromeBrowsingManager } from '../components/ChromeBrowsingManager';

const PAGE_SIZE = 10;

export interface ClassroomAppItem {
  id: string;
  packageName: string;
  name: string;
  category: string;
  versionName?: string;
  versionCode?: number;
  isApproved: boolean;
  description: string | null;
}

export interface ClassroomDeviceRecord {
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
  activeApp?: string;
  isLocked?: boolean;
}

interface TeacherClassroomViewProps {
  onOpenAdminLogin: () => void;
  onOpenOnboarding: () => void;
}

export function TeacherClassroomView({
  onOpenAdminLogin,
  onOpenOnboarding,
}: TeacherClassroomViewProps): React.ReactElement {
  const [selectedClass, setSelectedClass] = useState('6A1');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [devices, setDevices] = useState<ClassroomDeviceRecord[]>([]);
  const [apps, setApps] = useState<ClassroomAppItem[]>([]);
  const [activeKioskApp, setActiveKioskApp] = useState<ClassroomAppItem | null>(null);
  const [isAllLocked, setIsAllLocked] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Pagination & filtering for concise Kiosk app pinning (max 10 rows/items)
  const [appSearch, setAppSearch] = useState('');
  const [appFilterMode, setAppFilterMode] = useState<'ALL' | 'APPROVED'>('ALL');
  const [appPage, setAppPage] = useState(1);

  // Pagination for controlled devices list (max 10 items)
  const [devicePage, setDevicePage] = useState(1);

  // Modal: Select existing tablets from the school system
  const [showDeviceSelectorModal, setShowDeviceSelectorModal] = useState(false);
  const [allSchoolDevices, setAllSchoolDevices] = useState<ClassroomDeviceRecord[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [isLoadingSchoolDevices, setIsLoadingSchoolDevices] = useState(false);
  const [isSavingDeviceSelection, setIsSavingDeviceSelection] = useState(false);
  const [selectorPage, setSelectorPage] = useState(1);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4500);
  };

  // Poll devices assigned to the current class
  const fetchClassroomDevices = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/devices/classroom-status?classCode=${selectedClass}`,
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setDevices(json.data);
        }
      }
    } catch {
      // Backend temporarily unreachable
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchClassroomDevices();
    const timer = setInterval(fetchClassroomDevices, 3000);
    return () => clearInterval(timer);
  }, [fetchClassroomDevices]);

  // Poll applications and kiosk status from server
  const fetchClassroomApps = useCallback(async () => {
    try {
      const [appsRes, kioskRes] = await Promise.all([
        fetch(`${API_BASE_URL}/applications`),
        fetch(`${API_BASE_URL}/applications/kiosk`),
      ]);
      if (appsRes.ok) {
        const json = await appsRes.json();
        if (json.data && Array.isArray(json.data)) {
          setApps(json.data);
        }
      }
      if (kioskRes.ok) {
        const json = await kioskRes.json();
        setActiveKioskApp(json.data?.activeKioskApp ?? null);
      }
    } catch {
      // Backend temporarily unreachable
    }
  }, []);

  useEffect(() => {
    fetchClassroomApps();
    const timer = setInterval(fetchClassroomApps, 4000);
    return () => clearInterval(timer);
  }, [fetchClassroomApps]);

  // Open the tablet selector modal: load all school tablets and pre-check those already in this class
  const handleOpenDeviceSelector = async () => {
    setIsLoadingSchoolDevices(true);
    setShowDeviceSelectorModal(true);
    setSelectorPage(1);
    try {
      const res = await fetch(`${API_BASE_URL}/devices/classroom-status`);
      if (res.ok) {
        const json = await res.json();
        const list: ClassroomDeviceRecord[] = json.data || [];
        setAllSchoolDevices(list);

        const currentIds = new Set(
          list.filter((d) => d.classCode === selectedClass).map((d) => d.id),
        );
        setSelectedDeviceIds(currentIds);
      }
    } catch {
      showToast('Không thể tải danh sách thiết bị trường học. Vui lòng thử lại.');
    } finally {
      setIsLoadingSchoolDevices(false);
    }
  };

  const handleToggleDeviceSelection = (id: string) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllDevices = () => {
    if (selectedDeviceIds.size === allSchoolDevices.length) {
      setSelectedDeviceIds(new Set());
    } else {
      setSelectedDeviceIds(new Set(allSchoolDevices.map((d) => d.id)));
    }
  };

  const handleSaveDeviceSelection = async () => {
    setIsSavingDeviceSelection(true);
    try {
      const toAssign = Array.from(selectedDeviceIds);
      const previouslyAssigned = allSchoolDevices
        .filter((d) => d.classCode === selectedClass)
        .map((d) => d.id);
      const toUnassign = previouslyAssigned.filter((id) => !selectedDeviceIds.has(id));

      if (toAssign.length > 0) {
        await fetch(`${API_BASE_URL}/devices/batch-assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceIds: toAssign,
            classCode: selectedClass,
          }),
        });
      }

      if (toUnassign.length > 0) {
        await fetch(`${API_BASE_URL}/devices/batch-assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceIds: toUnassign,
            classCode: 'KHO',
          }),
        });
      }

      showToast(`Đã đưa ${toAssign.length} máy tính bảng vào lớp ${selectedClass}.`);
      setShowDeviceSelectorModal(false);
      await fetchClassroomDevices();
    } catch {
      showToast('Có lỗi xảy ra khi cập nhật danh sách máy.');
    } finally {
      setIsSavingDeviceSelection(false);
    }
  };

  const handleRemoveDeviceFromClass = async (id: string, name: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/batch-assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: [id],
          classCode: 'KHO',
        }),
      });
      if (res.ok) {
        showToast(`Đã đưa máy "${name}" về kho thiết bị dùng chung.`);
        await fetchClassroomDevices();
      }
    } catch {
      showToast('Không thể gỡ thiết bị. Vui lòng thử lại.');
    }
  };

  // Edit connected device information modal
  const [editingDevice, setEditingDevice] = useState<ClassroomDeviceRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editClassCode, setEditClassCode] = useState('6A1');
  const [editIpAddress, setEditIpAddress] = useState('');
  const [editMacAddress, setEditMacAddress] = useState('');
  const [editModel, setEditModel] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOpenEditDevice = (device: ClassroomDeviceRecord) => {
    setEditingDevice(device);
    setEditName(device.name || '');
    setEditClassCode(device.classCode || selectedClass);
    setEditIpAddress(device.ipAddress || '');
    setEditMacAddress(device.macAddress || device.androidId || device.serialNumber || '');
    setEditModel(device.model || 'Teclast P30 (P30_ROW)');
  };

  const handleSaveEditDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice || !editName.trim()) return;
    setIsSavingEdit(true);
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
      if (res.ok) {
        setEditingDevice(null);
        await fetchClassroomDevices();
        showToast(`Đã cập nhật thông tin thiết bị "${editName.trim()}" thành công!`);
      }
    } catch {
      showToast('Không thể cập nhật thông tin thiết bị.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Lock entire classroom (real hardware sleep + watchdog lock)
  const handleLockAll = async () => {
    setIsAllLocked(true);
    try {
      await fetch(`${API_BASE_URL}/devices/classroom-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: true }),
      });
      showToast('Đã phát lệnh KHÓA & TẮT MÀN HÌNH toàn bộ máy tính bảng qua MAC Wi-Fi.');
    } catch {
      showToast('Lỗi khi gửi lệnh khóa màn hình.');
    }
  };

  // Unlock entire classroom (real hardware wake + dismiss keyguard)
  const handleUnlockAll = async () => {
    setIsAllLocked(false);
    try {
      await fetch(`${API_BASE_URL}/devices/classroom-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: false }),
      });
      showToast('Đã mở sáng màn hình toàn bộ máy tính bảng. Học sinh có thể làm bài tiếp tục.');
    } catch {
      showToast('Lỗi khi gửi lệnh mở khóa.');
    }
  };

  // Apply or remove Kiosk mode for any app (teacher can freely pin/unpin any app on the tablet)
  const handleApplyKiosk = async (targetApp: ClassroomAppItem | null) => {
    try {
      const res = await fetch(`${API_BASE_URL}/applications/kiosk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: targetApp ? targetApp.id : null }),
      });
      if (res.ok) {
        const json = await res.json();
        const updated = (json.data?.activeKioskApp as ClassroomAppItem) ?? null;
        setActiveKioskApp(updated);
        setIsAllLocked(false);
        await fetchClassroomApps();
        if (targetApp) {
          showToast(`Đã ghim ứng dụng [${targetApp.name}] lên màn hình máy tính bảng!`);
        } else {
          showToast('Đã bỏ ghim ứng dụng. Máy tính bảng trở về chế độ sử dụng tự do.');
        }
      }
    } catch {
      showToast('Lỗi khi gửi lệnh ghim ứng dụng.');
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    const msg = broadcastMessage.trim();
    try {
      await fetch(`${API_BASE_URL}/devices/classroom-broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      showToast(`Đã gửi thông báo hiển thị trực tiếp lên màn hình tablet: "${msg}"`);
    } catch {
      showToast('Lỗi khi gửi thông báo.');
    }
    setBroadcastMessage('');
    setShowBroadcastModal(false);
  };

  const onlineDevices = devices.filter((d) => d.status === 'ONLINE');

  // Filter & paginate apps for concise Kiosk pinning (max 10 rows/items per page)
  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(appSearch.toLowerCase()) ||
      app.packageName.toLowerCase().includes(appSearch.toLowerCase());
    const matchesMode = appFilterMode === 'ALL' ? true : app.isApproved;
    return matchesSearch && matchesMode;
  });

  const totalAppPages = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const safeAppPage = Math.min(appPage, totalAppPages);
  const paginatedApps = filteredApps.slice(
    (safeAppPage - 1) * PAGE_SIZE,
    safeAppPage * PAGE_SIZE,
  );

  // Paginate controlled devices (max 10 rows per page)
  const totalDevicePages = Math.max(1, Math.ceil(devices.length / PAGE_SIZE));
  const safeDevicePage = Math.min(devicePage, totalDevicePages);
  const paginatedDevices = devices.slice(
    (safeDevicePage - 1) * PAGE_SIZE,
    safeDevicePage * PAGE_SIZE,
  );

  // Paginate device selector modal list (max 10 rows per page)
  const totalSelectorPages = Math.max(1, Math.ceil(allSchoolDevices.length / PAGE_SIZE));
  const safeSelectorPage = Math.min(selectorPage, totalSelectorPages);
  const paginatedSelectorDevices = allSchoolDevices.slice(
    (safeSelectorPage - 1) * PAGE_SIZE,
    safeSelectorPage * PAGE_SIZE,
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navigation for Teacher */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
            M
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Cổng Giáo Viên Giảng Dạy
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                Kiểm soát qua MAC Wi-Fi
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Điều khiển trực tiếp máy tính bảng học sinh qua địa chỉ MAC Wi-Fi &amp; mạng LAN
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class selector */}
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setDevicePage(1);
            }}
            aria-label="Chọn lớp giảng dạy"
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 shadow-xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition"
          >
            <option value="6A1">Lớp 6A1 • Môn Toán</option>
            <option value="6A2">Lớp 6A2 • Môn Khoa học</option>
            <option value="7A1">Lớp 7A1 • Môn Tin học</option>
            <option value="8A1">Lớp 8A1 • Môn Tiếng Anh</option>
          </select>

          <button
            onClick={onOpenOnboarding}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Hướng dẫn 5 Bước</span>
          </button>

          {/* Switch to Admin with Login */}
          <button
            onClick={onOpenAdminLogin}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-semibold transition flex items-center gap-2 shadow-xs"
            title="Đăng nhập Cổng Quản trị viên (Cần mật khẩu)"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Cổng Quản trị viên</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Notification Toast */}
        {toastMessage && (
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex items-center justify-between shadow-sm animate-in fade-in duration-150">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-indigo-400 hover:text-indigo-700 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PROMINENT CONTROLLED TABLETS SECTION (Moved right to top for crystal-clear visibility) */}
        <div className="p-5 rounded-2xl bg-white border-2 border-indigo-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Tablet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Máy Tính Bảng Đang Được Điều Khiển — Lớp {selectedClass}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {onlineDevices.length}/{devices.length} máy trực tuyến qua MAC Wi-Fi
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hiển thị trực tiếp các máy tính bảng đang chịu quyền kiểm soát qua MAC Wi-Fi trong tiết học (tối đa 10 dòng/trang)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleOpenDeviceSelector}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Chọn máy vào lớp ({devices.length})</span>
              </button>
            </div>
          </div>

          {devices.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 flex flex-col items-center justify-center text-center space-y-3">
              <Tablet className="w-8 h-8 text-indigo-500" />
              <div className="space-y-1 max-w-md">
                <h4 className="text-sm font-bold text-slate-900">
                  Lớp {selectedClass} chưa có máy tính bảng nào được gán
                </h4>
                <p className="text-xs text-slate-500">
                  Bấm nút bên dưới để chọn máy tính bảng đã kết nối MAC Wi-Fi đưa vào lớp học này.
                </p>
              </div>
              <button
                onClick={handleOpenDeviceSelector}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              >
                <Layers className="w-4 h-4" />
                <span>Chọn máy tính bảng vào lớp {selectedClass}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3.5 font-semibold">Tên Thiết bị &amp; Lớp</th>
                      <th className="py-2.5 px-3.5 font-semibold">MAC Wi-Fi &amp; Địa chỉ IP</th>
                      <th className="py-2.5 px-3.5 font-semibold">Trạng thái Kiểm soát</th>
                      <th className="py-2.5 px-3.5 font-semibold">Pin</th>
                      <th className="py-2.5 px-3.5 font-semibold">Chế độ trên màn hình</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Thao tác nhanh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedDevices.map((device) => {
                      const isOnline = device.status === 'ONLINE';
                      const macDisplay =
                        device.macAddress || device.androidId || device.serialNumber || '00:08:22:64:6D:79';
                      const ipDisplay = device.ipAddress || '192.168.1.28';

                      return (
                        <tr
                          key={device.id}
                          className={cn(
                            'transition-colors',
                            isOnline ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-slate-50',
                          )}
                        >
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0',
                                  isOnline
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-700',
                                )}
                              >
                                <Tablet className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 text-xs">
                                    {device.name}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                    Lớp {device.classCode}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {device.model || 'Teclast P30 (P30_ROW)'}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3.5 font-mono">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <Wifi className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>MAC: {macDisplay}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              IP LAN: <strong className="text-slate-700">{ipDisplay}</strong>
                            </div>
                          </td>

                          <td className="py-3 px-3.5">
                            {isOnline ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  Đang điều khiển trực tiếp
                                </span>
                                <p className="text-[10px] text-slate-500 pl-1">{device.lastSeen}</p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
                                Chờ tín hiệu Wi-Fi
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3.5">
                            {device.batteryLevel !== null && device.batteryLevel !== undefined ? (
                              <div className="flex items-center gap-1 font-bold tabular-nums text-slate-800">
                                {device.batteryLevel < 30 ? (
                                  <BatteryWarning className="w-4 h-4 text-amber-500" />
                                ) : (
                                  <Battery className="w-4 h-4 text-emerald-600" />
                                )}
                                <span>{device.batteryLevel}%</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3 px-3.5">
                            {isAllLocked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[11px]">
                                <Lock className="w-3 h-3" /> Đang khóa màn hình
                              </span>
                            ) : activeKioskApp ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-[11px]">
                                <AppDeviceIcon
                                  packageName={activeKioskApp.packageName}
                                  name={activeKioskApp.name}
                                  size="xs"
                                />
                                <span>Ghim: {activeKioskApp.name}</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-[11px]">
                                <Check className="w-3 h-3" /> Mở tự do ({apps.filter((a) => a.isApproved).length} app)
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3.5 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                onClick={handleLockAll}
                                title="Khóa màn hình thiết bị này"
                                className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold transition inline-flex items-center gap-1"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Khóa</span>
                              </button>
                              <button
                                onClick={handleUnlockAll}
                                title="Mở sáng màn hình thiết bị này"
                                className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold transition inline-flex items-center gap-1"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Mở</span>
                              </button>
                              <button
                                onClick={() => handleOpenEditDevice(device)}
                                title="Đổi tên thiết bị & sửa thông tin kết nối"
                                className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-semibold transition inline-flex items-center gap-1"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleRemoveDeviceFromClass(device.id, device.name)}
                                title="Đưa về kho dùng chung"
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                              >
                                <MinusCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination for Controlled Devices (Max 10 rows) */}
              {devices.length > PAGE_SIZE && (
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                  <span>
                    Hiển thị {(safeDevicePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safeDevicePage * PAGE_SIZE, devices.length)} trên tổng số{' '}
                    <strong>{devices.length}</strong> máy tính bảng (Tối đa 10 dòng/trang)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={safeDevicePage <= 1}
                      onClick={() => setDevicePage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Trước
                    </button>
                    <span className="px-2 font-semibold">
                      Trang {safeDevicePage}/{totalDevicePages}
                    </span>
                    <button
                      disabled={safeDevicePage >= totalDevicePages}
                      onClick={() => setDevicePage((p) => Math.min(totalDevicePages, p + 1))}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
                    >
                      Sau <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Classroom Live Control Dashboard */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
          {/* Status Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Điều khiển Phòng học {selectedClass}
                </h2>
                {isSessionActive ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Tiết học đang diễn ra
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                    Chưa bắt đầu tiết học
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Tiết 2 (08:15 - 09:00) • Năm học 2026-2027</span>
              </p>
            </div>

            {/* Quick Session Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsSessionActive(!isSessionActive);
                  showToast(
                    isSessionActive
                      ? 'Đã kết thúc tiết học. Thiết bị được trả về trạng thái tự do.'
                      : 'Đã bắt đầu tiết học mới. Áp dụng quyền kiểm soát qua MAC Wi-Fi.',
                  );
                }}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs',
                  isSessionActive
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700',
                )}
              >
                {isSessionActive ? (
                  <>
                    <Square className="w-3.5 h-3.5" /> Kết thúc tiết học
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Bắt đầu tiết học
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Teaching Actions (1-Click Actions) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Lệnh điều khiển tức thời qua MAC Wi-Fi
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Lock All */}
              <button
                onClick={handleLockAll}
                className={cn(
                  'p-3.5 rounded-xl border text-left transition flex items-center justify-between group shadow-xs',
                  isAllLocked
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-white border-slate-200 hover:border-rose-400 hover:bg-rose-50/30',
                )}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700">
                    <Lock className="w-4 h-4" /> Khóa màn hình cả lớp
                  </div>
                  <p className="text-[11px] text-slate-500">Tắt màn hình yêu cầu chú ý lên bảng</p>
                </div>
              </button>

              {/* Unlock All */}
              <button
                onClick={handleUnlockAll}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 text-left transition flex items-center justify-between group shadow-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700">
                    <Unlock className="w-4 h-4" /> Mở khóa cho học sinh
                  </div>
                  <p className="text-[11px] text-slate-500">Bật sáng màn hình để làm bài</p>
                </div>
              </button>

              {/* Quick Kiosk Toggle / Status */}
              {activeKioskApp ? (
                <button
                  onClick={() => handleApplyKiosk(null)}
                  className="p-3.5 rounded-xl border border-indigo-300 bg-indigo-50/90 hover:bg-indigo-100 text-left transition flex items-center justify-between group shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AppDeviceIcon
                      packageName={activeKioskApp.packageName}
                      name={activeKioskApp.name}
                      size="sm"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-800 truncate">
                        <Pin className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Bỏ ghim [{activeKioskApp.name}]
                      </div>
                      <p className="text-[11px] text-slate-600 truncate">Bấm để hủy ghim ứng dụng</p>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-left flex items-center justify-between shadow-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700">
                      <Layers className="w-4 h-4 text-emerald-600" /> Không ghim (Mở tự do)
                    </div>
                    <p className="text-[11px] text-slate-500">Chọn app bên dưới để ghim tức thì</p>
                  </div>
                </div>
              )}

              {/* Broadcast message */}
              <button
                onClick={() => setShowBroadcastModal(true)}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 text-left transition flex items-center justify-between group shadow-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Send className="w-4 h-4 text-indigo-600" /> Gửi nhắc nhở cả lớp
                  </div>
                  <p className="text-[11px] text-slate-500">Hiện thông điệp lên màn hình tablet</p>
                </div>
              </button>
            </div>
          </div>

          {/* Parallel Classroom Activity Countdown Timer (Displays Floating Clock on Tablet!) */}
          <ClassroomCountdownTimer
            activeKioskApp={activeKioskApp}
            onExpireLockClassroom={() => setIsAllLocked(true)}
            onToast={showToast}
          />

          {/* Chrome & Web Browsing Control (Block new tabs, prevent search, lesson URL dispatch) */}
          <ChromeBrowsingManager onToast={showToast} />

          {/* CONCISE KIOSK APP PINNING SECTION (No descriptions, teacher can freely pin/unpin any app, max 10 items per page) */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <Smartphone className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Ghim / Bỏ ghim Ứng dụng trên Tablet ({filteredApps.length} App)
                  </h4>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={appSearch}
                    onChange={(e) => {
                      setAppSearch(e.target.value);
                      setAppPage(1);
                    }}
                    placeholder="Tìm nhanh tên app..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                {/* Filter All vs Approved */}
                <div className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAppFilterMode('ALL');
                      setAppPage(1);
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg font-semibold transition',
                      appFilterMode === 'ALL'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    Tất cả App ({apps.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAppFilterMode('APPROVED');
                      setAppPage(1);
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg font-semibold transition',
                      appFilterMode === 'APPROVED'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    Được duyệt ({apps.filter((a) => a.isApproved).length})
                  </button>
                </div>

                {activeKioskApp && (
                  <button
                    onClick={() => handleApplyKiosk(null)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Bỏ ghim [{activeKioskApp.name}]</span>
                  </button>
                )}
              </div>
            </div>

            {/* Compact App Grid (Max 10 items per page, NO descriptions) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-1">
              {paginatedApps.map((app) => {
                const isKiosked = activeKioskApp?.id === app.id;
                return (
                  <div
                    key={app.id}
                    className={cn(
                      'p-2.5 rounded-xl border transition flex items-center justify-between gap-2.5 shadow-2xs',
                      isKiosked
                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/20'
                        : 'bg-white border-slate-200 hover:border-indigo-300',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <AppDeviceIcon
                        packageName={app.packageName}
                        name={app.name}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <h5
                          className="text-xs font-bold text-slate-900 truncate"
                          title={app.name}
                        >
                          {app.name}
                        </h5>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isKiosked ? (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded-full">
                              Đang ghim
                            </span>
                          ) : app.isApproved ? (
                            <span className="text-[10px] font-semibold text-emerald-700">
                              Cho phép
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400">
                              Tạm khóa
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleApplyKiosk(isKiosked ? null : app)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shrink-0',
                        isKiosked
                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white',
                      )}
                    >
                      <Pin className="w-3 h-3" />
                      <span>{isKiosked ? 'Bỏ ghim' : 'Ghim'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pagination Bar (Max 10 apps per page) */}
            {filteredApps.length > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs text-slate-600">
                <span>
                  Hiển thị {(safeAppPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safeAppPage * PAGE_SIZE, filteredApps.length)} trên tổng số{' '}
                  <strong>{filteredApps.length}</strong> ứng dụng (Tối đa 10 dòng/trang)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeAppPage <= 1}
                    onClick={() => setAppPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Trang trước
                  </button>
                  <span className="px-2 font-semibold text-slate-800">
                    Trang {safeAppPage} / {totalAppPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeAppPage >= totalAppPages}
                    onClick={() => setAppPage((p) => Math.min(totalAppPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
                  >
                    Trang sau <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal: Select tablets from the school inventory (Max 10 rows per page) */}
      {showDeviceSelectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" /> Chọn Máy Tính Bảng Cho Lớp {selectedClass}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chọn các máy tính bảng kết nối qua MAC Wi-Fi để đưa vào quản lý tại lớp {selectedClass}.
                </p>
              </div>
              <button
                onClick={() => setShowDeviceSelectorModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isLoadingSchoolDevices ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                  <p className="text-xs">Đang tải danh sách thiết bị...</p>
                </div>
              ) : allSchoolDevices.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <Tablet className="w-10 h-10 text-slate-300 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Hệ thống trường học chưa có máy tính bảng nào
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                      Vui lòng chuyển sang Cổng Quản trị viên để đăng ký thiết bị mới qua MAC Wi-Fi.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDeviceSelectorModal(false);
                      onOpenAdminLogin();
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition inline-flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Mở Cổng Quản trị viên</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 text-xs">
                    <span className="text-slate-500 font-medium">
                      Đã chọn: <strong className="text-indigo-600">{selectedDeviceIds.size}</strong> / {allSchoolDevices.length} máy
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllDevices}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold transition"
                    >
                      {selectedDeviceIds.size === allSchoolDevices.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {paginatedSelectorDevices.map((dev) => {
                      const isChecked = selectedDeviceIds.has(dev.id);
                      const isOnline = dev.status === 'ONLINE';

                      return (
                        <div
                          key={dev.id}
                          onClick={() => handleToggleDeviceSelection(dev.id)}
                          className={cn(
                            'p-3.5 flex items-center justify-between cursor-pointer transition select-none',
                            isChecked ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'hover:bg-slate-50',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-indigo-600">
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 fill-indigo-600 text-white" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-300" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-slate-900">{dev.name}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {dev.classCode === 'KHO' ? 'Kho máy' : `Lớp ${dev.classCode}`}
                                </span>
                              </div>
                              <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                MAC: {dev.macAddress || dev.androidId || '00:08:22:64:6D:79'} • IP: {dev.ipAddress || '192.168.1.28'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            {isOnline ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Trực tuyến
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <Radio className="w-3 h-3 text-amber-500" />
                                Chờ bật
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {allSchoolDevices.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                      <span>
                        Trang {safeSelectorPage}/{totalSelectorPages}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={safeSelectorPage <= 1}
                          onClick={() => setSelectorPage((p) => Math.max(1, p - 1))}
                          className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
                        >
                          Trước
                        </button>
                        <button
                          type="button"
                          disabled={safeSelectorPage >= totalSelectorPages}
                          onClick={() => setSelectorPage((p) => Math.min(totalSelectorPages, p + 1))}
                          className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
                        >
                          Sau
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Thao tác này sẽ phân công các máy đã chọn vào <strong>Lớp {selectedClass}</strong>.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeviceSelectorModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSavingDeviceSelection || allSchoolDevices.length === 0}
                  onClick={handleSaveDeviceSelection}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs transition disabled:opacity-50"
                >
                  {isSavingDeviceSelection ? 'Đang lưu...' : `Áp dụng vào lớp ${selectedClass}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Message Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" /> Gửi thông điệp lên máy tính bảng
              </h3>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Thông báo sẽ hiện ngay giữa màn hình toàn bộ máy tính bảng trong lớp {selectedClass}.
            </p>
            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Ví dụ: Còn 5 phút kết thúc bài kiểm tra. Các em chuẩn bị nộp bài..."
                rows={3}
                required
                className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs"
                >
                  Gửi thông báo ngay
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
