import { ROLES, type RoleName } from '@school-mdm/contracts';

export interface SidebarMenuItem {
  id: string;
  order: number;
  label: string;
  path: string;
  allowedRoles: RoleName[];
}

export const SIDEBAR_MENU_ITEMS: readonly SidebarMenuItem[] = [
  {
    id: 'overview',
    order: 1,
    label: 'Tổng quan',
    path: '/',
    allowedRoles: [ROLES.ADMIN, ROLES.TEACHER],
  },
  {
    id: 'classes',
    order: 2,
    label: 'Lớp học',
    path: '/classes',
    allowedRoles: [ROLES.ADMIN, ROLES.TEACHER],
  },
  {
    id: 'devices',
    order: 3,
    label: 'Thiết bị',
    path: '/devices',
    allowedRoles: [ROLES.ADMIN, ROLES.TEACHER],
  },
  {
    id: 'applications',
    order: 4,
    label: 'Ứng dụng',
    path: '/applications',
    allowedRoles: [ROLES.ADMIN, ROLES.TEACHER],
  },
  {
    id: 'policies',
    order: 5,
    label: 'Chính sách',
    path: '/policies',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'sessions',
    order: 6,
    label: 'Phiên học',
    path: '/sessions',
    allowedRoles: [ROLES.ADMIN, ROLES.TEACHER],
  },
  {
    id: 'users',
    order: 7,
    label: 'Người dùng',
    path: '/users',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'reports',
    order: 8,
    label: 'Báo cáo',
    path: '/reports',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'audit-logs',
    order: 9,
    label: 'Nhật ký hệ thống',
    path: '/audit-logs',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'mdm-config',
    order: 10,
    label: 'Cấu hình MDM',
    path: '/mdm-config',
    allowedRoles: [ROLES.ADMIN],
  },
] as const;
