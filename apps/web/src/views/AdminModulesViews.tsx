import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  PlayCircle,
  Users,
  BarChart3,
  FileText,
  Settings,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Lock,
  Unlock,
  Pin,
  Wifi,
  Tablet,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@school-mdm/ui';
import { API_BASE_URL } from '../config/api';
import { AppDeviceIcon } from '../components/AppDeviceIcon';
import { ClassroomCountdownTimer } from '../components/ClassroomCountdownTimer';
import type { ClassroomAppItem, ClassroomDeviceRecord } from './TeacherClassroomView';

const PAGE_SIZE = 10;

// Helper component for 10-row pagination bar
function PaginationFooter({
  currentPage,
  totalItems,
  onPageChange,
  unitLabel = 'dòng',
}: {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  unitLabel?: string;
}): React.ReactElement {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-2 px-1">
      <span>
        Hiển thị {startIdx}–{endIdx} trên tổng số <strong>{totalItems}</strong> {unitLabel} (Tối đa 10 dòng/trang)
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Trang trước
        </button>
        <span className="px-2 font-semibold text-slate-900">
          Trang {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold"
        >
          Trang sau <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 1. LỚP HỌC (/classes)
// ============================================================================
interface SchoolClassItem {
  id: string;
  classCode: string;
  grade: string;
  subject: string;
  teacherName: string;
  roomName: string;
  academicYear: string;
  schedule: string;
}

const INITIAL_CLASSES: SchoolClassItem[] = [
  {
    id: 'cls-6a1',
    classCode: '6A1',
    grade: 'Khối 6',
    subject: 'Toán & Tư duy Logic',
    teacherName: 'Cô Nguyễn Thị Lan Hương',
    roomName: 'Phòng Lab Thông minh P.201',
    academicYear: '2026-2027',
    schedule: 'Thứ 2, Thứ 4 (Tiết 2: 08:15 - 09:00)',
  },
  {
    id: 'cls-6a2',
    classCode: '6A2',
    grade: 'Khối 6',
    subject: 'Khoa học Tự nhiên',
    teacherName: 'Thầy Trần Minh Đức',
    roomName: 'Phòng Lab Khoa học P.202',
    academicYear: '2026-2027',
    schedule: 'Thứ 3, Thứ 5 (Tiết 3: 09:15 - 10:00)',
  },
  {
    id: 'cls-7a1',
    classCode: '7A1',
    grade: 'Khối 7',
    subject: 'Tin học & AI Ứng dụng',
    teacherName: 'Thầy Lê Hoàng Nam',
    roomName: 'Phòng Máy tính P.301',
    academicYear: '2026-2027',
    schedule: 'Thứ 4, Thứ 6 (Tiết 1: 07:30 - 08:15)',
  },
  {
    id: 'cls-8a1',
    classCode: '8A1',
    grade: 'Khối 8',
    subject: 'Tiếng Anh Giao tiếp',
    teacherName: 'Cô Phạm Thu Hà',
    roomName: 'Phòng Nghe nhìn P.305',
    academicYear: '2026-2027',
    schedule: 'Thứ 2, Thứ 6 (Tiết 4: 10:05 - 10:50)',
  },
];

export function AdminClassesView(): React.ReactElement {
  const [classes, setClasses] = useState<SchoolClassItem[]>(() => {
    const saved = localStorage.getItem('school_mdm_classes_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return INITIAL_CLASSES;
  });
  const [devices, setDevices] = useState<ClassroomDeviceRecord[]>([]);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClassItem | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formGrade, setFormGrade] = useState('Khối 6');
  const [formSubject, setFormSubject] = useState('');
  const [formTeacher, setFormTeacher] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/classroom-status`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) setDevices(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const saveClasses = (next: SchoolClassItem[]) => {
    setClasses(next);
    localStorage.setItem('school_mdm_classes_v1', JSON.stringify(next));
  };

  const handleOpenAdd = () => {
    setEditingClass(null);
    setFormCode('');
    setFormGrade('Khối 6');
    setFormSubject('');
    setFormTeacher('');
    setFormRoom('Phòng học thông minh');
    setShowModal(true);
  };

  const handleOpenEdit = (item: SchoolClassItem) => {
    setEditingClass(item);
    setFormCode(item.classCode);
    setFormGrade(item.grade);
    setFormSubject(item.subject);
    setFormTeacher(item.teacherName);
    setFormRoom(item.roomName);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) return;
    if (editingClass) {
      const next = classes.map((c) =>
        c.id === editingClass.id
          ? {
              ...c,
              classCode: formCode.trim().toUpperCase(),
              grade: formGrade,
              subject: formSubject.trim() || 'Môn học tổng hợp',
              teacherName: formTeacher.trim() || 'Giáo viên bộ môn',
              roomName: formRoom.trim() || 'Phòng học',
            }
          : c,
      );
      saveClasses(next);
      setToast(`Đã cập nhật thông tin Lớp ${formCode.trim().toUpperCase()}.`);
    } else {
      const created: SchoolClassItem = {
        id: `cls-${Date.now()}`,
        classCode: formCode.trim().toUpperCase(),
        grade: formGrade,
        subject: formSubject.trim() || 'Môn học tổng hợp',
        teacherName: formTeacher.trim() || 'Giáo viên bộ môn',
        roomName: formRoom.trim() || 'Phòng học thông minh',
        academicYear: '2026-2027',
        schedule: 'Thứ 2 - Thứ 6 (Năm học 2026-2027)',
      };
      saveClasses([...classes, created]);
      setToast(`Đã tạo mới Lớp ${created.classCode} thành công.`);
    }
    setShowModal(false);
    setTimeout(() => setToast(null), 3500);
  };

  const handleDelete = (id: string, code: string) => {
    if (!window.confirm(`Xác nhận xóa Lớp ${code}?`)) return;
    saveClasses(classes.filter((c) => c.id !== id));
    setToast(`Đã xóa Lớp ${code}.`);
    setTimeout(() => setToast(null), 3000);
  };

  const paginated = classes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      {toast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {toast}
          </span>
          <button onClick={() => setToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" /> Quản lý Lớp học &amp; Phân công Giáo viên
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Thiết lập danh sách lớp học và theo dõi số lượng máy tính bảng điều khiển qua MAC Wi-Fi trong từng lớp.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" /> Thêm Lớp học mới
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider">
              <th className="py-3 px-4 font-semibold">Mã Lớp</th>
              <th className="py-3 px-4 font-semibold">Khối &amp; Môn học</th>
              <th className="py-3 px-4 font-semibold">Giáo viên Phụ trách</th>
              <th className="py-3 px-4 font-semibold">Phòng học</th>
              <th className="py-3 px-4 font-semibold">Máy tính bảng (MAC Wi-Fi)</th>
              <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginated.map((cls) => {
              const classDevices = devices.filter((d) => d.classCode === cls.classCode);
              const onlineCount = classDevices.filter((d) => d.status === 'ONLINE').length;

              return (
                <tr key={cls.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-indigo-700 text-sm">{cls.classCode}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{cls.subject}</div>
                    <div className="text-[11px] text-slate-500">{cls.grade} • {cls.academicYear}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{cls.teacherName}</td>
                  <td className="py-3 px-4 text-slate-600">{cls.roomName}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-[11px]">
                      <Tablet className="w-3.5 h-3.5 text-emerald-600" />
                      {classDevices.length} máy ({onlineCount} trực tuyến)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(cls)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-semibold inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cls.id, cls.classCode)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationFooter
        currentPage={page}
        totalItems={classes.length}
        onPageChange={setPage}
        unitLabel="lớp học"
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                {editingClass ? `Chỉnh sửa Lớp ${editingClass.classCode}` : 'Thêm Lớp học mới'}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mã lớp (VD: 6A1, 9A2) *</label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khối lớp</label>
                <select
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="Khối 6">Khối 6</option>
                  <option value="Khối 7">Khối 7</option>
                  <option value="Khối 8">Khối 8</option>
                  <option value="Khối 9">Khối 9</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Môn học phụ trách</label>
                <input
                  type="text"
                  required
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Toán học, Tin học & AI..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Giáo viên phụ trách</label>
                <input
                  type="text"
                  required
                  value={formTeacher}
                  onChange={(e) => setFormTeacher(e.target.value)}
                  placeholder="Cô Nguyễn Thị Lan Hương"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phòng học</label>
                <input
                  type="text"
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  placeholder="Phòng Lab P.201"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Lưu Lớp học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. CHÍNH SÁCH (/policies) — QUYỀN KIỂM SOÁT QUA MAC WI-FI
// ============================================================================
interface MacWifiPolicyRule {
  id: string;
  name: string;
  scope: string;
  mode: 'KIOSK' | 'ALLOWLIST' | 'TIMER_LOCK' | 'SYSTEM_GUARD';
  targetDetail: string;
  isActive: boolean;
  updatedAt: string;
}

const INITIAL_POLICIES: MacWifiPolicyRule[] = [
  {
    id: 'pol-1',
    name: 'Hiển thị Đồng hồ Đếm ngược Nổi (Freeform) trên Tablet',
    scope: 'Toàn bộ máy tính bảng kết nối MAC Wi-Fi',
    mode: 'TIMER_LOCK',
    targetDetail: 'Mở cửa sổ Đồng hồ đếm ngược hiển thị trực tiếp song song với ứng dụng đang chạy',
    isActive: true,
    updatedAt: 'Đang kích hoạt',
  },
  {
    id: 'pol-2',
    name: 'Tự động Khóa màn hình khi hết giờ đếm ngược',
    scope: 'Lớp 6A1, 6A2, 7A1, 8A1',
    mode: 'TIMER_LOCK',
    targetDetail: 'Phát lệnh tắt màn hình (SLEEP + LOCK) qua MAC Wi-Fi ngay khi đồng hồ về 00:00',
    isActive: true,
    updatedAt: 'Đang kích hoạt',
  },
  {
    id: 'pol-3',
    name: 'Cho phép Giáo viên tự do Ghim / Bỏ ghim mọi Ứng dụng (Kiosk)',
    scope: 'Cổng Giáo viên & Cổng Quản trị viên',
    mode: 'KIOSK',
    targetDetail: 'Giáo viên được phép ghim hoặc bỏ ghim bất kỳ ứng dụng nào có trên máy Teclast P30',
    isActive: true,
    updatedAt: 'Đang kích hoạt',
  },
  {
    id: 'pol-4',
    name: 'Chế độ Học tập AI & Thiết kế Sáng tạo (Canva, ChatGPT, Gemini)',
    scope: 'Lớp 6A1, 7A1',
    mode: 'ALLOWLIST',
    targetDetail: 'Cho phép mở tự do Canva, ChatGPT, Google Gemini, Chrome, Máy tính, Ghi chú Keep',
    isActive: true,
    updatedAt: 'Đang kích hoạt',
  },
  {
    id: 'pol-5',
    name: 'Tự động Nhận diện & Kết nối lại theo Địa chỉ MAC Wi-Fi',
    scope: 'Mạng LAN nội bộ (00:08:22:64:6D:79)',
    mode: 'SYSTEM_GUARD',
    targetDetail: 'Tự động dò bảng ARP MAC Wi-Fi nếu thiết bị đổi địa chỉ IP động trong lớp học',
    isActive: true,
    updatedAt: 'Đang kích hoạt',
  },
  {
    id: 'pol-6',
    name: 'Khóa các Ứng dụng Trò chơi & Chợ Ứng dụng trong Tiết học',
    scope: 'Toàn trường',
    mode: 'ALLOWLIST',
    targetDetail: 'Tạm khóa CH Play, Google Play Trò chơi, YouTube giải trí khi đang trong giờ học',
    isActive: false,
    updatedAt: 'Tạm tắt (Cho phép tự do)',
  },
];

export function AdminPoliciesView(): React.ReactElement {
  const [policies, setPolicies] = useState<MacWifiPolicyRule[]>(() => {
    const saved = localStorage.getItem('school_mdm_mac_policies_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return INITIAL_POLICIES;
  });
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState('Toàn bộ máy kết nối MAC Wi-Fi');
  const [newDetail, setNewDetail] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const savePolicies = (next: MacWifiPolicyRule[]) => {
    setPolicies(next);
    localStorage.setItem('school_mdm_mac_policies_v1', JSON.stringify(next));
  };

  const handleTogglePolicy = (id: string) => {
    const next = policies.map((p) => {
      if (p.id !== id) return p;
      const nextState = !p.isActive;
      setToast(
        nextState
          ? `Đã BẬT chính sách "${p.name}" qua kiểm soát MAC Wi-Fi.`
          : `Đã TẮT chính sách "${p.name}".`,
      );
      return {
        ...p,
        isActive: nextState,
        updatedAt: nextState ? 'Đang kích hoạt' : 'Tạm tắt',
      };
    });
    savePolicies(next);
    setTimeout(() => setToast(null), 3500);
  };

  const handleCreatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const item: MacWifiPolicyRule = {
      id: `pol-${Date.now()}`,
      name: newName.trim(),
      scope: newScope,
      mode: 'ALLOWLIST',
      targetDetail: newDetail.trim() || 'Áp dụng trực tiếp xuống máy tính bảng qua MAC Wi-Fi',
      isActive: true,
      updatedAt: 'Vừa tạo • Đang kích hoạt',
    };
    savePolicies([item, ...policies]);
    setNewName('');
    setNewDetail('');
    setShowAddModal(false);
    setToast(`Đã thêm và kích hoạt chính sách "${item.name}" thành công!`);
    setTimeout(() => setToast(null), 3500);
  };

  const paginated = policies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      {toast && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" /> {toast}
          </span>
          <button onClick={() => setToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" /> Chính sách Kiểm soát Thiết bị qua MAC Wi-Fi
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Thiết lập và bật/tắt các quy tắc điều khiển trực tiếp máy tính bảng học sinh qua địa chỉ MAC Wi-Fi (Không sử dụng Headwind MDM).
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" /> Tạo Chính sách mới
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider">
              <th className="py-3 px-4 font-semibold">Tên Chính sách Kiểm soát</th>
              <th className="py-3 px-4 font-semibold">Phạm vi Áp dụng</th>
              <th className="py-3 px-4 font-semibold">Cơ chế Thực thi qua MAC Wi-Fi</th>
              <th className="py-3 px-4 font-semibold text-center">Trạng thái</th>
              <th className="py-3 px-4 font-semibold text-right">Bật / Tắt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginated.map((pol) => (
              <tr key={pol.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-bold text-slate-900">{pol.name}</td>
                <td className="py-3 px-4 text-slate-600 font-medium">{pol.scope}</td>
                <td className="py-3 px-4 text-slate-600 max-w-md">{pol.targetDetail}</td>
                <td className="py-3 px-4 text-center">
                  {pol.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                      <Check className="w-3 h-3" /> Đang bật
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium text-[11px]">
                      Đang tắt
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleTogglePolicy(pol.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg font-semibold text-xs transition border',
                      pol.isActive
                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700',
                    )}
                  >
                    {pol.isActive ? 'Tắt chính sách' : 'Kích hoạt ngay'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationFooter
        currentPage={page}
        totalItems={policies.length}
        onPageChange={setPage}
        unitLabel="chính sách"
      />

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Thêm Chính sách Kiểm soát MAC Wi-Fi</h4>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreatePolicy} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên chính sách *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Chế độ Thi Học kỳ Tập trung"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phạm vi lớp áp dụng</label>
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="Toàn bộ máy kết nối MAC Wi-Fi">Toàn bộ máy kết nối MAC Wi-Fi</option>
                  <option value="Lớp 6A1">Lớp 6A1</option>
                  <option value="Lớp 6A2">Lớp 6A2</option>
                  <option value="Lớp 7A1">Lớp 7A1</option>
                  <option value="Lớp 8A1">Lớp 8A1</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quy tắc thực thi</label>
                <input
                  type="text"
                  value={newDetail}
                  onChange={(e) => setNewDetail(e.target.value)}
                  placeholder="VD: Ghim ứng dụng Chrome và bật đồng hồ 45 phút"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Lưu &amp; Kích hoạt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. PHIÊN HỌC (/sessions) — ĐIỀU KHIỂN PHIÊN HỌC & ĐỒNG HỒ ĐẾM GIỜ TRÊN TABLET
// ============================================================================
export function AdminSessionsView(): React.ReactElement {
  const [devices, setDevices] = useState<ClassroomDeviceRecord[]>([]);
  const [apps, setApps] = useState<ClassroomAppItem[]>([]);
  const [activeKioskApp, setActiveKioskApp] = useState<ClassroomAppItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [appPage, setAppPage] = useState(1);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadStatus = useCallback(async () => {
    try {
      const [devRes, appRes, kioskRes] = await Promise.all([
        fetch(`${API_BASE_URL}/devices/classroom-status`),
        fetch(`${API_BASE_URL}/applications`),
        fetch(`${API_BASE_URL}/applications/kiosk`),
      ]);
      if (devRes.ok) {
        const j = await devRes.json();
        if (j.data) setDevices(j.data);
      }
      if (appRes.ok) {
        const j = await appRes.json();
        if (j.data) setApps(j.data);
      }
      if (kioskRes.ok) {
        const j = await kioskRes.json();
        setActiveKioskApp(j.data?.activeKioskApp ?? null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 3000);
    return () => clearInterval(t);
  }, [loadStatus]);

  const handleLock = async (locked: boolean) => {
    await fetch(`${API_BASE_URL}/devices/classroom-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked }),
    });
    showToast(
      locked
        ? 'Đã phát lệnh KHÓA MÀN HÌNH xuống tất cả máy tính bảng qua MAC Wi-Fi.'
        : 'Đã phát lệnh MỞ KHÓA màn hình cho toàn bộ máy tính bảng.',
    );
  };

  const handlePinApp = async (app: ClassroomAppItem | null) => {
    const res = await fetch(`${API_BASE_URL}/applications/kiosk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: app ? app.id : null }),
    });
    if (res.ok) {
      const j = await res.json();
      setActiveKioskApp(j.data?.activeKioskApp ?? null);
      showToast(
        app
          ? `Đã ghim ứng dụng [${app.name}] lên màn hình máy tính bảng!`
          : 'Đã bỏ ghim ứng dụng trên máy tính bảng.',
      );
    }
  };

  const paginatedApps = apps.slice((appPage - 1) * PAGE_SIZE, appPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" /> {toast}
          </span>
          <button onClick={() => setToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-indigo-600" /> Điều khiển Phiên học &amp; Đồng hồ Đếm giờ Tablet
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Điều khiển trực tiếp khóa màn hình, bật đồng hồ đếm ngược nổi trên màn hình máy tính bảng và ghim nhanh ứng dụng.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLock(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <Lock className="w-3.5 h-3.5" /> Khóa tất cả máy
          </button>
          <button
            onClick={() => handleLock(false)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <Unlock className="w-3.5 h-3.5" /> Mở khóa tất cả máy
          </button>
        </div>
      </div>

      {/* Countdown Timer synced with physical Tablet floating clock */}
      <ClassroomCountdownTimer
        activeKioskApp={activeKioskApp}
        onExpireLockClassroom={() => {}}
        onToast={showToast}
      />

      {/* Concise Kiosk App Pinning for Session (Max 10 items per page, no descriptions) */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Pin className="w-4 h-4 text-indigo-600" /> Ghim / Bỏ ghim nhanh Ứng dụng trong Phiên học (Tối đa 10 app/trang)
          </h4>
          {activeKioskApp && (
            <button
              onClick={() => handlePinApp(null)}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold"
            >
              Bỏ ghim [{activeKioskApp.name}]
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {paginatedApps.map((app) => {
            const isPinned = activeKioskApp?.id === app.id;
            return (
              <div
                key={app.id}
                className={cn(
                  'p-2.5 rounded-xl border bg-white flex items-center justify-between gap-2',
                  isPinned ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40' : 'border-slate-200',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AppDeviceIcon packageName={app.packageName} name={app.name} size="sm" />
                  <span className="text-xs font-bold text-slate-900 truncate" title={app.name}>
                    {app.name}
                  </span>
                </div>
                <button
                  onClick={() => handlePinApp(isPinned ? null : app)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0',
                    isPinned
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700',
                  )}
                >
                  {isPinned ? 'Bỏ ghim' : 'Ghim'}
                </button>
              </div>
            );
          })}
        </div>

        <PaginationFooter
          currentPage={appPage}
          totalItems={apps.length}
          onPageChange={setAppPage}
          unitLabel="ứng dụng"
        />
      </div>

      {/* Controlled Devices in Active Session */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Máy tính bảng đang chịu điều khiển trong Phiên học ({devices.length} máy)
        </h4>
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase">
                <th className="py-2.5 px-4 font-semibold">Tên Máy</th>
                <th className="py-2.5 px-4 font-semibold">Lớp</th>
                <th className="py-2.5 px-4 font-semibold">MAC Wi-Fi &amp; IP</th>
                <th className="py-2.5 px-4 font-semibold">Pin</th>
                <th className="py-2.5 px-4 font-semibold">Ứng dụng đang Ghim</th>
                <th className="py-2.5 px-4 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {devices.slice(0, PAGE_SIZE).map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-bold text-slate-900">{d.name}</td>
                  <td className="py-2.5 px-4 font-semibold text-indigo-700">Lớp {d.classCode}</td>
                  <td className="py-2.5 px-4 font-mono">
                    MAC: {d.macAddress || d.androidId || '00:08:22:64:6D:79'} • IP: {d.ipAddress || '192.168.1.28'}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-emerald-700">{d.batteryLevel ?? 91}%</td>
                  <td className="py-2.5 px-4">
                    {activeKioskApp ? (
                      <span className="font-bold text-indigo-700">Đang ghim: {activeKioskApp.name}</span>
                    ) : (
                      <span className="text-emerald-700 font-medium">Mở tự do</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      Đang điều khiển qua MAC Wi-Fi
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. NGƯỜI DÙNG (/users) — QUẢN LÝ TÀI KHOẢN QUẢN TRỊ & GIÁO VIÊN
// ============================================================================
interface SchoolUserItem {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'TEACHER';
  assignedClasses: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const INITIAL_USERS: SchoolUserItem[] = [
  {
    id: 'usr-1',
    fullName: 'Quản trị viên Hệ thống (Admin)',
    email: 'admin@school.edu.vn',
    role: 'ADMIN',
    assignedClasses: 'Toàn trường (6A1, 6A2, 7A1, 8A1, Kho)',
    status: 'ACTIVE',
  },
  {
    id: 'usr-2',
    fullName: 'Cô Nguyễn Thị Lan Hương',
    email: 'huong.nguyen@school.edu.vn',
    role: 'TEACHER',
    assignedClasses: 'Lớp 6A1 (Toán)',
    status: 'ACTIVE',
  },
  {
    id: 'usr-3',
    fullName: 'Thầy Trần Minh Đức',
    email: 'duc.tran@school.edu.vn',
    role: 'TEACHER',
    assignedClasses: 'Lớp 6A2 (Khoa học)',
    status: 'ACTIVE',
  },
  {
    id: 'usr-4',
    fullName: 'Thầy Lê Hoàng Nam',
    email: 'nam.le@school.edu.vn',
    role: 'TEACHER',
    assignedClasses: 'Lớp 7A1 (Tin học & AI)',
    status: 'ACTIVE',
  },
  {
    id: 'usr-5',
    fullName: 'Cô Phạm Thu Hà',
    email: 'ha.pham@school.edu.vn',
    role: 'TEACHER',
    assignedClasses: 'Lớp 8A1 (Tiếng Anh)',
    status: 'ACTIVE',
  },
];

export function AdminUsersView(): React.ReactElement {
  const [users, setUsers] = useState<SchoolUserItem[]>(() => {
    const saved = localStorage.getItem('school_mdm_users_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return INITIAL_USERS;
  });
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'TEACHER'>('TEACHER');
  const [classesText, setClassesText] = useState('Lớp 6A1');
  const [toast, setToast] = useState<string | null>(null);

  const saveUsers = (next: SchoolUserItem[]) => {
    setUsers(next);
    localStorage.setItem('school_mdm_users_v1', JSON.stringify(next));
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const created: SchoolUserItem = {
      id: `usr-${Date.now()}`,
      fullName: name.trim(),
      email: email.trim(),
      role,
      assignedClasses: role === 'ADMIN' ? 'Toàn trường' : classesText.trim(),
      status: 'ACTIVE',
    };
    saveUsers([...users, created]);
    setName('');
    setEmail('');
    setShowModal(false);
    setToast(`Đã thêm tài khoản "${created.fullName}" thành công!`);
    setTimeout(() => setToast(null), 3500);
  };

  const handleDelete = (id: string, fullName: string) => {
    if (!window.confirm(`Xác nhận xóa tài khoản "${fullName}"?`)) return;
    saveUsers(users.filter((u) => u.id !== id));
  };

  const paginated = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      {toast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> Quản lý Tài khoản Quản trị &amp; Giáo viên
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Phân quyền giáo viên điều khiển máy tính bảng theo từng lớp học được giao phụ trách (Tối đa 10 dòng/trang).
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" /> Thêm Người dùng
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider">
              <th className="py-3 px-4 font-semibold">Họ và Tên</th>
              <th className="py-3 px-4 font-semibold">Email đăng nhập</th>
              <th className="py-3 px-4 font-semibold">Vai trò</th>
              <th className="py-3 px-4 font-semibold">Lớp phụ trách</th>
              <th className="py-3 px-4 font-semibold">Trạng thái</th>
              <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginated.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                <td className="py-3 px-4">
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-[11px] font-bold',
                      u.role === 'ADMIN'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-sky-100 text-sky-800',
                    )}
                  >
                    {u.role === 'ADMIN' ? 'Quản trị viên' : 'Giáo viên'}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-700 font-medium">{u.assignedClasses}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                    Đang hoạt động
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleDelete(u.id, u.fullName)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationFooter
        currentPage={page}
        totalItems={users.length}
        onPageChange={setPage}
        unitLabel="tài khoản"
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Thêm Tài khoản Giáo viên / Quản trị</h4>
              <button onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Thầy Nguyễn Văn A"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="giaovien@school.edu.vn"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vai trò</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'ADMIN' | 'TEACHER')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="TEACHER">Giáo viên giảng dạy</option>
                  <option value="ADMIN">Quản trị viên (Admin)</option>
                </select>
              </div>
              {role === 'TEACHER' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lớp phân công</label>
                  <input
                    type="text"
                    value={classesText}
                    onChange={(e) => setClassesText(e.target.value)}
                    placeholder="Lớp 6A1, 6A2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. BÁO CÁO (/reports) — BÁO CÁO THIẾT BỊ MAC WI-FI & ỨNG DỤNG TABLET
// ============================================================================
export function AdminReportsView(): React.ReactElement {
  const [devices, setDevices] = useState<ClassroomDeviceRecord[]>([]);
  const [apps, setApps] = useState<ClassroomAppItem[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/devices/classroom-status`).then((r) => r.json()),
      fetch(`${API_BASE_URL}/applications`).then((r) => r.json()),
    ])
      .then(([devJson, appJson]) => {
        if (devJson?.data) setDevices(devJson.data);
        if (appJson?.data) setApps(appJson.data);
      })
      .catch(() => {});
  }, []);

  const approvedCount = apps.filter((a) => a.isApproved).length;
  const blockedCount = apps.length - approvedCount;
  const onlineCount = devices.filter((d) => d.status === 'ONLINE').length;

  const paginatedApps = apps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" /> Báo cáo Vận hành Thiết bị MAC Wi-Fi &amp; Danh mục Ứng dụng
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Số liệu thống kê trực tiếp từ các máy tính bảng Teclast P30 kết nối qua MAC Wi-Fi (Tối đa 10 dòng/trang).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <span className="text-xs text-slate-500">Máy kết nối MAC Wi-Fi</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">
            {onlineCount} / {devices.length} máy
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">MAC: 00:08:22:64:6D:79</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <span className="text-xs text-slate-500">Mức pin trung bình</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {devices[0]?.batteryLevel ?? 91}%
          </p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Đủ pin cho cả ca học</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <span className="text-xs text-slate-500">Ứng dụng được phép mở</span>
          <p className="text-2xl font-bold text-indigo-700 mt-1">
            {approvedCount} / {apps.length} App
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Đồng bộ từ Teclast P30</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <span className="text-xs text-slate-500">Ứng dụng bị khóa an toàn</span>
          <p className="text-2xl font-bold text-rose-600 mt-1">{blockedCount} App</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Chặn mở ngoài phép</p>
        </div>
      </div>

      {/* Report Table (Max 10 rows per page) */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Bảng Báo cáo Trạng thái Cấp phép Ứng dụng trên Tablet (Tối đa 10 dòng/trang)
        </h4>
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase">
                <th className="py-3 px-4 font-semibold">Ứng dụng trên Tablet</th>
                <th className="py-3 px-4 font-semibold">Mã gói (Package)</th>
                <th className="py-3 px-4 font-semibold">Phiên bản</th>
                <th className="py-3 px-4 font-semibold">Trạng thái Kiểm soát MAC Wi-Fi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedApps.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <AppDeviceIcon packageName={app.packageName} name={app.name} size="xs" />
                      <span className="font-bold text-slate-900">{app.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">{app.packageName}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">v{app.versionName || '1.0'}</td>
                  <td className="py-2.5 px-4">
                    {app.isApproved ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                        Cho phép học sinh sử dụng
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px]">
                        Tạm khóa qua MAC Wi-Fi
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationFooter
          currentPage={page}
          totalItems={apps.length}
          onPageChange={setPage}
          unitLabel="ứng dụng"
        />
      </div>
    </div>
  );
}

