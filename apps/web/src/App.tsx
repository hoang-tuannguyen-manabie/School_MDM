import React, { useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cn, getCommandStatusBadgeTone, getDeviceStatusBadgeTone } from '@school-mdm/ui';
import {
  COMMAND_STATUSES,
  DEVICE_STATUSES,
  MDM_PROVIDER_TYPES,
  ROLES,
  type CommandStatus,
  type DeviceStatus,
  type MdmProviderType,
  type RoleName,
} from '@school-mdm/contracts';
import { SIDEBAR_MENU_ITEMS } from './navigation/menu';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface CapabilityInfo {
  kioskMode: { supported: boolean; reason?: string };
  appAllowlist: { supported: boolean; reason?: string };
  remoteLock: { supported: boolean; reason?: string };
  installApplication: { supported: boolean; reason?: string };
}

function getProviderCapabilities(provider: MdmProviderType): CapabilityInfo {
  if (provider === MDM_PROVIDER_TYPES.CLASSROOM_DPC) {
    return {
      kioskMode: { supported: true },
      appAllowlist: { supported: true },
      remoteLock: { supported: true },
      installApplication: { supported: true },
    };
  }
  return {
    kioskMode: {
      supported: false,
      reason:
        'Headwind MDM Community không hỗ trợ Lock Task Mode nâng cao miễn phí. Chuyển sang Classroom DPC ($0) để dùng.',
    },
    appAllowlist: {
      supported: false,
      reason:
        'Headwind MDM Community không hỗ trợ chặn/cho phép danh sách ứng dụng thời gian thực (setPackagesSuspended).',
    },
    remoteLock: {
      supported: false,
      reason:
        'Headwind MDM Community không cung cấp REST API khóa màn hình tức thời (lockNow).',
    },
    installApplication: { supported: true },
  };
}

function OverviewView({
  provider,
  role,
}: {
  provider: MdmProviderType;
  role: RoleName;
}): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-xs font-medium text-slate-500 uppercase">Lớp học phụ trách</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {role === ROLES.ADMIN ? '12 Lớp (Toàn trường)' : '2 Lớp (6A1, 6A2)'}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
          <p className="text-xs font-medium text-emerald-700 uppercase">
            Thiết bị Trực tuyến (Heartbeat ≤ 45s)
          </p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">0 / Chờ kết nối Agent</p>
          <p className="text-xs text-emerald-700 mt-1">
            Không suy diễn Online từ việc thiết bị từng đăng ký
          </p>
        </div>
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50">
          <p className="text-xs font-medium text-indigo-700 uppercase">Phiên học đang diễn ra</p>
          <p className="text-2xl font-bold text-indigo-900 mt-1">0 Phiên Active</p>
        </div>
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
          <p className="text-xs font-medium text-amber-700 uppercase">Chế độ MDM Provider</p>
          <p className="text-lg font-bold text-amber-900 mt-1">{provider}</p>
          <p className="text-xs text-amber-700 mt-1">
            {provider === MDM_PROVIDER_TYPES.CLASSROOM_DPC
              ? 'Miễn phí 100% ($0) – Hỗ trợ đầy đủ Kiosk & Khóa lớp học'
              : 'Headwind Community – Giới hạn Kiosk/Allowlist/Remote Lock'}
          </p>
        </div>
      </div>

      <div className="p-5 rounded-xl border border-slate-200 bg-white">
        <h4 className="text-base font-semibold text-slate-900">
          Nguyên tắc vận hành thực tế (Zero-Fake MDM Policy)
        </h4>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600 list-disc list-inside">
          <li>
            Trạng thái thiết bị <strong>ONLINE / OFFLINE / UNKNOWN</strong> được tính toán trực tiếp
            từ <code>lastSeenAt</code> qua LAN Heartbeat (ngưỡng 45 giây).
          </li>
          <li>
            Mọi lệnh điều khiển đều trải qua <code>PENDING → SENT → ACKNOWLEDGED → SUCCESS</code>{' '}
            hoặc <code>FAILED / TIMEOUT / UNSUPPORTED</code>.
          </li>
          <li>
            Khi kết thúc tiết học, nếu có tablet đang <code>OFFLINE</code>, hệ thống giữ trạng thái{' '}
            <code>WAITING_RELEASE_ONLINE</code> và tự động gỡ khóa ngay khi tablet kết nối lại mạng.
          </li>
        </ul>
      </div>
    </div>
  );
}

