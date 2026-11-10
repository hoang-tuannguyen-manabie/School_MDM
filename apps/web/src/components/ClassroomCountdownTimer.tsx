import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Lock,
  Bell,
  Layers,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { AppDeviceIcon } from './AppDeviceIcon';

export interface ClassroomCountdownTimerProps {
  activeKioskApp: {
    id: string;
    packageName: string;
    name: string;
  } | null;
  onExpireLockClassroom?: () => void;
  onToast?: (msg: string) => void;
}

const PRESET_MINUTES = [1, 3, 5, 10, 15, 20];

export function ClassroomCountdownTimer({
  activeKioskApp,
  onExpireLockClassroom,
  onToast,
}: ClassroomCountdownTimerProps): React.ReactElement {
  const [activityTitle, setActivityTitle] = useState('Hoạt động làm bài trên Tablet');
  const [customMinutes, setCustomMinutes] = useState<number>(5);
  const [totalSeconds, setTotalSeconds] = useState<number>(5 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(5 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [autoLockOnExpire, setAutoLockOnExpire] = useState<boolean>(true);
  const [syncWithTabletClock, setSyncWithTabletClock] = useState<boolean>(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const notifyTabletTimer = async (
    action: 'START' | 'UPDATE' | 'EXPIRE' | 'CANCEL',
    secs: number,
    openClockAppOnTablet = false,
  ) => {
    if (!syncWithTabletClock && action !== 'EXPIRE') return;
    try {
      await fetch(`${API_BASE_URL}/devices/classroom-timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          title: activityTitle.trim() || 'Hoạt động trên lớp',
          remainingSeconds: secs,
          autoLockOnExpire: action === 'EXPIRE' ? autoLockOnExpire : false,
          openClockAppOnTablet,
        }),
      });
    } catch {
      // Ignore network errors
    }
  };

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setIsExpired(true);
          void notifyTabletTimer('EXPIRE', 0);
          if (autoLockOnExpire && onExpireLockClassroom) {
            onExpireLockClassroom();
          }
          onToast?.(
            autoLockOnExpire
              ? `⏰ Đã hết giờ "${activityTitle}"! Hệ thống đã tự động khóa màn hình máy tính bảng.`
              : `⏰ Đã hết giờ hoạt động "${activityTitle}"!`,
          );
          return 0;
        }

        const next = prev - 1;
        // Update live countdown banner on tablet every 10 seconds and at 60s / 15s / 5s
        if (next % 10 === 0 || next === 15 || next === 5) {
          void notifyTabletTimer('UPDATE', next);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, activityTitle, autoLockOnExpire, syncWithTabletClock]);

  const handleSelectPreset = (minutes: number) => {
    setIsRunning(false);
    setIsExpired(false);
    setCustomMinutes(minutes);
    setTotalSeconds(minutes * 60);
    setRemainingSeconds(minutes * 60);
  };

  const handleStartOrResume = () => {
    const startSecs = remainingSeconds > 0 ? remainingSeconds : customMinutes * 60;
    if (remainingSeconds <= 0) {
      setTotalSeconds(startSecs);
      setRemainingSeconds(startSecs);
    }
    setIsExpired(false);
    setIsRunning(true);
    void notifyTabletTimer('START', startSecs, true);
    onToast?.(
      `⏱️ Đã hiển thị Đồng hồ đếm ngược "${activityTitle}" (${formatTime(startSecs)}) trực tiếp trên màn hình Tablet!`,
    );
  };

  const handlePause = () => {
    setIsRunning(false);
    onToast?.('⏸️ Đã tạm dừng đồng hồ đếm ngược hoạt động.');
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsExpired(false);
    const resetSecs = Math.max(1, customMinutes) * 60;
    setTotalSeconds(resetSecs);
    setRemainingSeconds(resetSecs);
    void notifyTabletTimer('CANCEL', 0);
  };

  const handleAddOneMinute = () => {
    const next = remainingSeconds + 60;
    setRemainingSeconds(next);
    setTotalSeconds((prev) => Math.max(prev, next));
    setIsExpired(false);
    if (isRunning) {
      void notifyTabletTimer('UPDATE', next, false);
    }
    onToast?.('➕ Đã cộng thêm 1 phút cho hoạt động của học sinh.');
  };

  const handleOpenClockOnTablet = () => {
    const secs = remainingSeconds > 0 ? remainingSeconds : customMinutes * 60;
    void notifyTabletTimer('START', secs, true);
    onToast?.('⏰ Đã bật ứng dụng Đồng hồ hẹn giờ trực tiếp trên màn hình máy tính bảng.');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progressPercent =
    totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100)) : 0;

  return (
    <div
      className={`p-4 rounded-2xl border transition-all shadow-xs ${
        isExpired
          ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-500/20'
          : isRunning
            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20'
            : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Title & Parallel App Badge */}
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <AppDeviceIcon packageName="com.google.android.deskclock" name="Đồng hồ" size="sm" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Đồng hồ Đếm ngược Hoạt động (Chạy song song với Ứng dụng khác)
              </h4>
            </div>

            {/* Parallel Running Indicator */}
            {activeKioskApp ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                <Layers className="w-3 h-3 text-indigo-600" />
                Đang chạy song song cùng Kiosk: <strong>{activeKioskApp.name}</strong>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Chạy song song chế độ Đa ứng dụng
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Giáo viên đặt thời gian đếm ngược cho hoạt động nhóm / làm bài tập. Đồng hồ hoạt động <strong>song song</strong> mà không làm gián đoạn ứng dụng học sinh đang mở (như Canva, ChatGPT, Google Trang tính).
          </p>

          {/* Activity Name & Preset Minutes */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              value={activityTitle}
              onChange={(e) => setActivityTitle(e.target.value)}
              placeholder="Tên hoạt động (VD: Thảo luận nhóm trên Canva)"
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
            />

            <div className="flex flex-wrap items-center gap-1">
              {PRESET_MINUTES.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => handleSelectPreset(min)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                    customMinutes === min && !isRunning
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  {min} phút
                </button>
              ))}

              <div className="inline-flex items-center gap-1 ml-1">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customMinutes}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(180, Number(e.target.value) || 1));
                    handleSelectPreset(val);
                  }}
                  className="w-14 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-center text-slate-900 bg-white"
                  title="Nhập số phút tùy chỉnh"
                />
                <span className="text-[11px] text-slate-500 font-medium">phút</span>
              </div>
            </div>
          </div>

          {/* Options checkboxes */}
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-700">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoLockOnExpire}
                onChange={(e) => setAutoLockOnExpire(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Lock className="w-3.5 h-3.5 text-rose-600" />
              <span className="font-medium">Tự động khóa màn hình Tablet khi hết giờ</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncWithTabletClock}
                onChange={(e) => setSyncWithTabletClock(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-medium">Đồng bộ thông báo &amp; Đồng hồ ngầm trên Tablet</span>
            </label>
          </div>
        </div>

        {/* Right: Digital Countdown Display & Action Buttons */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 shrink-0 bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 min-w-[260px]">
          <div className="flex items-center justify-between w-full gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                {isExpired
                  ? '⏰ ĐÃ HẾT THỜI GIAN'
                  : isRunning
                    ? '🟢 ĐANG ĐẾM NGƯỢC SONG SONG'
                    : '⏱️ THỜI GIAN HOẠT ĐỘNG'}
              </span>
              <span className="text-xs text-slate-300 font-medium line-clamp-1 max-w-[140px]">
                {activityTitle}
              </span>
            </div>

            <div
              className={`text-3xl font-mono font-extrabold tabular-nums tracking-tight ${
                isExpired
                  ? 'text-rose-400 animate-pulse'
                  : remainingSeconds <= 60 && isRunning
                    ? 'text-amber-400 animate-pulse'
                    : 'text-emerald-400'
              }`}
            >
              {formatTime(remainingSeconds)}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isExpired ? 'bg-rose-500' : isRunning ? 'bg-emerald-400' : 'bg-indigo-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 w-full pt-0.5">
            {!isRunning ? (
              <button
                type="button"
                onClick={handleStartOrResume}
                className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{remainingSeconds < totalSeconds && remainingSeconds > 0 ? 'Tiếp tục' : 'Bắt đầu'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="flex-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Tạm dừng</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAddOneMinute}
              title="Cộng thêm 1 phút"
              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition inline-flex items-center gap-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>1p</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              title="Đặt lại đồng hồ"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleOpenClockOnTablet}
              title="Mở ứng dụng Đồng hồ trên máy tính bảng chạy song song"
              className="px-2.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-[11px] font-semibold transition inline-flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
