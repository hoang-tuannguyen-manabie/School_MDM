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
  Radio,
  Copy,
  Check,
  Tablet,
} from 'lucide-react';

interface QrPairingInfo {
  sessionId: string;
  lanIp: string;
  webPort: number;
  quickConnectUrl: string;
  adbPairingString: string;
  adbPairingCode: string;
}

interface AdbPairingCandidate {
  serviceName: string;
  serviceType: string;
  ipAddress: string;
  port: string;
  isPairingMode: boolean;
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
  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Claim & Poll state
  const [claimedData, setClaimedData] = useState<ClaimedSession | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Manual input state
  const [manualTarget, setManualTarget] = useState('');
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
  const [adbPairIp, setAdbPairIp] = useState('192.168.8.');
  const [adbPairPort, setAdbPairPort] = useState('');
  const [adbPairCode, setAdbPairCode] = useState('');
  const [isPairingAdb, setIsPairingAdb] = useState(false);
  const [adbPairMessage, setAdbPairMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [adbCandidates, setAdbCandidates] = useState<AdbPairingCandidate[]>([]);
  const [isScanningCandidates, setIsScanningCandidates] = useState(false);
  const adbCandidateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Enroll form state
  const [deviceName, setDeviceName] = useState(`Teclast P30 (Bàn 0${existingCount + 1})`);
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

      // Default the adb subnet based on server's LAN IP
      const lanSubnet = info.lanIp ? info.lanIp.split('.').slice(0, 3).join('.') + '.' : '192.168.8.';
      setAdbPairIp(lanSubnet);

      // Generate Quick Connect QR Code
      const quickUrl = await QRCode.toDataURL(info.quickConnectUrl, {
        width: 250,
        margin: 1,
        color: { dark: '#1e1b4b', light: '#ffffff' },
      });
      setQuickQrDataUrl(quickUrl);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi nạp mã QR');
    } finally {
      setIsLoadingQr(false);
    }
  };

  // Poll for mDNS candidates when in ADB tab
  const fetchAdbCandidates = async () => {
    setIsScanningCandidates(true);
    try {
      const res = await fetch('/api/v1/devices/adb-pairing-targets');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          setAdbCandidates(json.data);
          const pairingTarget = json.data.find((c: AdbPairingCandidate) => c.isPairingMode);
          if (pairingTarget) {
            setAdbPairIp(pairingTarget.ipAddress);
            setAdbPairPort(pairingTarget.port);
          } else if (!adbPairPort) {
            // Pick first candidate port if available
            const anyTarget = json.data[0];
            if (anyTarget && anyTarget.ipAddress) {
              setAdbPairIp(anyTarget.ipAddress);
            }
          }
        }
      }
    } catch {
      // Ignore transient scan error
    } finally {
      setIsScanningCandidates(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQrInfo();
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (adbCandidateTimerRef.current) clearInterval(adbCandidateTimerRef.current);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (adbCandidateTimerRef.current) clearInterval(adbCandidateTimerRef.current);
    };
  }, [isOpen]);

  // Polling for QR scan claiming
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

  // Polling for ADB pairing candidates
  useEffect(() => {
    if (!isOpen || activeTab !== 'QR_ADB') {
      if (adbCandidateTimerRef.current) clearInterval(adbCandidateTimerRef.current);
      return;
    }

    fetchAdbCandidates();
    adbCandidateTimerRef.current = setInterval(fetchAdbCandidates, 2500);

    return () => {
      if (adbCandidateTimerRef.current) clearInterval(adbCandidateTimerRef.current);
    };
  }, [isOpen, activeTab]);

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
      setAdbPairMessage({ type: 'error', text: 'Vui lòng nhập đầy đủ Cổng và Mã ghép nối 6 số từ tablet' });
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
      let resolvedMac: string | undefined;
      try {
        const probeRes = await fetch('/api/v1/devices/probe-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: adbPairIp.trim() }),
        });
        const probeJson = await probeRes.json();
        if (probeJson?.data?.macAddress) {
          resolvedMac = probeJson.data.macAddress;
        }
      } catch {
        // Ignore probe error
      }
      setClaimedData({
        sessionId: qrInfo?.sessionId || 'adb-pair',
        claimed: true,
        ipAddress: adbPairIp.trim(),
        model: 'Teclast P30 (P30_ROW)',
        macAddress: resolvedMac,
      });
    } catch (err: unknown) {
      setAdbPairMessage({ type: 'error', text: err instanceof Error ? err.message : 'Lỗi ghép nối' });
    } finally {
      setIsPairingAdb(false);
    }
  };

  // Handle direct connect for discovered tablet
  const handleDirectConnect = async (cand: AdbPairingCandidate) => {
    setIsPairingAdb(true);
    setAdbPairMessage(null);
    try {
      const res = await fetch('/api/v1/devices/adb-pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: cand.ipAddress,
          connectPort: cand.port,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.data?.success) {
        throw new Error(json.data?.message || 'Kết nối không dây thất bại');
      }
      setAdbPairMessage({ type: 'success', text: json.data.message });
      let resolvedMac: string | undefined;
      try {
        const probeRes = await fetch('/api/v1/devices/probe-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: cand.ipAddress }),
        });
        const probeJson = await probeRes.json();
        if (probeJson?.data?.macAddress) resolvedMac = probeJson.data.macAddress;
      } catch {
        // ignore
      }
      setClaimedData({
        sessionId: qrInfo?.sessionId || 'adb-pair',
        claimed: true,
        ipAddress: cand.ipAddress,
        model: 'Teclast P30 (P30_ROW)',
        macAddress: resolvedMac,
      });
    } catch (err: unknown) {
      setAdbPairMessage({ type: 'error', text: err instanceof Error ? err.message : 'Lỗi kết nối' });
    } finally {
      setIsPairingAdb(false);
    }
  };

  const handleCopyLink = () => {
    if (qrInfo?.quickConnectUrl) {
      navigator.clipboard.writeText(qrInfo.quickConnectUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
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
                <div className="max-w-sm text-center space-y-1.5">
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    Mở <strong>Camera máy tính bảng</strong>, <strong>Google Lens</strong> hoặc trình duyệt quét mã QR trên để tự động nhận diện thiết bị qua Wi-Fi.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={fetchQrInfo}
                      disabled={isLoadingQr}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition inline-flex items-center gap-1 shadow-2xs"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingQr ? 'animate-spin' : ''}`} />
                      <span>Làm mới mã QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition inline-flex items-center gap-1 shadow-2xs"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      <span>{copiedLink ? 'Đã sao chép' : 'Sao chép link'}</span>
                    </button>
                  </div>
                  {qrInfo?.quickConnectUrl && (
                    <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs mx-auto">
                      {qrInfo.quickConnectUrl}
                    </p>
                  )}
                </div>

                {/* Detection Status Indicator */}
                {!claimedData?.claimed ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <span>Đang chờ máy tính bảng quét mã...</span>
                  </div>
                ) : (
                  <div className="w-full p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-left space-y-1.5 animate-in zoom-in-95 duration-150">
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

          {/* Tab 2: Android Wireless Debugging (Gỡ lỗi qua Wi-Fi) */}
          {activeTab === 'QR_ADB' && (
            <div className="space-y-4">
              {/* Auto-detected pairing candidate banner */}
              {(() => {
                const activePairing = adbCandidates.find((c) => c.isPairingMode);
                if (activePairing) {
                  return (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between shadow-xs animate-in zoom-in-95 duration-150">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Radio className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <span className="font-bold text-emerald-950 text-xs">
                            Đã tự động phát hiện tablet đang chờ ghép nối!
                          </span>
                          <p className="text-[11px] text-emerald-700 mt-0.5 font-mono">
                            IP: <strong>{activePairing.ipAddress}</strong> • Cổng ghép nối:{' '}
                            <strong>{activePairing.port}</strong>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAdbPairIp(activePairing.ipAddress);
                          setAdbPairPort(activePairing.port);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-2xs"
                      >
                        Tự động điền
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs text-slate-700 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    <span>Hướng dẫn ghép nối qua Wi-Fi Android 11–14 (Teclast P30):</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                      <span className="font-bold text-indigo-700">Bước 1 &amp; 2:</span>
                      <p>Mở <strong>Cài đặt</strong> → <strong>Tùy chọn cho nhà phát triển</strong> → Bật công tắc <strong>Gỡ lỗi qua Wi-Fi</strong>.</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                      <span className="font-bold text-indigo-700">Bước 3 &amp; 4:</span>
                      <p>Nhấn vào dòng <strong>"Ghép nối thiết bị bằng mã ghép nối"</strong>. Xem Mã 6 số và Cổng trên tablet rồi nhập vào bên dưới.</p>
                    </div>
                  </div>
                </div>

                {/* Manual Pairing Code option */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800">
                      Nhập thông tin hiển thị trên máy tính bảng:
                    </span>
                    {isScanningCandidates && (
                      <span className="text-[10px] text-indigo-600 inline-flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Đang quét Wi-Fi...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold mb-0.5 block">IP máy tính bảng</label>
                      <input
                        type="text"
                        value={adbPairIp}
                        onChange={(e) => setAdbPairIp(e.target.value)}
                        placeholder="Ví dụ: 192.168.8.82"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold mb-0.5 block">Cổng ghép nối (Port)</label>
                      <input
                        type="text"
                        value={adbPairPort}
                        onChange={(e) => setAdbPairPort(e.target.value)}
                        placeholder="Ví dụ: 43187"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold mb-0.5 block">Mã ghép nối (6 số)</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={adbPairCode}
                          onChange={(e) => setAdbPairCode(e.target.value)}
                          placeholder="6 số"
                          maxLength={6}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-900 bg-white text-center font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                        />
                        <button
                          type="button"
                          onClick={handleAdbPair}
                          disabled={isPairingAdb}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 transition shrink-0 disabled:opacity-50 shadow-xs"
                        >
                          {isPairingAdb ? 'Đang ghép...' : 'Ghép nối'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {adbPairMessage && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-1.5 ${
                        adbPairMessage.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {adbPairMessage.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      )}
                      <span>{adbPairMessage.text}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Discovered Wireless Tablets on LAN (already paired or active) */}
              {(() => {
                const availableTablets = adbCandidates.filter((c) => !c.isPairingMode);
                if (availableTablets.length > 0) {
                  return (
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Tablet className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Máy tính bảng đã phát hiện trên mạng Wi-Fi ({availableTablets.length} máy):</span>
                        </span>
                        <button
                          type="button"
                          onClick={fetchAdbCandidates}
                          className="text-[11px] text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 font-semibold"
                        >
                          <RefreshCw className={`w-3 h-3 ${isScanningCandidates ? 'animate-spin' : ''}`} />
                          <span>Quét lại</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                        {availableTablets.map((cand, idx) => (
                          <div
                            key={`${cand.ipAddress}-${cand.port}-${idx}`}
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 flex items-center justify-between text-xs transition"
                          >
                            <div className="font-mono text-[11px]">
                              <span className="font-bold text-slate-900">{cand.ipAddress}</span>
                              <span className="text-slate-500 text-[10px] ml-1">:{cand.port}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDirectConnect(cand)}
                              disabled={isPairingAdb}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold transition"
                            >
                              Kết nối
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
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
                  placeholder="Ví dụ: 00:08:22:FC:BC:7D hoặc 192.168.20.19"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 bg-white"
                />
                <button
                  type="button"
                  onClick={handleManualProbe}
                  disabled={isProbingManual}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 shrink-0 shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProbingManual ? 'animate-spin' : ''}`} />
                  {isProbingManual ? 'Đang Reconnect...' : 'Reconnect & Test kết nối'}
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
