import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Tablet,
  Wifi,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface ClaimResult {
  sessionId: string;
  claimed: boolean;
  ipAddress?: string;
  macAddress?: string;
  model?: string;
  latencyMs?: number;
  message?: string;
}

export function QuickConnectView(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session') || '';

  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'SUCCESS' | 'ERROR'>('CONNECTING');
  const [claimData, setClaimData] = useState<ClaimResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const performClaim = async () => {
    if (!sessionId) {
      setStatus('ERROR');
      setErrorMessage('Thiếu mã phiên ghép nối QR. Vui lòng quét lại mã QR trên màn hình giáo viên.');
      return;
    }

    setStatus('CONNECTING');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/devices/qr-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: sessionId }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || 'Không thể ghép nối thiết bị');
      }

      setClaimData(json.data?.session || json.data);
      setStatus('SUCCESS');
    } catch (err: unknown) {
      setStatus('ERROR');
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    }
  };

  useEffect(() => {
    performClaim();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col items-center justify-center p-6 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 shadow-2xl space-y-6 text-center">
        {/* School MDM Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center border border-indigo-400/30">
            <Tablet className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
              School MDM <Sparkles className="w-4 h-4 text-amber-400" />
            </h1>
            <p className="text-xs text-indigo-200 mt-0.5">
              Cổng Ghép Nối Máy Tính Bảng Trực Tiếp Qua Wi-Fi
            </p>
          </div>
        </div>

        {/* Status Display */}
        {status === 'CONNECTING' && (
          <div className="py-8 space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full border-4 border-indigo-400 border-t-transparent animate-spin flex items-center justify-center">
                <Wifi className="w-6 h-6 text-indigo-300" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Đang ghép nối máy tính bảng...</h2>
              <p className="text-xs text-indigo-200 mt-1">
                Hệ thống đang tự động nhận diện Địa chỉ MAC Wi-Fi &amp; kiểm tra quyền điều khiển.
              </p>
            </div>
          </div>
        )}

        {status === 'SUCCESS' && claimData && (
          <div className="py-4 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Ghép Nối Thành Công!</h2>
              <p className="text-xs text-emerald-300 mt-1">
                Máy tính bảng này đã sẵn sàng cho buổi học và chịu sự điều khiển của giáo viên.
              </p>
            </div>

            {/* Device Info Card */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/10">
                <span className="text-slate-400">Model thiết bị:</span>
                <span className="font-semibold text-white">{claimData.model || 'Teclast P30'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/10">
                <span className="text-slate-400">Địa chỉ MAC Wi-Fi:</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {claimData.macAddress || '00:08:22:64:6D:79'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/10">
                <span className="text-slate-400">Địa chỉ IP mạng:</span>
                <span className="font-mono text-indigo-200 font-semibold">{claimData.ipAddress}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Độ trễ tín hiệu:</span>
                <span className="text-emerald-400 font-semibold">{claimData.latencyMs ?? 2} ms</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-900/30 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Màn hình điều khiển giáo viên đã nhận diện thiết bị này.</span>
            </div>
          </div>
        )}

        {status === 'ERROR' && (
          <div className="py-4 space-y-4 animate-in fade-in duration-150">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-base font-bold text-white">Chưa thể ghép nối</h2>
              <p className="text-xs text-rose-300 mt-1">{errorMessage}</p>
            </div>

            <button
              onClick={performClaim}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Thử kết nối lại</span>
            </button>
          </div>
        )}

        <div className="text-[11px] text-slate-400 pt-2 border-t border-white/10">
          Phiên kết nối: <code className="font-mono text-indigo-300">{sessionId || 'N/A'}</code>
        </div>
      </div>
    </div>
  );
}
