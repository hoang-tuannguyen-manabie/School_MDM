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
  Info,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@school-mdm/ui';

export interface ClassroomDeviceRecord {
  id: string;
  imei: string;
  serialNumber?: string;
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
  const [activeKioskApp, setActiveKioskApp] = useState<string>('Chưa kích hoạt');
  const [isAllLocked, setIsAllLocked] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Modal: Select existing tablets from the school system
  const [showDeviceSelectorModal, setShowDeviceSelectorModal] = useState(false);
  const [allSchoolDevices, setAllSchoolDevices] = useState<ClassroomDeviceRecord[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [isLoadingSchoolDevices, setIsLoadingSchoolDevices] = useState(false);
  const [isSavingDeviceSelection, setIsSavingDeviceSelection] = useState(false);

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
        `http://localhost:4000/api/v1/devices/classroom-status?classCode=${selectedClass}`,
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

  // Open the tablet selector modal: load all school tablets and pre-check those already in this class
  const handleOpenDeviceSelector = async () => {
    setIsLoadingSchoolDevices(true);
    setShowDeviceSelectorModal(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/devices/classroom-status');
      if (res.ok) {
        const json = await res.json();
        const list: ClassroomDeviceRecord[] = json.data || [];
        setAllSchoolDevices(list);

        // Pre-select devices that are currently assigned to this class
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

  // Toggle selection of a device in the modal
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

  // Select all or deselect all
  const handleSelectAllDevices = () => {
    if (selectedDeviceIds.size === allSchoolDevices.length) {
      setSelectedDeviceIds(new Set());
    } else {
      setSelectedDeviceIds(new Set(allSchoolDevices.map((d) => d.id)));
    }
  };

  // Save the selection of tablets into this classroom
  const handleSaveDeviceSelection = async () => {
    setIsSavingDeviceSelection(true);
    try {
      const toAssign = Array.from(selectedDeviceIds);

      // Devices previously assigned to this class that were unchecked -> set to 'KHO'
      const previouslyAssigned = allSchoolDevices
        .filter((d) => d.classCode === selectedClass)
        .map((d) => d.id);
      const toUnassign = previouslyAssigned.filter((id) => !selectedDeviceIds.has(id));

      if (toAssign.length > 0) {
        await fetch('http://localhost:4000/api/v1/devices/batch-assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceIds: toAssign,
            classCode: selectedClass,
          }),
        });
      }

      if (toUnassign.length > 0) {
        await fetch('http://localhost:4000/api/v1/devices/batch-assign', {
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

  // Remove a single tablet from this classroom (returns to general pool)
  const handleRemoveDeviceFromClass = async (id: string, name: string) => {
    try {
      const res = await fetch('http://localhost:4000/api/v1/devices/batch-assign', {
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

  // Lock entire classroom
  const handleLockAll = () => {
    setIsAllLocked(true);
    showToast('Đã phát lệnh KHÓA MÀN HÌNH toàn bộ máy tính bảng trong phòng học.');
  };

  // Unlock entire classroom
  const handleUnlockAll = () => {
    setIsAllLocked(false);
    showToast('Đã mở khóa toàn bộ máy tính bảng. Học sinh có thể làm bài tiếp tục.');
  };

  // Apply Kiosk mode for specific educational app
  const handleApplyKiosk = (appName: string) => {
    setActiveKioskApp(appName);
    setIsAllLocked(false);
    showToast(`Đã gửi lệnh ghim ứng dụng [${appName}] lên màn hình tất cả máy tính bảng.`);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    showToast(`Đã gửi thông báo đến phòng học: "${broadcastMessage}"`);
    setBroadcastMessage('');
    setShowBroadcastModal(false);
  };

  const onlineDevices = devices.filter((d) => d.status === 'ONLINE');
  const pendingDevices = devices.filter((d) => d.status === 'PENDING_DETECTION');

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
                Lớp học Thông minh
              </span>
            </div>
            <p className="text-xs text-slate-500">Quản lý và điều khiển máy tính bảng phòng học</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class selector */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
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
                      : 'Đã bắt đầu tiết học mới. Áp dụng chính sách bài học.',
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
              Lệnh điều khiển tức thời trên lớp
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
                  <p className="text-[11px] text-slate-500">Yêu cầu học sinh chú ý lên bảng</p>
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
                  <p className="text-[11px] text-slate-500">Cho phép thao tác và làm bài</p>
                </div>
              </button>

              {/* Kiosk Manabie */}
              <button
                onClick={() => handleApplyKiosk('Manabie Learner')}
                className={cn(
                  'p-3.5 rounded-xl border text-left transition flex items-center justify-between group shadow-xs',
                  activeKioskApp === 'Manabie Learner' && !isAllLocked
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                    : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30',
                )}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-700">
                    <Pin className="w-4 h-4" /> Ghim Manabie Learner
                  </div>
                  <p className="text-[11px] text-slate-500">Chỉ mở ứng dụng học trực tuyến</p>
                </div>
              </button>

              {/* Broadcast message */}
              <button
                onClick={() => setShowBroadcastModal(true)}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 text-left transition flex items-center justify-between group shadow-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Send className="w-4 h-4 text-indigo-600" /> Gửi nhắc nhở cả lớp
                  </div>
                  <p className="text-[11px] text-slate-500">Gửi thông điệp hiển thị trên tablet</p>
                </div>
              </button>
            </div>
          </div>

          {/* Classroom Stat Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500">Máy trong lớp học</span>
              <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                {devices.length} Máy tính bảng
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500">Đang trực tuyến</span>
              <p className="text-xl font-bold text-emerald-700 tabular-nums mt-0.5">
                {onlineDevices.length} Máy hoạt động
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500">Chờ thiết bị bật nguồn</span>
              <p className="text-xl font-bold text-amber-600 tabular-nums mt-0.5">
                {pendingDevices.length} Máy
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500">Ứng dụng đang ghim</span>
              <p className="text-sm font-bold text-indigo-700 truncate mt-1">
                {activeKioskApp}
              </p>
            </div>
          </div>
        </div>

        {/* Live Grid of Physical Student Tablets */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Danh Sách Máy Tính Bảng Trong Lớp {selectedClass}
              </h3>
              <p className="text-xs text-slate-500">
                Chọn các máy hiện có trên hệ thống để đưa vào tiết học và theo dõi trạng thái tự động.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenDeviceSelector}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              >
                <Layers className="w-4 h-4" />
                <span>Chọn máy vào lớp học ({devices.length})</span>
              </button>
            </div>
          </div>

          {devices.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                <Tablet className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h4 className="text-sm font-bold text-slate-900">
                  Lớp {selectedClass} chưa chọn máy tính bảng nào
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Thầy/Cô vui lòng bấm nút bên dưới để chọn các máy tính bảng hiện có trên hệ thống vào lớp học này.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  onClick={handleOpenDeviceSelector}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-2 shadow-xs"
                >
                  <Layers className="w-4 h-4" />
                  <span>Chọn máy tính bảng vào lớp</span>
                </button>
              </div>

              <div className="w-full max-w-lg mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>Quy trình quản lý thiết bị:</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>
                    <strong>Quản trị viên:</strong> Chịu trách nhiệm đăng ký mã IMEI và thông số phần cứng của máy tính bảng vào hệ thống.
                  </li>
                  <li>
                    <strong>Giáo viên:</strong> Chỉ cần chọn từ các máy đã có sẵn để đưa vào tiết học và điều khiển tập trung.
                  </li>
                  <li>
                    Nếu trường chưa nhập mã IMEI cho máy mới, thầy/cô có thể chuyển sang{' '}
                    <button
                      onClick={onOpenAdminLogin}
                      className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-0.5"
                    >
                      Cổng Quản trị viên <ArrowRight className="w-3 h-3" />
                    </button>{' '}
                    để đăng ký.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {devices.map((device) => {
                const isOnline = device.status === 'ONLINE';
                const isPending = device.status === 'PENDING_DETECTION';

                return (
                  <div
                    key={device.id}
                    className={cn(
                      'p-4 rounded-2xl border transition-all space-y-3 bg-white shadow-xs',
                      isOnline
                        ? 'border-emerald-200 hover:border-emerald-300'
                        : isPending
                          ? 'border-amber-200 bg-amber-50/15'
                          : 'border-slate-200 bg-slate-50/40',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                            {device.name}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {device.classCode}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 truncate max-w-[150px]">
                          {device.model || 'Android Tablet'}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-500">
                          IMEI: {device.imei}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRemoveDeviceFromClass(device.id, device.name)}
                        title="Gỡ khỏi lớp học này"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                      >
                        <MinusCircle className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                      {/* Status indicator */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Trạng thái:</span>
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
                      </div>

                      {/* Battery level */}
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-500">Mức pin:</span>
                        {device.batteryLevel !== null && device.batteryLevel !== undefined ? (
                          <div className="flex items-center gap-1 font-semibold tabular-nums text-slate-800">
                            {device.batteryLevel < 30 ? (
                              <BatteryWarning className="w-4 h-4 text-amber-500" />
                            ) : (
                              <Battery className="w-4 h-4 text-emerald-600" />
                            )}
                            <span>{device.batteryLevel}%</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa phản hồi</span>
                        )}
                      </div>

                      {/* Hardware / Detection Info */}
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-500">Nhận diện:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[130px]" title={device.lastSeen}>
                          {device.lastSeen}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal: Select tablets from the school inventory */}
      {showDeviceSelectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" /> Chọn Máy Tính Bảng Cho Lớp {selectedClass}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chọn các máy tính bảng hiện có trên hệ thống để đưa vào quản lý tại lớp {selectedClass}.
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
                      Chưa có máy tính bảng nào được Quản trị viên đăng ký theo mã IMEI. Vui lòng chuyển sang Cổng Quản trị viên để đăng ký thiết bị mới.
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

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
                    {allSchoolDevices.map((dev) => {
                      const isChecked = selectedDeviceIds.has(dev.id);
                      const isOnline = dev.status === 'ONLINE';
                      const isPending = dev.status === 'PENDING_DETECTION';

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
                              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                IMEI: {dev.imei} • {dev.model || 'Android Tablet'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            {isOnline ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Trực tuyến
                              </span>
                            ) : isPending ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <Radio className="w-3 h-3 text-amber-500" />
                                Chờ bật
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                Ngoại tuyến
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
    </div>
  );
}
