import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  COMMAND_STATUSES,
  DEVICE_STATUSES,
  type CommandStatus,
  type DeviceStatus,
} from '@school-mdm/contracts';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getDeviceStatusBadgeTone(status: DeviceStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case DEVICE_STATUSES.ONLINE:
      return {
        label: 'Trực tuyến (Online)',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case DEVICE_STATUSES.OFFLINE:
      return {
        label: 'Ngoại tuyến (Offline)',
        className: 'bg-slate-100 text-slate-700 border-slate-300',
      };
    case DEVICE_STATUSES.PENDING:
      return {
        label: 'Đang chờ (Pending)',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case DEVICE_STATUSES.ERROR:
      return {
        label: 'Lỗi (Error)',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case DEVICE_STATUSES.UNKNOWN:
    default:
      return {
        label: 'Chưa xác định (Unknown)',
        className: 'bg-zinc-100 text-zinc-600 border-zinc-300',
      };
  }
}

export function getCommandStatusBadgeTone(status: CommandStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case COMMAND_STATUSES.PENDING:
      return { label: 'Chờ gửi (Pending)', className: 'bg-amber-50 text-amber-700' };
    case COMMAND_STATUSES.SENT:
      return { label: 'Đã gửi (Sent)', className: 'bg-sky-50 text-sky-700' };
    case COMMAND_STATUSES.ACKNOWLEDGED:
      return { label: 'Đã nhận (Acknowledged)', className: 'bg-indigo-50 text-indigo-700' };
    case COMMAND_STATUSES.SUCCESS:
      return { label: 'Thành công (Success)', className: 'bg-emerald-50 text-emerald-700' };
    case COMMAND_STATUSES.FAILED:
      return { label: 'Thất bại (Failed)', className: 'bg-rose-50 text-rose-700' };
    case COMMAND_STATUSES.TIMEOUT:
      return { label: 'Quá hạn (Timeout)', className: 'bg-orange-50 text-orange-700' };
    case COMMAND_STATUSES.UNSUPPORTED:
      return {
        label: 'Không hỗ trợ (Unsupported)',
        className: 'bg-zinc-200 text-zinc-700',
      };
  }
}
