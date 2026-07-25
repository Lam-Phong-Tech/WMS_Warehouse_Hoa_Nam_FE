import { describe, it, expect } from 'vitest';
import {
  actionLabel,
  findViewPermission,
  groupPermissionsByObject,
} from './role-permissions.helpers';
import type { Permission } from '../types/roles.types';

const makePermission = (overrides: Partial<Permission>): Permission => ({
  id: 1,
  code: 'X',
  name: 'X',
  object: 'Nhóm A',
  action: 'xem',
  description: null,
  ...overrides,
});

describe('groupPermissionsByObject', () => {
  it('nhóm quyền theo object, giữ nguyên thứ tự xuất hiện đầu tiên', () => {
    const permissions: Permission[] = [
      makePermission({ id: 1, object: 'Đơn vị/tổ chức' }),
      makePermission({ id: 2, object: 'Kho' }),
      makePermission({ id: 3, object: 'Đơn vị/tổ chức' }),
    ];
    const groups = groupPermissionsByObject(permissions);
    expect(groups).toHaveLength(2);
    expect(groups[0].object).toBe('Đơn vị/tổ chức');
    expect(groups[0].permissions.map((p) => p.id)).toEqual([1, 3]);
    expect(groups[1].object).toBe('Kho');
    expect(groups[1].permissions.map((p) => p.id)).toEqual([2]);
  });

  it('không bỏ sót bất kỳ quyền nào, kể cả object lạ chưa từng biết trước (không dùng danh mục cứng)', () => {
    // Bug lớp cũ: PERMISSION_CATALOG tĩnh chỉ phủ ~40/87 mã quyền thật, các
    // object như "Stock Receipt / Phiếu nhập kho" hoàn toàn không hiển thị.
    // Nhóm động theo object của BE thì object nào cũng lên được, kể cả một
    // object hoàn toàn mới BE thêm sau này.
    const permissions: Permission[] = [
      makePermission({ id: 1, object: 'Stock Receipt / Phiếu nhập kho' }),
      makePermission({ id: 2, object: 'Một module tương lai chưa từng biết' }),
    ];
    const groups = groupPermissionsByObject(permissions);
    const totalPermissions = groups.reduce(
      (sum, g) => sum + g.permissions.length,
      0,
    );
    expect(totalPermissions).toBe(permissions.length);
    expect(groups.map((g) => g.object)).toEqual([
      'Stock Receipt / Phiếu nhập kho',
      'Một module tương lai chưa từng biết',
    ]);
  });

  it('gộp object rỗng/thiếu vào nhóm "Khác" thay vì làm rơi quyền', () => {
    const permissions: Permission[] = [makePermission({ id: 1, object: '' })];
    const groups = groupPermissionsByObject(permissions);
    expect(groups).toEqual([{ object: 'Khác', permissions: [permissions[0]] }]);
  });
});

describe('findViewPermission', () => {
  it('tìm đúng quyền có action "xem" trong nhóm', () => {
    const group = [
      makePermission({ id: 1, action: 'them' }),
      makePermission({ id: 2, action: 'xem' }),
    ];
    expect(findViewPermission(group)?.id).toBe(2);
  });

  it('trả về undefined nếu nhóm không có quyền "xem" (vd nhóm chỉ có export)', () => {
    const group = [makePermission({ id: 1, action: 'xuat' })];
    expect(findViewPermission(group)).toBeUndefined();
  });
});

describe('actionLabel', () => {
  it('trả về nhãn tiếng Việt đã biết', () => {
    expect(actionLabel('xem')).toBe('Xem');
    expect(actionLabel('xoa_mem')).toBe('Xóa mềm');
    expect(actionLabel('ghi_hao_hut')).toBe('Ghi nhận hao hụt');
  });

  it('fallback title-case cho action mới chưa có trong danh mục nhãn (không ẩn quyền)', () => {
    expect(actionLabel('duyet_khan_cap')).toBe('Duyet Khan Cap');
  });
});