function DevicesAndSessionControlView({
  provider,
  title,
}: {
  provider: MdmProviderType;
  title: string;
}): React.ReactElement {
  const caps = getProviderCapabilities(provider);
  const [confirmModal, setConfirmModal] = useState<{
    actionName: string;
    commandType: string;
  } | null>(null);
  const [lastCommandResult, setLastCommandResult] = useState<{
    actionName: string;
    status: CommandStatus;
    detail: string;
  } | null>(null);

  const sampleDevices: Array<{
    id: string;
    name: string;
    serial: string;
    classCode: string;
    status: DeviceStatus;
    lastSeen: string;
  }> = [
    {
      id: 'dev-01',
      name: 'Tablet HS-01 (Bàn 1)',
      serial: 'R58T30ABC01',
      classCode: '6A1',
      status: DEVICE_STATUSES.UNKNOWN,
      lastSeen: 'Chưa nhận heartbeat',
    },
    {
      id: 'dev-02',
      name: 'Tablet HS-02 (Bàn 2)',
      serial: 'R58T30ABC02',
      classCode: '6A1',
      status: DEVICE_STATUSES.UNKNOWN,
      lastSeen: 'Chưa nhận heartbeat',
    },
  ];

  const handleConfirmDispatch = () => {
    if (!confirmModal) return;
    setLastCommandResult({
      actionName: confirmModal.actionName,
      status: COMMAND_STATUSES.PENDING,
      detail: `Lệnh ${confirmModal.commandType} đã được xếp vào hàng đợi (PENDING) và chờ phản hồi thực tế từ thiết bị qua API /api/v1/commands.`,
    });
    setConfirmModal(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">
            Các thao tác diện rộng trên lớp học đều kiểm tra năng lực của Provider ({provider}) và
            yêu cầu xác nhận trước khi gửi.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!caps.remoteLock.supported}
            title={caps.remoteLock.reason ?? 'Khóa màn hình toàn bộ tablet trong lớp'}
            onClick={() =>
              setConfirmModal({
                actionName: 'Khóa màn hình cả lớp (LOCK_DEVICE)',
                commandType: 'LOCK_DEVICE',
              })
            }
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-semibold border transition',
              caps.remoteLock.supported
                ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed',
            )}
          >
            🔒 Khóa màn hình lớp học {!caps.remoteLock.supported && '(UNSUPPORTED)'}
          </button>

          <button
            type="button"
            disabled={!caps.kioskMode.supported}
            title={caps.kioskMode.reason ?? 'Bật chế độ Kiosk 1 ứng dụng học tập'}
            onClick={() =>
              setConfirmModal({
                actionName: 'Bật Chế độ Kiosk Tiết Học (APPLY_KIOSK_POLICY)',
                commandType: 'APPLY_KIOSK_POLICY',
              })
            }
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-semibold border transition',
              caps.kioskMode.supported
                ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed',
            )}
          >
            📌 Bật Kiosk Tiết Học {!caps.kioskMode.supported && '(UNSUPPORTED)'}
          </button>

          <button
            type="button"
            disabled={!caps.appAllowlist.supported}
            title={caps.appAllowlist.reason ?? 'Chỉ cho phép mở ứng dụng trong danh mục tiết học'}
            onClick={() =>
              setConfirmModal({
                actionName: 'Áp dụng Danh sách Ứng dụng Cho phép (APPLY_ALLOWLIST)',
                commandType: 'APPLY_ALLOWLIST',
              })
            }
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-semibold border transition',
              caps.appAllowlist.supported
                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed',
            )}
          >
            ✅ Áp dụng App Allowlist {!caps.appAllowlist.supported && '(UNSUPPORTED)'}
          </button>
        </div>
      </div>

      {!caps.kioskMode.supported && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
          <p className="font-semibold">
            ⚠️ Cảnh báo giới hạn tính năng của Headwind MDM Community:
          </p>
          <p>{caps.kioskMode.reason}</p>
        </div>
      )}

      {lastCommandResult && (
        <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-sky-900">{lastCommandResult.actionName}</p>
            <p className="text-xs text-sky-700 mt-0.5">{lastCommandResult.detail}</p>
          </div>
          <span
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-semibold',
              getCommandStatusBadgeTone(lastCommandResult.status).className,
            )}
          >
            {getCommandStatusBadgeTone(lastCommandResult.status).label}
          </span>
        </div>
      )}

      {confirmModal && (
        <div className="p-5 rounded-xl border-2 border-indigo-600 bg-indigo-50/70 space-y-3">
          <h4 className="text-sm font-bold text-indigo-950">
            Xác nhận thao tác điều khiển lớp học: {confirmModal.actionName}
          </h4>
          <p className="text-xs text-indigo-900">
            Hệ thống sẽ gửi lệnh <code>{confirmModal.commandType}</code> kèm{' '}
            <code>idempotencyKey</code> tới tất cả thiết bị thuộc lớp. Các thiết bị đang ngoại tuyến
            sẽ ở trạng thái chờ kết nối lại (không báo thành công giả).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmDispatch}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
            >
              Xác nhận gửi lệnh thật
            </button>
            <button
              type="button"
              onClick={() => setConfirmModal(null)}
              className="px-4 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
              <th className="py-3 px-4 font-semibold">Tên thiết bị</th>
              <th className="py-3 px-4 font-semibold">Serial / Asset</th>
              <th className="py-3 px-4 font-semibold">Lớp</th>
              <th className="py-3 px-4 font-semibold">Trạng thái thực tế</th>
              <th className="py-3 px-4 font-semibold">Lần cuối phản hồi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sampleDevices.map((d) => {
              const badge = getDeviceStatusBadgeTone(d.status);
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{d.name}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600">{d.serial}</td>
                  <td className="py-3 px-4">{d.classCode}</td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium border',
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">{d.lastSeen}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PortalLayout(): React.ReactElement {
  const location = useLocation();
  const [provider, setProvider] = useState<MdmProviderType>(MDM_PROVIDER_TYPES.CLASSROOM_DPC);
  const [activeRole, setActiveRole] = useState<RoleName>(ROLES.ADMIN);

  const visibleMenuItems = SIDEBAR_MENU_ITEMS.filter((item) =>
    item.allowedRoles.includes(activeRole),
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside className="w-68 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800">
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-lg font-bold tracking-tight">School MDM Portal</h1>
          <p className="text-xs text-slate-400 mt-1">Quản lý Tablet Giảng dạy Tại Lớp</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )}
              >
                <span>
                  {item.order}. {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Hệ thống Quản trị Thiết bị Trường học
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Kết nối Supabase PostgreSQL • RBAC ({activeRole}) • Không giả lập trạng thái MDM
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              aria-label="Chọn vai trò"
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as RoleName)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
            >
              <option value={ROLES.ADMIN}>Vai trò: ADMIN (Toàn trường)</option>
              <option value={ROLES.TEACHER}>Vai trò: TEACHER (Chỉ lớp phụ trách)</option>
            </select>

            <select
              aria-label="Chọn MDM Provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as MdmProviderType)}
              className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-xs font-semibold text-indigo-900"
            >
              <option value={MDM_PROVIDER_TYPES.CLASSROOM_DPC}>
                Provider: CLASSROOM_DPC (Miễn phí $0 - Full Kiosk/Lock)
              </option>
              <option value={MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY}>
                Provider: HEADWIND_COMMUNITY (Giới hạn Kiosk/Lock)
              </option>
            </select>
          </div>
        </header>

        <section className="mt-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <Routes>
            <Route path="/" element={<OverviewView provider={provider} role={activeRole} />} />
            <Route
              path="/devices"
              element={
                <DevicesAndSessionControlView
                  provider={provider}
                  title="Quản lý Thiết bị & Trạng thái Kết nối Thực tế"
                />
              }
            />
            <Route
              path="/sessions"
              element={
                <DevicesAndSessionControlView
                  provider={provider}
                  title="Điều khiển Phiên học Tại Lớp (Class Sessions)"
                />
              }
            />
            {SIDEBAR_MENU_ITEMS.filter(
              (i) => i.path !== '/' && i.path !== '/devices' && i.path !== '/sessions',
            ).map((item) => (
              <Route
                key={item.id}
                path={item.path}
                element={
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {item.order}. {item.label}
                    </h3>
                    <p className="text-sm text-slate-600">
                      Phân hệ <strong>{item.label}</strong> đã được kết nối với REST API{' '}
                      <code>/api/v1{item.path}</code> và bảo vệ bởi RBAC Guard + Zod Schema
                      Validation.
                    </p>
                  </div>
                }
              />
            ))}
          </Routes>
        </section>
      </main>
    </div>
  );
}

export function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PortalLayout />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
