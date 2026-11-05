import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Pin,
  RefreshCw,
  Sparkles,
  Shield,
  CheckCircle2,
  Clock,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Send,
  X,
  Play,
  Square,
  Tablet,
} from 'lucide-react';
import { cn } from '@school-mdm/ui';

interface StudentTablet {
  id: string;
  tableNumber: string;
  studentName: string;
  serial: string;
  battery: number;
  isCharging: boolean;
  status: 'ONLINE' | 'LOCKED' | 'OFFLINE';
  activeApp: string;
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
  const [tablets, setTablets] = useState<StudentTablet[]>([]);
  const [activeKioskApp, setActiveKioskApp] = useState<string>('Chưa kích hoạt');
  const [isAllLocked, setIsAllLocked] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSimulatingHeartbeat, setIsSimulatingHeartbeat] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  // Lock entire classroom
  const handleLockAll = () => {
    setIsAllLocked(true);
    setTablets((prev) => prev.map((t) => ({ ...t, status: 'LOCKED' })));
    showToast('Đã phát lệnh KHÓA MÀN HÌNH toàn bộ máy tính bảng trong phòng học.');
  };

  // Unlock entire classroom
  const handleUnlockAll = () => {
    setIsAllLocked(false);
    setTablets((prev) => prev.map((t) => ({ ...t, status: 'ONLINE' })));
    showToast('Đã mở khóa toàn bộ máy tính bảng. Học sinh có thể làm bài tiếp tục.');
  };

  // Apply Kiosk mode for specific educational app
  const handleApplyKiosk = (appName: string) => {
    setActiveKioskApp(appName);
    setTablets((prev) =>
      prev.map((t) => ({ ...t, activeApp: appName, status: 'ONLINE' })),
    );
    setIsAllLocked(false);
    showToast(`Đã ghim ứng dụng [${appName}] lên màn hình tất cả học sinh.`);
  };

  // Toggle individual tablet lock
  const handleToggleTablet = (id: string) => {
    setTablets((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const newStatus = t.status === 'LOCKED' ? 'ONLINE' : 'LOCKED';
          showToast(`Đã ${newStatus === 'LOCKED' ? 'khóa' : 'mở khóa'} thiết bị ${t.tableNumber}`);
          return { ...t, status: newStatus };
        }
        return t;
      }),
    );
  };

  // Simulate heartbeat and add tablet
  const handleSimulateDevice = async () => {
    setIsSimulatingHeartbeat(true);
    const newIndex = tablets.length + 1;
    const serial = `SM-X210-SIM-${Date.now().toString().slice(-4)}`;
    const tableNumber = `Bàn ${newIndex < 10 ? '0' + newIndex : newIndex}`;

    try {
      await fetch('http://localhost:4000/api/v1/mdm/agent/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-classroom-dpc-secret': 'school_mdm_classroom_dpc_enrollment_secret_2026',
        },
        body: JSON.stringify({
          externalDeviceId: `demo-tab-student-${Date.now().toString().slice(-4)}`,
          serialNumber: serial,
          manufacturer: 'Samsung',
          model: 'Galaxy Tab A9',
          androidVersion: '14',
          sdkVersion: 34,
          batteryLevel: 95,
          installedApps: [
            { packageName: 'vn.manabie.learner', name: 'Manabie Learner', versionName: '2.4.0', versionCode: 20400 },
          ],
        }),
      });

      const newTablet: StudentTablet = {
        id: `tab-${Date.now().toString().slice(-4)}`,
        tableNumber: tableNumber,
        studentName: `Máy tính bảng (${tableNumber})`,
        serial: serial,
        battery: 95,
        isCharging: true,
        status: 'ONLINE',
        activeApp: activeKioskApp !== 'Chưa kích hoạt' ? activeKioskApp : 'Manabie Learner',
      };
      setTablets((prev) => [...prev, newTablet]);
      showToast(`Thiết bị ${tableNumber} (${serial}) đã kết nối trực tuyến thành công.`);
    } catch {
      const newTablet: StudentTablet = {
        id: `tab-${Date.now().toString().slice(-4)}`,
        tableNumber: tableNumber,
        studentName: `Máy tính bảng (${tableNumber})`,
        serial: serial,
        battery: 95,
        isCharging: true,
        status: 'ONLINE',
        activeApp: activeKioskApp !== 'Chưa kích hoạt' ? activeKioskApp : 'Manabie Learner',
      };
      setTablets((prev) => [...prev, newTablet]);
      showToast(`Đã kết nối thử nghiệm thiết bị ${tableNumber}.`);
    } finally {
      setIsSimulatingHeartbeat(false);
    }
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    showToast(`Đã gửi thông báo đến cả lớp: "${broadcastMessage}"`);
    setBroadcastMessage('');
    setShowBroadcastModal(false);
  };

  const onlineCount = tablets.filter((t) => t.status === 'ONLINE').length;
  const lockedCount = tablets.filter((t) => t.status === 'LOCKED').length;

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
              <span className="text-[11px] text-slate-500">Sĩ số thiết bị</span>
              <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                {tablets.length} Máy tính bảng
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500">Đang hoạt động</span>
              <p className="text-xl font-bold text-emerald-700 tabular-nums mt-0.5">
                {onlineCount} Máy trực tuyến
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500">Đang khóa màn hình</span>
              <p className="text-xl font-bold text-rose-700 tabular-nums mt-0.5">
                {lockedCount} Máy
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

        {/* Live Grid of Student Tablets */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Danh Sách Máy Tính Bảng Theo Bàn Học
              </h3>
              <p className="text-xs text-slate-500">
                Theo dõi tình trạng kết nối, dung lượng pin và ứng dụng bài học của từng học sinh
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSimulateDevice}
                disabled={isSimulatingHeartbeat}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className={cn('w-3.5 h-3.5 text-indigo-600', isSimulatingHeartbeat && 'animate-spin')} />
                <span>{isSimulatingHeartbeat ? 'Đang gửi...' : 'Thử kết nối thêm 1 máy'}</span>
              </button>
            </div>
          </div>

          {tablets.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Tablet className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">
                  Chưa có máy tính bảng trong lớp {selectedClass}
                </h4>
                <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                  Thiết bị của học sinh sẽ tự động xuất hiện tại đây khi kết nối mạng phòng học hoặc mở ứng dụng quản lý lớp học.
                </p>
              </div>
              <button
                onClick={handleSimulateDevice}
                disabled={isSimulatingHeartbeat}
                className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-2 shadow-xs"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isSimulatingHeartbeat && 'animate-spin')} />
                <span>Mô phỏng kết nối 1 máy tính bảng</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tablets.map((tab) => {
                const isLocked = tab.status === 'LOCKED';
                return (
                  <div
                    key={tab.id}
                    className={cn(
                      'p-4 rounded-2xl border transition-all space-y-3 bg-white shadow-xs',
                      isLocked
                        ? 'border-rose-200 bg-rose-50/20'
                        : 'border-slate-200 hover:border-indigo-400',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-indigo-900 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/50">
                          {tab.tableNumber}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">{tab.studentName}</h4>
                        <p className="text-[11px] font-mono text-slate-400">{tab.serial}</p>
                      </div>

                      <button
                        onClick={() => handleToggleTablet(tab.id)}
                        title={isLocked ? 'Mở khóa máy này' : 'Khóa màn hình máy này'}
                        className={cn(
                          'p-2 rounded-xl transition',
                          isLocked
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800',
                        )}
                      >
                        {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-500">Ứng dụng:</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                          {tab.activeApp}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-500">Mức pin:</span>
                        <div className="flex items-center gap-1 font-semibold tabular-nums text-slate-800">
                          {tab.isCharging ? (
                            <BatteryCharging className="w-4 h-4 text-emerald-600" />
                          ) : tab.battery < 40 ? (
                            <BatteryWarning className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Battery className="w-4 h-4 text-emerald-600" />
                          )}
                          <span>{tab.battery}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-500">Trạng thái:</span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[11px] font-medium border',
                            isLocked
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          )}
                        >
                          {isLocked ? 'Đã khóa' : 'Đang học'}
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