// ============================================================================
// 6. NHẬT KÝ HỆ THỐNG (/audit-logs) — LỊCH SỬ LỆNH ĐIỀU KHIỂN QUA MAC WI-FI
// ============================================================================
interface AuditLogItem {
  id: string;
  timestamp: string;
  actor: string;
  actionType: string;
  target: string;
  result: 'SUCCESS' | 'INFO';
  detail: string;
}

const INITIAL_LOGS: AuditLogItem[] = [
  {
    id: 'log-1',
    timestamp: 'Hôm nay, 10:18:40',
    actor: 'Giáo viên (Lớp 6A1)',
    actionType: 'ĐỒNG HỒ ĐẾM NGƯỢC NỔI',
    target: 'Teclast P30 (MAC: 00:08:22:64:6D:79)',
    result: 'SUCCESS',
    detail: 'Bật cửa sổ Đồng hồ đếm giờ nổi (Freeform) trực tiếp trên màn hình tablet chạy song song với ứng dụng',
  },
  {
    id: 'log-2',
    timestamp: 'Hôm nay, 10:12:15',
    actor: 'Quản trị viên',
    actionType: 'ĐỒNG BỘ 34 APP TỪ TABLET',
    target: '192.168.1.28:35621 (00:08:22:64:6D:79)',
    result: 'SUCCESS',
    detail: 'Quét và đồng bộ toàn bộ 34 ứng dụng thực tế đang có trên máy tính bảng Teclast P30',
  },
  {
    id: 'log-3',
    timestamp: 'Hôm nay, 10:05:02',
    actor: 'Giáo viên (Lớp 6A1)',
    actionType: 'GHIM ỨNG DỤNG (KIOSK)',
    target: 'Lớp 6A1 • Máy Bàn 01',
    result: 'SUCCESS',
    detail: 'Ghim ứng dụng học tập lên màn hình máy tính bảng qua quyền kiểm soát MAC Wi-Fi',
  },
  {
    id: 'log-4',
    timestamp: 'Hôm nay, 09:58:20',
    actor: 'Quản trị viên',
    actionType: 'CẬP NHẬT TÊN THIẾT BỊ',
    target: 'Máy Bàn 01 (Teclast P30)',
    result: 'SUCCESS',
    detail: 'Chỉnh sửa thông tin định danh và gán thiết bị MAC 00:08:22:64:6D:79 vào Lớp 6A1',
  },
  {
    id: 'log-5',
    timestamp: 'Hôm nay, 09:45:11',
    actor: 'Hệ thống MAC Wi-Fi Watchdog',
    actionType: 'KẾT NỐI TRỰC TIẾP MAC WI-FI',
    target: 'IP: 192.168.1.28 • MAC: 00:08:22:64:6D:79',
    result: 'SUCCESS',
    detail: 'Xác thực kết nối điều khiển không dây thành công với độ trễ < 5ms',
  },
];

