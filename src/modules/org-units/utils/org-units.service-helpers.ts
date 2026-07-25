/**
 * P2.1 — Tách các business logic helpers ra khỏi OrgUnitFormModal
 * để dễ maintain và unit test.
 */
import type { OrgUnit } from '@/modules/org-units/types/org-units.types';

// ---------------------------------------------------------------------------
// P1.1 — Valid parent types per unit type
// BRD: chi_nhanh có thể đặt dưới cong_ty_me hoặc cong_ty_con
// ---------------------------------------------------------------------------

export const VALID_PARENT_TYPES: Record<string, string[]> = {
  cong_ty_con: ['cong_ty_me'],
  chi_nhanh: ['cong_ty_me', 'cong_ty_con'],
};

// ---------------------------------------------------------------------------
// Descendant helpers
// ---------------------------------------------------------------------------

/**
 * BFS to collect all descendant IDs of a given org unit.
 * Used to prevent self-reference and circular parent selection.
 */
export function getDescendantIds(
  editingId: number,
  units: OrgUnit[],
): Set<number> {
  const result = new Set<number>();
  const queue = [editingId];
  while (queue.length) {
    const pid = queue.shift()!;
    for (const u of units) {
      if (u.parentId === pid && !result.has(u.id)) {
        result.add(u.id);
        queue.push(u.id);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Parent options
// ---------------------------------------------------------------------------

/**
 * Get valid parent options for the given unit type.
 * Excludes:
 * - The editing unit itself (self-reference)
 * - All descendants of the editing unit (circular reference)
 * - Units whose type is not in the allowed parent types
 *
 * Inactive units are shown with "(Ngừng hoạt động)" label and disabled.
 */
export function getValidParentOptions(
  unitType: string,
  allUnits: OrgUnit[],
  editing: OrgUnit | null,
) {
  const validTypes = VALID_PARENT_TYPES[unitType] ?? [];
  // Nếu unitType không có trong VALID_PARENT_TYPES (vd: cong_ty_me), trả về mảng rỗng
  if (!(unitType in VALID_PARENT_TYPES)) {
    return [];
  }
  const excluded = editing
    ? getDescendantIds(editing.id, allUnits)
    : new Set<number>();
  if (editing) excluded.add(editing.id);

  return allUnits
    .filter((u) => !excluded.has(u.id))
    .filter((u) => validTypes.length === 0 || validTypes.includes(u.unitType))
    .map((u) => ({
      value: u.id,
      label: u.active
        ? `${u.code} — ${u.name}`
        : `${u.code} — ${u.name} (Ngừng hoạt động)`,
      disabled: !u.active,
    }));
}

// ---------------------------------------------------------------------------
// TMP code generation
// ---------------------------------------------------------------------------

/**
 * P0 FIX: Trả về giá trị mặc định cho các trường TMP khi bấm "Tạo TMP".
 * Bao gồm: taxCodeStatus='pending', taxCodeDueDate (7 ngày từ hiện tại), tmpCodeLocked=true
 */
export const TMP_DEFAULT_DAYS = 7;

export function getTmpDefaults(): {
  taxCodeStatus: string;
  taxCodeDueDate: string;
  tmpCodeLocked: boolean;
} {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + TMP_DEFAULT_DAYS); // 7 ngày để cập nhật MST
  return {
    taxCodeStatus: 'pending',
    taxCodeDueDate: dueDate.toISOString().split('T')[0], // YYYY-MM-DD
    tmpCodeLocked: true,
  };
}
