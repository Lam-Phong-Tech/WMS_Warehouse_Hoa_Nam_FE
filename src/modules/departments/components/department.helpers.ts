import type { Department } from '@/modules/departments/types/departments.types';

/** Trả về tập ID của tất cả phòng ban con (descendants) trong flat list. */
export function getDescendantIds(
  allDepts: Department[],
  rootId: number,
): Set<number> {
  const childrenOf = new Map<number | null | undefined, number[]>();
  for (const d of allDepts) {
    const pid = d.parentId ?? null;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(d.id);
  }
  const result = new Set<number>();
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const child of childrenOf.get(cur) ?? []) {
      result.add(child);
      queue.push(child);
    }
  }
  return result;
}

/**
 * P1.1: Lấy danh sách phòng ban cha hợp lệ.
 * - Chỉ cho phép chọn cha trong cùng một đơn vị tổ chức (orgUnitId).
 * - Loại bỏ chính phòng ban đang sửa và các phòng ban con của nó.
 * - Phòng ban không hoạt động sẽ bị vô hiệu hóa (disabled).
 */
export function getValidParentDeptOptions(
  allDepts: Department[],
  currentOrgUnitId: number | null,
  editingDept: Department | null,
): { value: number; label: string; disabled: boolean }[] {
  if (!currentOrgUnitId) {
    return [];
  }

  const excludedIds = editingDept
    ? getDescendantIds(allDepts, editingDept.id)
    : new Set<number>();
  if (editingDept) {
    excludedIds.add(editingDept.id);
  }

  return allDepts
    .filter(
      (dept) =>
        Number(dept.orgUnitId) === Number(currentOrgUnitId) &&
        !excludedIds.has(dept.id),
    )
    .map((dept) => ({
      value: dept.id,
      label: dept.active
        ? `${dept.code} — ${dept.name}`
        : `${dept.code} — ${dept.name} (Ngừng hoạt động)`,
      disabled: !dept.active,
    }));
}
