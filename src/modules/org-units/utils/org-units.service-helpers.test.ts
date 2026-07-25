import { describe, it, expect } from 'vitest';
import {
  getDescendantIds,
  getValidParentOptions,
  getTmpDefaults,
  VALID_PARENT_TYPES,
} from './org-units.service-helpers';
import type { OrgUnit } from '@/modules/org-units/types/org-units.types';

// ---------------------------------------------------------------------------
// P1.1 — VALID_PARENT_TYPES
// ---------------------------------------------------------------------------

describe('VALID_PARENT_TYPES', () => {
  it('cong_ty_con chỉ chọn parent là cong_ty_me', () => {
    expect(VALID_PARENT_TYPES.cong_ty_con).toEqual(['cong_ty_me']);
  });

  it('chi_nhanh có thể chọn parent là cong_ty_me hoặc cong_ty_con (theo BRD update)', () => {
    expect(VALID_PARENT_TYPES.chi_nhanh).toEqual(['cong_ty_me', 'cong_ty_con']);
  });

  it('cong_ty_me không có valid parent types (mảng rỗng)', () => {
    expect(VALID_PARENT_TYPES.cong_ty_me).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// P1.2 — getDescendantIds
// ---------------------------------------------------------------------------

describe('getDescendantIds', () => {
  const UNITS: OrgUnit[] = [
    {
      id: 1,
      code: 'ME',
      name: 'Cty Me',
      unitType: 'cong_ty_me',
      parentId: null,
      active: true,
    },
    {
      id: 2,
      code: 'CON1',
      name: 'Cty Con 1',
      unitType: 'cong_ty_con',
      parentId: 1,
      active: true,
    },
    {
      id: 3,
      code: 'CON2',
      name: 'Cty Con 2',
      unitType: 'cong_ty_con',
      parentId: 1,
      active: true,
    },
    {
      id: 4,
      code: 'CN1',
      name: 'Chi nhánh 1',
      unitType: 'chi_nhanh',
      parentId: 2,
      active: true,
    },
    {
      id: 5,
      code: 'CN2',
      name: 'Chi nhánh 2',
      unitType: 'chi_nhanh',
      parentId: 2,
      active: true,
    },
    {
      id: 6,
      code: 'CN3',
      name: 'Chi nhánh 3',
      unitType: 'chi_nhanh',
      parentId: 3,
      active: true,
    },
  ];

  it('trả về empty set khi không có descendant', () => {
    const result = getDescendantIds(4, UNITS);
    expect(result.size).toBe(0);
  });

  it('trả về tất cả descendant của cong_ty_me (cả con và cháu)', () => {
    const result = getDescendantIds(1, UNITS);
    expect(result).toEqual(new Set([2, 3, 4, 5, 6]));
  });

  it('trả về descendant của cong_ty_con (chỉ chi nhánh)', () => {
    const result = getDescendantIds(2, UNITS);
    expect(result).toEqual(new Set([4, 5]));
  });

  it('trả về descendant của chi_nhanh (không có)', () => {
    const result = getDescendantIds(4, UNITS);
    expect(result.size).toBe(0);
  });

  it('không bao gồm chính node đang xét', () => {
    const result = getDescendantIds(1, UNITS);
    expect(result.has(1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P1.2 — getValidParentOptions
// ---------------------------------------------------------------------------

describe('getValidParentOptions', () => {
  const UNITS: OrgUnit[] = [
    {
      id: 1,
      code: 'ME',
      name: 'Cty Me',
      unitType: 'cong_ty_me',
      parentId: null,
      active: true,
    },
    {
      id: 2,
      code: 'CON1',
      name: 'Cty Con 1',
      unitType: 'cong_ty_con',
      parentId: 1,
      active: true,
    },
    {
      id: 3,
      code: 'CON2',
      name: 'Cty Con 2',
      unitType: 'cong_ty_con',
      parentId: 1,
      active: false,
    },
    {
      id: 4,
      code: 'CN1',
      name: 'Chi nhánh 1',
      unitType: 'chi_nhanh',
      parentId: 2,
      active: true,
    },
  ];

  it('cong_ty_me: không có parent options (mảng rỗng)', () => {
    const result = getValidParentOptions('cong_ty_me', UNITS, null);
    expect(result).toHaveLength(0);
  });

  it('cong_ty_con: chỉ thấy cong_ty_me là parent hợp lệ', () => {
    const result = getValidParentOptions('cong_ty_con', UNITS, null);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(1);
    expect(result[0].label).toContain('Cty Me');
    expect(result[0].disabled).toBe(false);
  });

  it('chi_nhanh: thấy cả cong_ty_me và cong_ty_con là parent hợp lệ', () => {
    const result = getValidParentOptions('chi_nhanh', UNITS, null);
    expect(result).toHaveLength(3);
    // Kiểm tra có cả Cty Me và Cty Con
    expect(result.some((o) => o.label.includes('Cty Me'))).toBe(true);
    expect(result.some((o) => o.label.includes('Cty Con'))).toBe(true);
  });

  it('inactive unit hiển thị "Ngừng hoạt động" và disabled', () => {
    const result = getValidParentOptions('chi_nhanh', UNITS, null);
    const inactive = result.find((o) => o.value === 3);
    expect(inactive).toBeDefined();
    expect(inactive!.label).toContain('Ngừng hoạt động');
    expect(inactive!.disabled).toBe(true);
  });

  it('không bao gồm self và descendant khi editing', () => {
    const editing: OrgUnit = {
      id: 2,
      code: 'CON1',
      name: 'Cty Con 1',
      unitType: 'cong_ty_con',
      parentId: 1,
      active: true,
    };
    const result = getValidParentOptions('cong_ty_con', UNITS, editing);
    // Chỉ còn ME (id=1) vì CON2 (id=3) inactive nhưng vẫn hiển thị
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(1);
  });

  it('không bao gồm descendant khi editing (chi_nhanh không thấy con của nó)', () => {
    const editing: OrgUnit = {
      id: 2,
      code: 'CON1',
      name: 'Cty Con 1',
      unitType: 'cong_ty_con',
      parentId: 1,
      active: true,
    };
    const result = getValidParentOptions('chi_nhanh', UNITS, editing);
    // Với chi_nhanh: thấy ME (id=1) và CON2 (id=3). CON1 (id=2) bị exclude vì editing.
    // CN1 (id=4) là descendant của CON1 nên cũng bị exclude.
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.value).sort()).toEqual([1, 3]);
  });
});

// ---------------------------------------------------------------------------
// getTmpDefaults
// ---------------------------------------------------------------------------

describe('getTmpDefaults', () => {
  it('trả về taxCodeStatus = "pending"', () => {
    const result = getTmpDefaults();
    expect(result.taxCodeStatus).toBe('pending');
  });

  it('trả về tmpCodeLocked = true', () => {
    const result = getTmpDefaults();
    expect(result.tmpCodeLocked).toBe(true);
  });

  it('trả về taxCodeDueDate là ngày trong tương lai (7 ngày từ hôm nay)', () => {
    const result = getTmpDefaults();
    const dueDate = new Date(result.taxCodeDueDate);
    const now = new Date();
    const diffDays = Math.floor(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(8);
  });
});