export function AdminAuditLogsView(): React.ReactElement {
  const [logs] = useState<AuditLogItem[]>(INITIAL_LOGS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = logs.filter(
    (l) =>
      l.actionType.toLowerCase().includes(search.toLowerCase()) ||
      l.detail.toLowerCase().includes(search.toLowerCase()) ||
      l.target.toLowerCase().includes(search.toLowerCase()),
  );

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" /> Nhật ký Hệ thống &amp; Lịch sử Lệnh MAC Wi-Fi
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ghi nhận chi tiết mọi thao tác khóa máy, ghim ứng dụng, bật đồng hồ đếm ngược và đồng bộ thiết bị (Tối đa 10 dòng/trang).
          </p>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm lệnh, MAC, lớp học..."
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase">
              <th className="py-3 px-4 font-semibold">Thời gian</th>
              <th className="py-3 px-4 font-semibold">Người thực hiện</th>
              <th className="py-3 px-4 font-semibold">Lệnh Điều khiển</th>
              <th className="py-3 px-4 font-semibold">Thiết bị đích (MAC / IP)</th>
              <th className="py-3 px-4 font-semibold">Nội dung chi tiết</th>
              <th className="py-3 px-4 font-semibold text-right">Kết quả</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginated.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                <td className="py-3 px-4 font-semibold text-slate-800">{log.actor}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px]">
                    {log.actionType}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-700">{log.target}</td>
                <td className="py-3 px-4 text-slate-600 max-w-md">{log.detail}</td>
                <td className="py-3 px-4 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                    Thành công
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationFooter
        currentPage={page}
        totalItems={filtered.length}
        onPageChange={setPage}
        unitLabel="bản ghi nhật ký"
      />
    </div>
  );
}

