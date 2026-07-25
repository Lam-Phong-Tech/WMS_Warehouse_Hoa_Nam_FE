import { describe, it, expect } from 'vitest';
import {
  applyPermissionToggle,
  findInvalidGroupsForSave,
  findViewPermission,
  groupPermissionsByObject,
} from './role-permissions.helpers';
import type { Permission } from '@/shared/types/permission';

function perm(id: number, object: string, action: string): Permission {
  return {
    id,
    code: `${object}_${action}`.toUpperCase(),
    name: action,
    object,
    action,
    description: null,
  };
}

const XEM = perm(1, 'Nhân viên', 'xem');
const THEM = perm(2, 'Nhân viên', 'them');
const SUA = perm(3, 'Nhân viên', 'sua');
const GROUP: Permission[] = [XEM, THEM, SUA];

// ---------------------------------------------------------------------------
// findViewPermission
// ---------------------------------------------------------------------------

describe('findViewPermission', () => {
  it('tìm được permission action "xem" trong nhóm', () => {
    expect(findViewPermission(GROUP)).toBe(XEM);
  });

  it('trả về undefined nếu nhóm không có quyền "xem"', () => {
    expect(findViewPermission([THEM, SUA])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// groupPermissionsByObject
// ---------------------------------------------------------------------------

describe('groupPermissionsByObject', () => {
  it('gom nhóm permissions theo object, giữ thứ tự xuất hiện đầu tiên', () => {
    const khoXem = perm(4, 'Kho', 'xem');
    const groups = groupPermissionsByObject([XEM, khoXem, THEM]);
    expect(groups.map((g) => g.object)).toEqual(['Nhân viên', 'Kho']);
    expect(groups[0].permissions).toEqual([XEM, THEM]);
    expect(groups[1].permissions).toEqual([khoXem]);
  });
});

// ---------------------------------------------------------------------------
// applyPermissionToggle — rule tick/untick "Xem"
// ---------------------------------------------------------------------------

describe('applyPermissionToggle', () => {
  it('tick quyền con (không phải "xem") tự động tick kèm quyền "Xem"', () => {
    const current = new Set<number>();
    const next = applyPermissionToggle(current, THEM, GROUP, true);
    expect(next.has(THEM.id)).toBe(true);
    expect(next.has(XEM.id)).toBe(true);
  });

  it('tick "Xem" chỉ tick chính nó, không kéo theo quyền khác', () => {
    const current = new Set<number>();
    const next = applyPermissionToggle(current, XEM, GROUP, true);
    expect(next).toEqual(new Set([XEM.id]));
  });

  it('untick "Xem" khi đang có quyền con -> untick toàn bộ quyền con trong nhóm', () => {
    const current = new Set<number>([XEM.id, THEM.id, SUA.id]);
    const next = applyPermissionToggle(current, XEM, GROUP, false);
    expect(next).toEqual(new Set());
  });

  it('untick 1 quyền con không ảnh hưởng "Xem" hay quyền con khác', () => {
    const current = new Set<number>([XEM.id, THEM.id, SUA.id]);
    const next = applyPermissionToggle(current, THEM, GROUP, false);
    expect(next).toEqual(new Set([XEM.id, SUA.id]));
  });

  it('không mutate Set gốc truyền vào', () => {
    const current = new Set<number>();
    applyPermissionToggle(current, THEM, GROUP, true);
    expect(current.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// findInvalidGroupsForSave — chặn lưu khi thiếu "Xem"
// ---------------------------------------------------------------------------

describe('findInvalidGroupsForSave', () => {
  const groups = groupPermissionsByObject(GROUP);

  it('hợp lệ khi có "Xem" và các quyền con', () => {
    const selected = new Set([XEM.id, THEM.id]);
    expect(findInvalidGroupsForSave(groups, selected)).toEqual([]);
  });

  it('hợp lệ khi chỉ có "Xem", không có quyền con nào', () => {
    const selected = new Set([XEM.id]);
    expect(findInvalidGroupsForSave(groups, selected)).toEqual([]);
  });

  it('hợp lệ khi nhóm không chọn quyền nào', () => {
    expect(findInvalidGroupsForSave(groups, new Set())).toEqual([]);
  });

  it('không hợp lệ khi có quyền con nhưng thiếu "Xem"', () => {
    const selected = new Set([THEM.id]);
    expect(findInvalidGroupsForSave(groups, selected)).toEqual(['Nhân viên']);
  });

  it('báo đủ tên tất cả nhóm vi phạm khi có nhiều nhóm', () => {
    const khoXem = perm(4, 'Kho', 'xem');
    const khoThem = perm(5, 'Kho', 'them');
    const multiGroups = groupPermissionsByObject([...GROUP, khoXem, khoThem]);
    const selected = new Set([THEM.id, khoThem.id]);
    expect(findInvalidGroupsForSave(multiGroups, selected)).toEqual([
      'Nhân viên',
      'Kho',
    ]);
  });
});
