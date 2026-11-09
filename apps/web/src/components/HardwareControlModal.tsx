import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  Wifi,
  Lock,
  Unlock,
  RefreshCw,
  X,
  Smartphone,
  Terminal,
  Usb,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';

export interface AdbStatusData {
  adbConnected: boolean;
  unauthorizedPromptPending: boolean;
  adbSerial: string | null;
  batteryLevel: number | null;
  foregroundPackage: string | null;
  isScreenAwake: boolean | null;
  isClassroomLocked: boolean;
  activeKioskPackage: string | null;
  connectedCount: number;
}

export function HardwareControlBanner({
  defaultIp = '192.168.1.28',
  onStatusChange,
}: {
  defaultIp?: string;
  onStatusChange?: (status: AdbStatusData) => void;
}): React.ReactElement {
  const [status, setStatus] = useState<AdbStatusData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [ipAddress, setIpAddress] = useState(defaultIp);
  const [pairingPort, setPairingPort] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [connectPort, setConnectPort] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/devices/adb-status?ipAddress=${encodeURIComponent(ipAddress)}`,
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setStatus(json.data);
          onStatusChange?.(json.data);
        }
      }
    } catch {
      // Ignore transient errors
    }
  }, [ipAddress, onStatusChange]);

  useEffect(() => {
    void fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const handlePairAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE_URL}/devices/adb-pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: ipAddress.trim(),
          pairingPort: pairingPort.trim() || undefined,
          pairingCode: pairingCode.trim() || undefined,
          connectPort: connectPort.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setFeedback({
          success: Boolean(json.data.adbConnected || json.data.success),
          message: json.data.message,
          details: json.data.details,
        });
        await fetchStatus();
      }
    } catch {
      setFeedback({
        success: false,
        message: 'Không thể kết nối tới máy chủ điều khiển.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestLock = async (locked: boolean) => {
    await fetch(`${API_BASE_URL}/devices/classroom-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked }),
    });
    await fetchStatus();
  };

  const isConnected = Boolean(status?.adbConnected);

  return (
    <>
      {isConnected ? (
        <div className="p-3.5 rounded-2xl bg-emerald-950 text-white border border-emerald-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  ĐÃ CHIẾM QUYỀN ĐIỀU KHIỂN PHẦN CỨNG TABLET ({status?.adbSerial})
                </span>
                {status?.batteryLevel !== null && status?.batteryLevel !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-800 text-emerald-200">
                    Pin thực tế: {status.batteryLevel}%
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Mọi lệnh <strong>Khóa màn hình</strong>, <strong>Ghim Kiosk</strong> và <strong>Khóa ứng dụng (Làm xám icon trên máy)</strong> đang thực thi trực tiếp theo thời gian thực trên Teclast P30.
                {status?.foregroundPackage && (
                  <span className="ml-2 font-mono text-[11px] text-emerald-300">
                    [Đang mở trên máy: {status.foregroundPackage}]
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTestLock(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition flex items-center gap-1"
            >
              <Lock className="w-3.5 h-3.5" /> Test Tắt Màn Hình
            </button>
            <button
              onClick={() => handleTestLock(false)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1"
            >
              <Unlock className="w-3.5 h-3.5" /> Bật Màn Hình
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-amber-950">
                  Máy tính bảng ({defaultIp}) đã thông mạng Wi-Fi nhưng CHƯA CẤP QUYỀN ĐIỀU KHIỂN HỆ ĐIỀU HÀNH
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                  Lý do máy vẫn thao tác tự do
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed max-w-3xl">
                Hệ điều hành Android 14 mặc định chặn lệnh khóa máy từ bên ngoài nếu chưa ghép nối <strong>Gỡ lỗi qua Wi-Fi (Wireless Debugging)</strong>. Chỉ cần cấp quyền <strong>1 lần duy nhất (30 giây)</strong> để Quản trị viên &amp; Giáo viên khóa màn hình thật, làm xám icon ứng dụng cấm và ép ghim Kiosk trên máy Teclast P30.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-2 shrink-0"
          >
            <Terminal className="w-4 h-4" />
            <span>Cấp quyền Điều khiển Tablet ngay (1 lần)</span>
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Kích hoạt Quyền Điều khiển Phần cứng Teclast P30 (Android 14)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Thực hiện 1 lần duy nhất của Quản trị viên — Học sinh không cần chạm hay cài bất kỳ app nào
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3-Step Visual Guide */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Hướng dẫn 3 bước trên máy tính bảng Teclast P30 (Mất 30 giây):
              </p>
              <ol className="space-y-2 text-slate-700 list-decimal list-inside leading-relaxed">
                <li>
                  Tại màn hình <strong>Cài đặt &gt; Giới thiệu về máy tính bảng</strong> (như trong ảnh bạn vừa chụp), chạm liên tiếp <strong>7 lần</strong> vào dòng cuối cùng <strong>Số bản dựng (V1.01_20251114)</strong> cho đến khi hiện thông báo <em>&quot;Bạn đã là nhà phát triển&quot;</em>.
                </li>
                <li>
                  Quay lại 1 bước vào mục <strong>Hệ thống (System) &gt; Tùy chọn nhà phát triển (Developer options)</strong>, kéo xuống tìm và bật công tắc <strong>Gỡ lỗi qua Wi-Fi (Wireless debugging)</strong> -&gt; Bấm <em>Cho phép</em>.
                </li>
                <li>
                  Chạm trực tiếp vào chữ <strong>Gỡ lỗi qua Wi-Fi</strong> để mở chi tiết:
                  <ul className="pl-5 mt-1 space-y-1 list-disc text-slate-600">
                    <li>
                      Nhìn dòng <strong>Địa chỉ IP và cổng</strong> (ví dụ: <code>192.168.1.28:41823</code>) -&gt; Nhập 5 số sau dấu hai chấm vào ô <strong>Cổng kết nối (Connect Port)</strong> bên dưới.
                    </li>
                    <li>
                      Bấm vào dòng <strong>&quot;Ghép nối thiết bị bằng mã ghép nối&quot;</strong> -&gt; Một bảng nhỏ hiện ra gồm <strong>Mã ghép nối 6 số</strong> và <strong>Cổng ghép nối</strong> -&gt; Nhập vào 2 ô bên dưới rồi bấm <strong>Kết nối ngay</strong>!
                    </li>
                  </ul>
                </li>
              </ol>
            </div>

            <form onSubmit={handlePairAndConnect} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Địa chỉ IP Máy tính bảng
                  </label>
                  <input
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="192.168.1.28"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cổng kết nối (Connect Port) <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={connectPort}
                    onChange={(e) => setConnectPort(e.target.value)}
                    placeholder="VD: 41823 (hoặc 5555)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    5 chữ số sau dấu : ở mục &quot;Địa chỉ IP và cổng&quot; màn hình Gỡ lỗi Wi-Fi
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cổng ghép nối (Pairing Port - Bảng popup)
                  </label>
                  <input
                    type="text"
                    value={pairingPort}
                    onChange={(e) => setPairingPort(e.target.value)}
                    placeholder="VD: 39125 (trong popup mã ghép nối)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã ghép nối Wi-Fi (6 chữ số)
                  </label>
                  <input
                    type="text"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    placeholder="VD: 482910"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              {feedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    feedback.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <p className="font-bold">{feedback.message}</p>
                  {feedback.details && (
                    <p className="font-mono text-[11px] mt-1 opacity-80">{feedback.details}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handlePairAndConnect}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Usb className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Nếu đang cắm cáp USB: Bấm để tự động chuyển sang Wi-Fi</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang ghép nối...</span>
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3.5 h-3.5" />
                        <span>Ghép nối &amp; Chiếm quyền Điều khiển</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
