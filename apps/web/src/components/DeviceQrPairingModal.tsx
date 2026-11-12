import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  QrCode,
  Wifi,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Smartphone,
} from 'lucide-react';

interface QrPairingInfo {
  sessionId: string;
  lanIp: string;
  webPort: number;
  quickConnectUrl: string;
  adbPairingString: string;
  adbPairingCode: string;
}

interface ClaimedSession {
  sessionId: string;
  claimed: boolean;
  ipAddress?: string;
  macAddress?: string;
  model?: string;
  latencyMs?: number;
  message?: string;
}

interface DeviceQrPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceEnrolled: (device: {
    ipAddress?: string;
    macAddress?: string;
    name: string;
    classCode: string;
    model?: string;
  }) => Promise<void>;
  defaultClassCode?: string;
  existingCount?: number;
}

export function DeviceQrPairingModal({
  isOpen,
  onClose,
  onDeviceEnrolled,
  defaultClassCode = '6A1',
  existingCount = 0,
}: DeviceQrPairingModalProps): React.ReactElement | null {
  const [activeTab, setActiveTab] = useState<'QR_QUICK' | 'QR_ADB' | 'MANUAL'>('QR_QUICK');

  // QR Session state
  const [qrInfo, setQrInfo] = useState<QrPairingInfo | null>(null);
  const [quickQrDataUrl, setQuickQrDataUrl] = useState<string>('');
  const [adbQrDataUrl, setAdbQrDataUrl] = useState<string>('');
  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(true);

  // Claim & Poll state
  const [claimedData, setClaimedData] = useState<ClaimedSession | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Manual input state
  const [manualTarget, setManualTarget] = useState('00:08:22:64:6D:79');
  const [isProbingManual, setIsProbingManual] = useState(false);
  const [manualProbeResult, setManualProbeResult] = useState<{
    connected: boolean;
    ipAddress?: string;
    macAddress?: string;
    model?: string;
    latencyMs?: number;
    message?: string;
  } | null>(null);

  // Wireless Debugging code input state
  const [adbPairIp, setAdbPairIp] = useState('192.168.20.32');
  const [adbPairPort, setAdbPairPort] = useState('');
  const [adbPairCode, setAdbPairCode] = useState('');
  const [isPairingAdb, setIsPairingAdb] = useState(false);
  const [adbPairMessage, setAdbPairMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Enroll form state
  const [deviceName, setDeviceName] = useState(`Máy Bàn 0${existingCount + 1}`);
  const [classCode, setClassCode] = useState(defaultClassCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch QR session info from API
  const fetchQrInfo = async () => {
    setIsLoadingQr(true);
    setClaimedData(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/devices/qr-pairing-info');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || 'Không thể tạo phiên ghép nối QR');
      }

      const info: QrPairingInfo = json.data;
      setQrInfo(info);
      setAdbPairIp(info.lanIp);

      // Generate Quick Connect QR Code
      const quickUrl = await QRCode.toDataURL(info.quickConnectUrl, {
        width: 240,
        margin: 1,
        color: { dark: '#1e1b4b', light: '#ffffff' },
      });
      setQuickQrDataUrl(quickUrl);

      // Generate ADB Wireless Debugging QR Code
      const adbUrl = await QRCode.toDataURL(info.adbPairingString, {
        width: 240,
        margin: 1,
        color: { dark: '#1e1b4b', light: '#ffffff' },
      });
      setAdbQrDataUrl(adbUrl);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi nạp mã QR');
    } finally {
      setIsLoadingQr(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQrInfo();
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen]);

  // Poll for QR scan claiming
  useEffect(() => {
    if (!isOpen || !qrInfo?.sessionId || claimedData?.claimed) return;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/devices/qr-session-status?session=${qrInfo.sessionId}`);
        if (!res.ok) return;
        const json = await res.json();
        const sess: ClaimedSession = json.data;

        if (sess && sess.claimed) {
          setClaimedData(sess);
          if (sess.model) {
            setDeviceName(`${sess.model.replace(/\(.*?\)/g, '').trim()} (Bàn 0${existingCount + 1})`);
          }
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
      } catch {
        // Ignore transient poll error
      }
    }, 1200);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, qrInfo?.sessionId, claimedData?.claimed, existingCount]);

  // Handle manual probe
  const handleManualProbe = async () => {
    const clean = manualTarget.trim();
    if (!clean) return;
    setIsProbingManual(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/devices/probe-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: clean }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Không thể kiểm tra kết nối');
      setManualProbeResult(json.data);
      if (json.data.connected && json.data.model) {
        setDeviceName(`${json.data.model.replace(/\(.*?\)/g, '').trim()} (Bàn 0${existingCount + 1})`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi kiểm tra');
    } finally {
      setIsProbingManual(false);
    }
  };

  // Handle Wireless Debugging code pairing
  const handleAdbPair = async () => {
    if (!adbPairPort || !adbPairCode) {
      setAdbPairMessage({ type: 'error', text: 'Vui lòng nhập đầy đủ Cổng và Mã ghép nối 6 số' });
      return;
    }
    setIsPairingAdb(true);
    setAdbPairMessage(null);

    try {
      const res = await fetch('/api/v1/devices/adb-pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: adbPairIp.trim(),
          pairingPort: adbPairPort.trim(),
          pairingCode: adbPairCode.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.data?.success) {
        throw new Error(json.data?.message || 'Ghép nối không dây thất bại');
      }
      setAdbPairMessage({ type: 'success', text: json.data.message });
      setClaimedData({
        sessionId: qrInfo?.sessionId || 'adb-pair',
        claimed: true,
        ipAddress: adbPairIp.trim(),
        model: 'Teclast P30 (P30_ROW)',
        macAddress: '00:08:22:64:6D:79',
      });
    } catch (err: unknown) {
      setAdbPairMessage({ type: 'error', text: err instanceof Error ? err.message : 'Lỗi ghép nối' });
    } finally {
      setIsPairingAdb(false);
    }
  };

  // Submit enrollment
  const handleSubmitEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const ip = claimedData?.ipAddress || manualProbeResult?.ipAddress || (/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(manualTarget) ? manualTarget : undefined);
      const mac = claimedData?.macAddress || manualProbeResult?.macAddress || (!/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(manualTarget) ? manualTarget : undefined);
      const model = claimedData?.model || manualProbeResult?.model || 'Teclast P30 (P30_ROW)';

      await onDeviceEnrolled({
        ipAddress: ip,
        macAddress: mac,
        name: deviceName.trim(),
        classCode: classCode || '6A1',
        model,
      });

      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể lưu thiết bị');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                Ghép Nối &amp; Đăng Ký Máy Tính Bảng <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </h3>
              <p className="text-[11px] text-slate-500">
                Hỗ trợ quét mã QR bằng Camera máy tính bảng hoặc Gỡ lỗi Wi-Fi Android
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('QR_QUICK')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'QR_QUICK'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Quét Mã QR Nhanh (Khuyên dùng)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('QR_ADB')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'QR_ADB'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Gỡ Lỗi Wi-Fi Android</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MANUAL')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'MANUAL'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <span>Nhập MAC / IP</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: Quick QR Code Connect */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activeTab === 'QR_QUICK' && (
            <div className="space-y-4 text-center">
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col items-center justify-center space-y-3">
                {isLoadingQr ? (
                  <div className="w-48 h-48 flex flex-col items-center justify-center space-y-2 text-indigo-600">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <span className="text-xs">Đang khởi tạo mã QR...</span>
                  </div>
                ) : quickQrDataUrl ? (
                  <div className="relative group">
                    <div className="p-2.5 bg-white rounded-2xl shadow-md border border-slate-200">
                      <img
                        src={quickQrDataUrl}
                        alt="School MDM Quick Connect QR"
                        className="w-48 h-48 rounded-xl object-contain mx-auto"
                      />
                    </div>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-bold shadow-xs">
                      Wi-Fi Direct
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Chưa tải được mã QR</p>
                )}

                {/* Instructions */}
                <div className="max-w-sm text-center">
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    Mở <strong>Camera máy tính bảng</strong>, <strong>Google Lens</strong> hoặc trình duyệt quét mã QR trên để tự động nhận diện thiết bị.
                  </p>
                  {qrInfo?.quickConnectUrl && (
                    <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                      Link: {qrInfo.quickConnectUrl}
                    </p>
                  )}
                </div>

                {/* Detection Status Indicator */}
                {!claimedData?.claimed ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <span>Đang chờ máy tính bảng quét mã...</span>
                  </div>
                ) : (
                  <div className="w-full p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-left space-y-1 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Đã nhận diện máy tính bảng qua mã QR thành công!</span>
                    </div>
                    <div className="text-[11px] text-emerald-700 font-mono pl-5">
                      Model: <strong>{claimedData.model}</strong> • MAC:{' '}
                      <strong>{claimedData.macAddress}</strong> • IP:{' '}
                      <strong>{claimedData.ipAddress}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Android Wireless Debugging QR */}
          {activeTab === 'QR_ADB' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {adbQrDataUrl && (
                    <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200 shrink-0">
                      <img
                        src={adbQrDataUrl}
                        alt="Android Wireless Debugging QR"
                        className="w-32 h-32 rounded-lg object-contain"
                      />
                    </div>
                  )}
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-600" /> Hướng dẫn quét trên Android 11–14:
                    </h4>
                    <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600">
                      <li>Mở <strong>Cài đặt</strong> → <strong>Tùy chọn cho nhà phát triển</strong> trên máy.</li>
                      <li>Bật <strong>Gỡ lỗi qua Wi-Fi</strong> → Chọn <strong>Ghép nối thiết bị bằng mã QR</strong>.</li>
                      <li>Hướng camera máy tính bảng vào mã QR bên cạnh.</li>
                    </ol>
                  </div>
                </div>

                {/* Manual Pairing Code option */}
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    Hoặc chọn "Ghép nối bằng mã ghép nối" trên máy tính bảng:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={adbPairIp}
                      onChange={(e) => setAdbPairIp(e.target.value)}
                      placeholder="IP máy tính bảng"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-900 bg-white"
                    />
                    <input
                      type="text"
                      value={adbPairPort}
                      onChange={(e) => setAdbPairPort(e.target.value)}
                      placeholder="Cổng (ví dụ: 38421)"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-900 bg-white"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={adbPairCode}
                        onChange={(e) => setAdbPairCode(e.target.value)}
                        placeholder="Mã 6 số"
                        maxLength={6}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-900 bg-white text-center font-bold tracking-widest"
                      />
                      <button
                        type="button"
                        onClick={handleAdbPair}
                        disabled={isPairingAdb}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 transition shrink-0 disabled:opacity-50"
                      >
                        {isPairingAdb ? 'Ghép...' : 'Ghép nối'}
                      </button>
                    </div>
                  </div>
                  {adbPairMessage && (
                    <p
                      className={`text-[11px] mt-1.5 ${
                        adbPairMessage.type === 'success' ? 'text-emerald-700 font-bold' : 'text-rose-600'
                      }`}
                    >
                      {adbPairMessage.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Manual MAC / IP Input */}
          {activeTab === 'MANUAL' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Nhập Địa chỉ MAC Wi-Fi hoặc IP của máy tính bảng:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualTarget}
                  onChange={(e) => setManualTarget(e.target.value)}
                  placeholder="Ví dụ: 00:08:22:64:6D:79 hoặc 192.168.20.32"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 bg-white"
                />
                <button
                  type="button"
                  onClick={handleManualProbe}
                  disabled={isProbingManual}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 shrink-0 shadow-xs disabled:opacity-50"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  {isProbingManual ? 'Đang ping...' : 'Kiểm tra tín hiệu'}
                </button>
              </div>

              {manualProbeResult && manualProbeResult.connected && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Bắt được tín hiệu máy tính bảng ({manualProbeResult.latencyMs}ms)!</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-mono">
                    Model: <strong>{manualProbeResult.model}</strong> • IP: <strong>{manualProbeResult.ipAddress}</strong>
                    {manualProbeResult.macAddress && (
                      <span> • MAC: <strong>{manualProbeResult.macAddress}</strong></span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Step: Confirm Name and Class */}
          <form onSubmit={handleSubmitEnroll} className="space-y-3 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên định danh máy (Vị trí bàn học) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder={`Ví dụ: Máy Bàn 0${existingCount + 1}`}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phân công Lớp học / Kho máy
                </label>
                <select
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                >
                  <option value="6A1">Lớp 6A1</option>
                  <option value="6A2">Lớp 6A2</option>
                  <option value="7A1">Lớp 7A1</option>
                  <option value="8A1">Lớp 8A1</option>
                  <option value="KHO">Kho thiết bị dùng chung (Chưa phân lớp)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (!claimedData?.claimed && !manualProbeResult?.connected && activeTab !== 'MANUAL')}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSubmitting ? 'Đang kích hoạt...' : 'Lưu Thiết Bị & Kích Hoạt'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