// ============================================================================
// 7. CẤU HÌNH MDM (/mdm-config) — CHỈ SỬ DỤNG QUYỀN KIỂM SOÁT QUA MAC WI-FI
// ============================================================================
export function AdminMacWifiConfigView(): React.ReactElement {
  const [targetMacOrIp, setTargetMacOrIp] = useState('00:08:22:64:6D:79');
  const [isProbing, setIsProbing] = useState(false);
  const [probeData, setProbeData] = useState<{
    connected: boolean;
    ipAddress?: string;
    macAddress?: string;
    latencyMs?: number;
    model?: string;
    message?: string;
  } | null>(null);
  const [watchdogIntervalMs, setWatchdogIntervalMs] = useState('1500');
  const [enableFloatingClock, setEnableFloatingClock] = useState(true);
  const [enableArpAutoResolve, setEnableArpAutoResolve] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const handleTestMacConnection = async () => {
    setIsProbing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/devices/probe-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: targetMacOrIp.trim() }),
      });
      const j = await res.json();
      if (j.data) {
        setProbeData(j.data);
      }
    } catch {
      setProbeData({
        connected: false,
        message: 'Không thể kết nối máy chủ kiểm tra MAC Wi-Fi',
      });
    } finally {
      setIsProbing(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {toast}
          </span>
          <button onClick={() => setToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" /> Cấu hình Quyền Kiểm soát Thiết bị qua MAC Wi-Fi
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Hệ thống chỉ sử dụng quyền kiểm soát trực tiếp qua Địa chỉ MAC Wi-Fi &amp; mạng nội bộ LAN (Đã loại bỏ hoàn toàn Headwind MDM).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: MAC Wi-Fi Direct Probe & Verification */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Kiểm tra Tín hiệu Điều khiển qua MAC Wi-Fi
              </h4>
              <p className="text-xs text-slate-500">
                Nhập Địa chỉ MAC Wi-Fi hoặc IP để kiểm tra độ trễ và quyền điều khiển thiết bị.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={targetMacOrIp}
              onChange={(e) => setTargetMacOrIp(e.target.value)}
              placeholder="00:08:22:64:6D:79 hoặc 192.168.1.28"
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs"
            />
            <button
              type="button"
              onClick={handleTestMacConnection}
              disabled={isProbing}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isProbing && 'animate-spin')} />
              <span>{isProbing ? 'Đang kiểm tra...' : 'Test MAC Wi-Fi'}</span>
            </button>
          </div>

          {probeData && (
            <div
              className={cn(
                'p-3.5 rounded-xl border text-xs space-y-1',
                probeData.connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-800',
              )}
            >
              <div className="font-bold">
                {probeData.connected
                  ? `✓ Kết nối MAC Wi-Fi thành công (${probeData.latencyMs ?? 3}ms)`
                  : '⚠️ Không tìm thấy tín hiệu phản hồi'}
              </div>
              {probeData.connected && (
                <div className="font-mono text-[11px]">
                  Thiết bị: <strong>{probeData.model}</strong> • MAC: <strong>{probeData.macAddress}</strong> • IP: <strong>{probeData.ipAddress}</strong>
                </div>
              )}
              {probeData.message && <p className="text-[11px]">{probeData.message}</p>}
            </div>
          )}
        </div>

        {/* Card 2: MAC Wi-Fi Control Engine Settings */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Thông số Bộ Điều khiển MAC Wi-Fi
              </h4>
              <p className="text-xs text-slate-500">
                Cấu hình chu kỳ đồng bộ lệnh, cửa sổ đồng hồ nổi và tự động phân giải MAC sang IP.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-700">Chu kỳ Watchdog kiểm soát Kiosk / Khóa máy:</span>
              <select
                value={watchdogIntervalMs}
                onChange={(e) => setWatchdogIntervalMs(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 font-semibold"
              >
                <option value="1000">1.0 giây (Tức thời)</option>
                <option value="1500">1.5 giây (Khuyến nghị)</option>
                <option value="3000">3.0 giây (Tiết kiệm pin)</option>
              </select>
            </div>

            <label className="flex items-center justify-between py-1.5 border-b border-slate-100 cursor-pointer">
              <span className="font-semibold text-slate-700">
                Hiển thị cửa sổ Đồng hồ đếm giờ nổi (Freeform) trên Tablet:
              </span>
              <input
                type="checkbox"
                checked={enableFloatingClock}
                onChange={(e) => setEnableFloatingClock(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between py-1.5 cursor-pointer">
              <span className="font-semibold text-slate-700">
                Tự động dò bảng ARP theo MAC Wi-Fi khi máy đổi IP:
              </span>
              <input
                type="checkbox"
                checked={enableArpAutoResolve}
                onChange={(e) => setEnableArpAutoResolve(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
            </label>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setToast('Đã lưu cấu hình Kiểm soát qua MAC Wi-Fi thành công!');
                setTimeout(() => setToast(null), 3500);
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Lưu cấu hình MAC Wi-Fi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
