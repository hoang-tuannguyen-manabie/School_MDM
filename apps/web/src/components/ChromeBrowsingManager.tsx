import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  ShieldCheck,
  Plus,
  X,
  ExternalLink,
  Lock,
  Unlock,
  RefreshCw,
  Send,
  Square,
  Sparkles,
  Layers,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';

export interface ChromeRestrictionsData {
  enabled: boolean;
  blockNewTabs: boolean;
  allowedUrls: string[];
  activeLessonUrl: string | null;
  kioskMode: boolean;
}

const PRESET_LESSON_SITES = [
  { name: 'Quizizz', url: 'https://quizizz.com/join', domain: 'quizizz.com', desc: 'Làm bài trắc nghiệm' },
  { name: 'Google Forms', url: 'https://forms.google.com', domain: 'forms.google.com', desc: 'Bài kiểm tra Form' },
  { name: 'Kahoot', url: 'https://kahoot.it', domain: 'kahoot.it', desc: 'Đấu trường kiến thức' },
  { name: 'Canva Web', url: 'https://www.canva.com', domain: 'canva.com', desc: 'Thiết kế bài thuyết trình' },
  { name: 'Manabie', url: 'https://hoc.manabie.com', domain: 'manabie.com', desc: 'Học tập tương tác' },
  { name: 'Khan Academy', url: 'https://vi.khanacademy.org', domain: 'khanacademy.org', desc: 'Toán & Khoa học' },
];

