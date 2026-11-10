import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  CheckCircle2,
  Lock,
  Pin,
  Plus,
  RefreshCw,
  Search,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { AppDeviceIcon } from '../components/AppDeviceIcon';
import { HardwareControlBanner } from '../components/HardwareControlModal';

const PAGE_SIZE = 10;

export interface ApplicationItem {
  id: string;
  packageName: string;
  name: string;
  category: string;
  versionName: string;
  versionCode: number;
  isApproved: boolean;
  isMandatory: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  AI_ASSISTANT: 'Trợ lý AI',
  DESIGN_EDUCATION: 'Thiết kế & Sáng tạo',
  EDUCATION: 'Học tập & Học liệu',
  BROWSER: 'Trình duyệt & Tìm kiếm',
  TOOLS: 'Công cụ học tập',
  COMMUNICATION: 'Liên lạc & Họp',
  MEDIA: 'Đa phương tiện (Media)',
  GAMES_STORE: 'Trò chơi & Chợ App',
  SYSTEM: 'Hệ thống & Phần cứng',
};

export function ApplicationsManagementView(): React.ReactElement {
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [activeKioskApp, setActiveKioskApp] = useState<ApplicationItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add custom app modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPkg, setNewPkg] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('EDUCATION');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
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
      // Backend temporarily unavailable
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync live applications directly from connected Teclast P30 via MAC Wi-Fi / ADB
  const handleSyncFromTablet = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/applications/sync-tablet`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        const payload = json.data;
        if (payload?.apps && Array.isArray(payload.apps)) {
          setApps(payload.apps);
          setCurrentPage(1);
        }
        if (payload?.syncedFromHardware) {
          showToast(
            `Đã quét & đồng bộ trực tiếp ${payload.totalApps} ứng dụng đang có trên máy tính bảng (${payload.adbSerial})!`,
          );
        } else {
          showToast(
            `Đã tải danh mục ${payload?.totalApps ?? apps.length} ứng dụng chuẩn của máy Teclast P30.`,
          );
        }
      }
    } catch {
      showToast('Không thể kết nối máy chủ để đồng bộ danh mục ứng dụng');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle approval
  const handleToggleApproval = async (app: ApplicationItem) => {
    try {
      const res = await fetch(`${API_BASE_URL}/applications/${app.id}/toggle-approval`, {
        method: 'PATCH',
      });
      if (res.ok) {
        const json = await res.json();
        const updated = json.data as ApplicationItem;
        setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        showToast(
          updated.isApproved
            ? `Đã CHO PHÉP ứng dụng [${app.name}] sử dụng trong tiết học.`
            : `Đã KHÓA ứng dụng [${app.name}] trên tất cả máy tính bảng.`,
        );
      }
    } catch {
      showToast('Lỗi khi cập nhật quyền ứng dụng');
    }
  };

  // Set or unset Kiosk app
  const handleToggleKiosk = async (appId: string | null, appName?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/applications/kiosk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });
      if (res.ok) {
        const json = await res.json();
        setActiveKioskApp(json.data?.activeKioskApp ?? null);
        await loadData();
        if (appId && appName) {
          showToast(`Đã ghim ứng dụng [${appName}] thành công lên màn hình toàn bộ máy tính bảng.`);
        } else {
          showToast('Đã bỏ ghim ứng dụng. Học sinh có thể sử dụng các app được phê duyệt.');
        }
      }
    } catch {
      showToast('Lỗi khi chuyển đổi chế độ ghim ứng dụng');
    }
  };

  // Add custom app
  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPkg.trim()) return;

    setIsSubmittingAdd(true);
    try {
      const res = await fetch(`${API_BASE_URL}/applications/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName: newPkg.trim(),
          name: newName.trim() || newPkg.trim(),
          category: newCategory,
          description: newDesc.trim() || 'Ứng dụng cài đặt trên tablet',
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewPkg('');
        setNewName('');
        setNewDesc('');
        showToast('Đã thêm ứng dụng vào danh mục quản lý thành công!');
        await loadData();
      }
    } catch {
      showToast('Lỗi khi thêm ứng dụng');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.packageName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || app.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedApps = filteredApps.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const approvedCount = apps.filter((a) => a.isApproved).length;
  const blockedCount = apps.length - approvedCount;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-xs flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-bold tracking-tight">
              Danh mục Ứng dụng Tablet (Teclast P30 • Kiểm soát qua MAC Wi-Fi)
            </h3>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Danh sách lấy trực tiếp từ các ứng dụng đang có trên máy tính bảng Teclast P30. Hiển thị tối đa 10 dòng mỗi trang.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleSyncFromTablet}
            disabled={isLoading}
            title="Quét trực tiếp danh sách ứng dụng đang cài đặt trên máy tính bảng qua MAC Wi-Fi"
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Đồng bộ từ Tablet ({apps.length} App)</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Ứng dụng</span>
          </button>
        </div>
      </div>

      {/* Hardware MAC Wi-Fi & ADB Control Status Banner */}
      <HardwareControlBanner defaultIp="192.168.1.28" />

      {/* Kiosk Status Alert (if active) */}
      {activeKioskApp ? (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AppDeviceIcon
              packageName={activeKioskApp.packageName}
              name={activeKioskApp.name}
              size="lg"
            />
            <div>
              <p className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                ĐANG GHIM ỨNG DỤNG HỌC TẬP: <span className="underline">{activeKioskApp.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-200 text-indigo-800">
                  Chế độ tập trung (Kiosk)
                </span>
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">
                Tất cả máy tính bảng trong lớp đang mở trực tiếp ứng dụng này qua MAC Wi-Fi.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleToggleKiosk(null)}
            className="px-3.5 py-2 rounded-xl bg-white border border-indigo-300 hover:bg-indigo-100 text-indigo-900 text-xs font-semibold transition shrink-0 shadow-xs"
          >
            Bỏ ghim (Cho phép các app đã duyệt)
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-600 text-white">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">
                Chế độ Lớp học Đa ứng dụng (Multi-App Allowed)
              </p>
              <p className="text-xs text-emerald-800 mt-0.5">
                Học sinh được mở tự do các ứng dụng có trạng thái <strong className="text-emerald-900">Được phép sử dụng</strong>.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
            {approvedCount} App được phép
          </span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-xs font-medium text-slate-500">Tổng ứng dụng trên Tablet</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {apps.length} Ứng dụng
          </p>
          <p className="text-xs text-slate-400 mt-1">Đồng bộ từ máy Teclast P30</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-xs font-medium text-slate-500">Ứng dụng được phép mở</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {approvedCount} App
          </p>
          <p className="text-xs text-emerald-600 mt-1">Học sinh được phép dùng trong giờ</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-xs font-medium text-slate-500">Ứng dụng bị khóa trong lớp</p>
          <p className="text-2xl font-bold text-rose-600 mt-1 tabular-nums">
            {blockedCount} App
          </p>
          <p className="text-xs text-rose-500 mt-1">Ngăn chặn xao nhãng bài học</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm ứng dụng (ChatGPT, Canva, Chrome...)"
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          >
            <option value="ALL">Tất cả danh mục ({apps.length} App)</option>
            <option value="AI_ASSISTANT">Trợ lý AI (ChatGPT, Gemini, Assistant)</option>
            <option value="DESIGN_EDUCATION">Thiết kế &amp; Sáng tạo (Canva)</option>
            <option value="EDUCATION">Học tập &amp; Học liệu (Sheets, Drive, Keep, Books, Maps)</option>
            <option value="BROWSER">Trình duyệt &amp; Tìm kiếm (Chrome, Google)</option>
            <option value="TOOLS">Công cụ học tập (Máy tính, Tệp, Lịch, Đồng hồ, Ghi âm)</option>
            <option value="COMMUNICATION">Liên lạc &amp; Họp (Meet, Gmail, Danh bạ)</option>
            <option value="MEDIA">Đa phương tiện (YouTube, Photos, Máy ảnh, TV, FM)</option>
            <option value="GAMES_STORE">Trò chơi &amp; Chợ App (CH Play, Play Games, Kids Space)</option>
            <option value="SYSTEM">Hệ thống &amp; Phần cứng (Cài đặt, Teclast, Device Info)</option>
          </select>
        </div>
      </div>

      {/* Applications List Table (Max 10 rows per page) */}
      <div className="space-y-3">
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Tên Ứng dụng &amp; Mã gói</th>
                <th className="py-3 px-4 font-semibold">Phân loại</th>
                <th className="py-3 px-4 font-semibold">Phiên bản</th>
                <th className="py-3 px-4 font-semibold text-center">Cho phép trong Tiết học</th>
                <th className="py-3 px-4 font-semibold text-right">Chế độ Ghim (Kiosk)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedApps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Layers className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-800">
                      Không tìm thấy ứng dụng phù hợp
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedApps.map((app) => {
                  const isKiosk = activeKioskApp?.id === app.id;

                  return (
                    <tr
                      key={app.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isKiosk ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <AppDeviceIcon
                            packageName={app.packageName}
                            name={app.name}
                            size="sm"
                          />
                          <div>
                            <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                              {app.name}
                              {isKiosk && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                                  Đang Ghim
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400">
                              {app.packageName}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-4">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {CATEGORY_LABELS[app.category] || app.category}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600">
                        v{app.versionName}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleApproval(app)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
                            app.isApproved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                          }`}
                        >
                          {app.isApproved ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Được phép sử dụng
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" /> Bị khóa trong lớp
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        {isKiosk ? (
                          <button
                            onClick={() => handleToggleKiosk(null)}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition"
                          >
                            Bỏ ghim
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleKiosk(app.id, app.name)}
                            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-semibold transition inline-flex items-center gap-1"
                          >
                            <Pin className="w-3 h-3" /> Ghim App
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (Max 10 rows per page) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-1">
          <span>
            Hiển thị {filteredApps.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filteredApps.length)} trên tổng số{' '}
            <strong>{filteredApps.length}</strong> ứng dụng (Tối đa 10 dòng/trang)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Trang trước
            </button>
            <span className="px-2.5 font-semibold text-slate-900">
              Trang {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
            >
              Trang sau <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Custom Application Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" /> Thêm Ứng dụng Mới vào Danh mục
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddApp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã gói ứng dụng (Package Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newPkg}
                  onChange={(e) => setNewPkg(e.target.value)}
                  placeholder="Ví dụ: vn.school.quiz hoặc org.scratch.junior"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên hiển thị ứng dụng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Ứng dụng Làm bài thi Trực tuyến"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phân loại ứng dụng
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                >
                  <option value="EDUCATION">Học tập &amp; Giáo dục</option>
                  <option value="AI_ASSISTANT">Trợ lý AI</option>
                  <option value="DESIGN_EDUCATION">Thiết kế sáng tạo</option>
                  <option value="TOOLS">Công cụ học tập</option>
                  <option value="MEDIA">Đa phương tiện</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isSubmittingAdd ? 'Đang thêm...' : 'Thêm vào danh mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
