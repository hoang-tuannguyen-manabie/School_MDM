import { describe, expect, it } from 'vitest';
import { SIDEBAR_MENU_ITEMS } from './menu';

describe('SIDEBAR_MENU_ITEMS', () => {
  it('contains all 10 required School MDM Portal menu items in exact order', () => {
    expect(SIDEBAR_MENU_ITEMS.map((item) => item.label)).toEqual([
      'Tổng quan',
      'Lớp học',
      'Thiết bị',
      'Ứng dụng',
      'Chính sách',
      'Phiên học',
      'Người dùng',
      'Báo cáo',
      'Nhật ký hệ thống',
      'Cấu hình MDM',
    ]);
  });
});