export function ChromeBrowsingManager({
  onToast,
}: {
  onToast?: (message: string) => void;
}): React.ReactElement {
  const [data, setData] = useState<ChromeRestrictionsData>({
    enabled: false,
    blockNewTabs: true,
    allowedUrls: ['quizizz.com', 'kahoot.it', 'forms.google.com', 'canva.com', 'manabie.com', 'khanacademy.org'],
    activeLessonUrl: null,
    kioskMode: false,
  });

  const [inputUrl, setInputUrl] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [kioskLock, setKioskLock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRestrictions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/chrome-restrictions`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setData(json.data);
        }
      }
    } catch {
      // Ignore network errors
    }
  }, []);

  useEffect(() => {
    void fetchRestrictions();
    const interval = setInterval(fetchRestrictions, 4000);
    return () => clearInterval(interval);
  }, [fetchRestrictions]);

  const handleToggleRestrictions = async () => {
    setIsSubmitting(true);
    const nextEnabled = !data.enabled;
    try {
      const res = await fetch(`${API_BASE_URL}/devices/chrome-restrictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: nextEnabled,
          blockNewTabs: true,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setData(json.data);
        onToast?.(
          nextEnabled
            ? '🔒 Đã kích hoạt Chế độ Duyệt Web An toàn: Chặn mở Tab mới & Chặn tìm kiếm tự do trên Chrome của học sinh!'
            : '🔓 Đã mở lại quyền duyệt web thông thường cho học sinh.',
        );
      }
    } catch {
      onToast?.('❌ Lỗi kết nối khi cập nhật cài đặt Chrome.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchLessonUrl = async (targetUrl?: string) => {
    const urlToOpen = (targetUrl || inputUrl).trim();
    if (!urlToOpen) {
      onToast?.('⚠️ Vui lòng nhập đường link bài học hoặc chọn một trang web nhanh.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/devices/chrome-launch-lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlToOpen,
          kioskMode: kioskLock,
          title: 'Bài tập Web trên lớp',
        }),
      });
      if (res.ok) {
        await fetchRestrictions();
        onToast?.(
          `🚀 Đã mở bài tập "${urlToOpen}" trực tiếp trên màn hình máy tính bảng (Chế độ ${
            kioskLock ? 'Khóa Kiosk Đơn Trang' : 'Duyệt Web Giới Hạn'
          })!`,
        );
      }
    } catch {
      onToast?.('❌ Không thể gửi đường link bài học đến máy tính bảng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseLesson = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/devices/chrome-close-lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        await fetchRestrictions();
        onToast?.('⏹️ Đã kết thúc phiên bài học web trên máy tính bảng.');
      }
    } catch {
      onToast?.('❌ Lỗi khi đóng bài học web.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newDomain.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    if (!clean) return;
    if (data.allowedUrls.includes(clean)) {
      onToast?.(`ℹ️ Tên miền "${clean}" đã có trong danh sách cho phép.`);
      setNewDomain('');
      return;
    }

    const updated = [...data.allowedUrls, clean];
    try {
      const res = await fetch(`${API_BASE_URL}/devices/chrome-restrictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedUrls: updated }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setData(json.data);
        setNewDomain('');
        onToast?.(`✅ Đã thêm tên miền "${clean}" vào danh sách web được phép.`);
      }
    } catch {
      onToast?.('❌ Lỗi khi thêm tên miền.');
    }
  };

  const handleRemoveDomain = async (domainToRemove: string) => {
    const updated = data.allowedUrls.filter((d) => d !== domainToRemove);
    try {
      const res = await fetch(`${API_BASE_URL}/devices/chrome-restrictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedUrls: updated }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setData(json.data);
        onToast?.(`🗑️ Đã xóa tên miền "${domainToRemove}".`);
      }
    } catch {
      onToast?.('❌ Lỗi khi xóa tên miền.');
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-white border-2 border-indigo-100 shadow-xs space-y-5">
      {/* Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Quản lý &amp; Khóa Duyệt Web Google Chrome
              </h3>
              {data.enabled ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  Đang Khóa Mở Tab &amp; Tìm Kiếm Tự Do
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  Duyệt web tự do
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Hạn chế học viên mở thêm tab mới, chặn tìm kiếm tự do ngoài bài học và điều hướng bài tập trực tiếp đến máy tính bảng.
            </p>
          </div>
        </div>

        {/* Master Toggle Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleRestrictions}
            disabled={isSubmitting}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs ${
              data.enabled
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {data.enabled ? (
              <>
                <Unlock className="w-4 h-4" />
                <span>Mở Khóa Duyệt Web</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Khóa Tab Mới &amp; Tìm Kiếm</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Lesson Banner (if active) */}
      {data.activeLessonUrl && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <span className="font-bold text-indigo-950 uppercase tracking-wider text-[10px] block">
                ĐANG GIAO BÀI TẬP TRỰC TUYẾN TRÊN TABLET:
              </span>
              <a
                href={data.activeLessonUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-bold text-indigo-700 hover:underline flex items-center gap-1 line-clamp-1"
              >
                <span>{data.activeLessonUrl}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseLesson}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition flex items-center gap-1.5 shrink-0"
          >
            <Square className="w-3.5 h-3.5 text-rose-400" />
            <span>Kết thúc bài tập Web</span>
          </button>
        </div>
      )}

      {/* Section 1: Send Lesson URL directly to tablets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-indigo-600" />
            <span>Mở Bài Tập Trực Tuyến Đến Máy Tính Bảng</span>
          </h4>
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-700 select-none">
            <input
              type="checkbox"
              checked={kioskLock}
              onChange={(e) => setKioskLock(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium">Khóa Kiosk cố định (Không cho học sinh thoát sang app khác)</span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Dán đường link bài tập (VD: https://quizizz.com/join hoặc link Google Form bài tập)"
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-mono"
          />

          <button
            type="button"
            onClick={() => handleLaunchLessonUrl()}
            disabled={isSubmitting || !inputUrl.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs shrink-0"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Mở Ngay Trên Tablet</span>
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Phím tắt bài học:
          </span>
          {PRESET_LESSON_SITES.map((site) => (
            <button
              key={site.name}
              type="button"
              onClick={() => {
                setInputUrl(site.url);
                void handleLaunchLessonUrl(site.url);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-700 transition"
              title={`${site.desc} (${site.url})`}
            >
              {site.name}
            </button>
          ))}
        </div>
      </div>

      {/* Section 2: Manage Allowed Domains (URL Allowlist) */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Danh Sách Trang Web Được Phép (URL Allowlist)</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Học sinh chỉ được phép truy cập các tên miền này. Mọi trang web khác ngoài danh sách hoặc tìm kiếm Google sẽ tự động bị chặn.
            </p>
          </div>

          <form onSubmit={handleAddDomain} className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="VD: scratch.mit.edu"
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white font-mono w-40 sm:w-48 focus:outline-none focus:border-indigo-600"
            />
            <button
              type="submit"
              disabled={!newDomain.trim()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm</span>
            </button>
          </form>
        </div>

        {/* Domain Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {data.allowedUrls.map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200"
            >
              <span>{domain}</span>
              <button
                type="button"
                onClick={() => handleRemoveDomain(domain)}
                title={`Xóa ${domain}`}
                className="text-slate-400 hover:text-rose-600 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}

          {data.allowedUrls.length === 0 && (
            <span className="text-xs text-slate-400 italic">
              Chưa có tên miền nào trong danh sách trắng.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
