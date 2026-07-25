import { describe, it, expect } from 'vitest';
import {
  flattenTree,
  countChildren,
  filterOrgUnits,
  filterOrgUnitTree,
  getSubtreeIds,
  mergeTrashedIntoTree,
  extractProvinceOptions,
} from './org-units.helpers';
import type {
  OrgUnitTreeNode,
  OrgUnit,
} from '@/modules/org-units/types/org-units.types';

const MOCK_TREE: OrgUnitTreeNode[] = [
  {
    id: 1,
    code: 'CTY-ME',
    name: 'Tổng công ty',
    unitType: 'cong_ty_me',
    parentId: null,
    active: true,
    province: 'Hà Nội',
    children: [
      {
        id: 2,
        code: 'CTY-CON-1',
        name: 'Công ty con 1',
        unitType: 'cong_ty_con',
        parentId: 1,
        active: true,
        province: 'Hà Nội',
        children: [
          {
            id: 3,
            code: 'CN-1',
            name: 'Chi nhánh 1',
            unitType: 'chi_nhanh',
            parentId: 2,
            active: true,
            province: 'Đà Nẵng',
            children: [],
          },
        ],
      },
      {
        id: 4,
        code: 'CTY-CON-2',
        name: 'Công ty con 2',
        unitType: 'cong_ty_con',
        parentId: 1,
        active: false,
        deletedAt: '2026-06-28T12:00:00Z',
        province: 'Hồ Chí Minh',
        children: [],
      },
    ],
  },
];

describe('flattenTree', () => {
  it('flattens nested tree into flat array', () => {
    const result = flattenTree(MOCK_TREE);
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
    expect(result[2].id).toBe(3);
    expect(result[3].id).toBe(4);
  });

  it('returns empty array for empty tree', () => {
    expect(flattenTree([])).toHaveLength(0);
  });

  it('handles single node without children', () => {
    const single: OrgUnitTreeNode[] = [
      {
        id: 1,
        code: 'A',
        name: 'A',
        unitType: 'cong_ty_me',
        parentId: null,
        active: true,
      },
    ];
    expect(flattenTree(single)).toHaveLength(1);
  });
});

describe('countChildren', () => {
  it('counts companies and branches for a parent', () => {
    const result = countChildren(MOCK_TREE, 1);
    expect(result.companies).toBe(2); // CTY-CON-1, CTY-CON-2
    expect(result.branches).toBe(0);
  });

  it('counts branches for a child node', () => {
    const result = countChildren(MOCK_TREE, 2);
    expect(result.companies).toBe(0);
    expect(result.branches).toBe(1); // CN-1
  });

  it('returns zero for leaf node', () => {
    const result = countChildren(MOCK_TREE, 3);
    expect(result.companies).toBe(0);
    expect(result.branches).toBe(0);
  });

  it('returns zero for non-existent parent', () => {
    const result = countChildren(MOCK_TREE, 999);
    expect(result.companies).toBe(0);
    expect(result.branches).toBe(0);
  });
});

describe('filterOrgUnits', () => {
  const flatUnits = flattenTree(MOCK_TREE);

  it('returns all units when no filters', () => {
    expect(filterOrgUnits(flatUnits, {})).toHaveLength(4);
  });

  it('filters by keyword (name)', () => {
    const result = filterOrgUnits(flatUnits, { keyword: 'Công ty con' });
    expect(result).toHaveLength(2);
    expect(result.map((u) => u.id)).toEqual([2, 4]);
  });

  it('filters by keyword (code)', () => {
    const result = filterOrgUnits(flatUnits, { keyword: 'CN-1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('filters by keyword (province)', () => {
    const result = filterOrgUnits(flatUnits, { keyword: 'Đà Nẵng' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('filters by unitType', () => {
    const result = filterOrgUnits(flatUnits, { unitType: 'chi_nhanh' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('filters by province', () => {
    const result = filterOrgUnits(flatUnits, { province: 'Hà Nội' });
    expect(result).toHaveLength(2);
    expect(result.map((u) => u.id)).toEqual([1, 2]);
  });

  it('filters by status: soft_deleted', () => {
    const result = filterOrgUnits(flatUnits, { status: 'soft_deleted' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
  });

  it('filters by status: active', () => {
    const result = filterOrgUnits(flatUnits, { status: 'active' });
    expect(result).toHaveLength(3);
    expect(result.map((u) => u.id)).toEqual([1, 2, 3]);
  });

  it('combines multiple filters', () => {
    const result = filterOrgUnits(flatUnits, {
      unitType: 'cong_ty_con',
      province: 'Hà Nội',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('returns empty array when no match', () => {
    const result = filterOrgUnits(flatUnits, { keyword: 'xyz' });
    expect(result).toHaveLength(0);
  });
});

describe('filterOrgUnitTree', () => {
  // BE không có param status cho soft_deleted/archived (chỉ nhận 0/1) — table
  // view (dựng lại từ P0.1) phải tự lọc 2 trạng thái này client-side dựa trên
  // toàn bộ cây, đây là hàm thực hiện việc đó (org-units.service.ts:43-47).
  const ARCHIVED_TREE: OrgUnitTreeNode[] = [
    ...MOCK_TREE,
    {
      id: 5,
      code: 'CTY-ARCHIVED',
      name: 'Công ty đã lưu trữ',
      unitType: 'cong_ty_con',
      parentId: null,
      active: false,
      archivedAt: '2026-06-01T00:00:00Z',
      children: [],
    },
  ];

  it('không lọc gì thì giữ nguyên cấu trúc cây (children lồng nhau)', () => {
    const result = filterOrgUnitTree(MOCK_TREE, {});
    expect(result).toEqual(MOCK_TREE);
    expect(result[0].children?.[0].children?.[0].id).toBe(3);
  });

  it('lọc status: soft_deleted — giữ node khớp dù nằm sâu trong cây, loại bỏ node không khớp', () => {
    const result = filterOrgUnitTree(ARCHIVED_TREE, { status: 'soft_deleted' });
    const ids = flattenTree(result).map((u) => u.id);
    // id 4 (Công ty con 2, deletedAt) khớp; id 1 (Tổng công ty) được giữ lại
    // chỉ vì có hậu duệ khớp — không phải vì bản thân nó soft_deleted.
    expect(ids).toContain(4);
    expect(ids).not.toContain(2); // Công ty con 1 — active, không khớp
    expect(ids).not.toContain(3); // Chi nhánh 1 — active, không khớp
    expect(ids).not.toContain(5); // archived, không phải soft_deleted
  });

  it('lọc status: archived — hoạt động dù BE không có param tương ứng', () => {
    const result = filterOrgUnitTree(ARCHIVED_TREE, { status: 'archived' });
    const ids = flattenTree(result).map((u) => u.id);
    expect(ids).toEqual([5]);
  });

  it('lọc theo keyword giữ đường dẫn cha (không khớp) tới node khớp, và giữ nguyên children của node khớp trực tiếp', () => {
    const result = filterOrgUnitTree(MOCK_TREE, { keyword: 'Công ty con 1' });
    // Root "Tổng công ty" không khớp keyword nhưng vẫn được giữ vì có hậu
    // duệ khớp (id 2) — nếu không, cây sẽ mất luôn "đường đi" tới node khớp.
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].children).toHaveLength(1);

    const matchedNode = result[0].children?.[0];
    expect(matchedNode?.id).toBe(2);
    // "Công ty con 1" khớp trực tiếp nên children của nó (Chi nhánh 1) vẫn
    // được giữ nguyên dù bản thân "Chi nhánh 1" không chứa từ khoá.
    expect(matchedNode?.children).toHaveLength(1);
    expect(matchedNode?.children?.[0].id).toBe(3);
  });

  it('lọc status: active — children của node khớp cũng phải được lọc (P1 fix: không giữ children không khớp)', () => {
    // MOCK_TREE: node 1 (active), node 2 (active), node 3 (active), node 4 (soft_deleted)
    // Filter status='active' → node 1, 2, 3 khớp, node 4 không khớp.
    // Node 1 có children gồm node 2 (active) và node 4 (soft_deleted).
    // Node 4 không khớp → phải bị loại khỏi children của node 1.
    const result = filterOrgUnitTree(MOCK_TREE, { status: 'active' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    // Node 1 match active, nhưng children phải được lọc — chỉ giữ node 2 (active),
    // loại node 4 (soft_deleted).
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children?.[0].id).toBe(2);
    // Node 2 match active, children (node 3) cũng phải được lọc.
    // Node 3 cũng active nên vẫn được giữ.
    expect(result[0].children?.[0].children).toHaveLength(1);
    expect(result[0].children?.[0].children?.[0].id).toBe(3);
  });

  it('lọc status: active kết hợp keyword — node khớp keyword giữ nguyên children (context search)', () => {
    // Filter status='active' + keyword='Công ty con 1'
    // Node 2 khớp cả keyword và status → giữ nguyên children (node 3 dù không khớp keyword).
    // Node 1 không khớp keyword nhưng có con khớp → giữ với children đã lọc.
    // Node 4 không khớp status → bị loại khỏi children của node 1.
    const result = filterOrgUnitTree(MOCK_TREE, {
      status: 'active',
      keyword: 'Công ty con 1',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children?.[0].id).toBe(2);
    // Node 2 khớp keyword → giữ nguyên children (node 3) dù node 3 không khớp keyword
    expect(result[0].children?.[0].children).toHaveLength(1);
    expect(result[0].children?.[0].children?.[0].id).toBe(3);
  });

  // QA P0/P1: filter theo Công ty mẹ (id 1) phải thấy chi nhánh cháu (id 3)
  // nằm dưới Công ty con 1 (id 2), không chỉ con trực tiếp.
  it('lọc theo company = công ty mẹ: giữ toàn bộ chi nhánh cháu ở mọi cấp sâu hơn', () => {
    const result = filterOrgUnitTree(MOCK_TREE, { company: 1 });
    const ids = flattenTree(result).map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining([1, 2, 3, 4]));
  });

  // QA P0/P1: filter theo Công ty con (id 2) chỉ thấy chi nhánh trực thuộc
  // công ty con đó (id 3), không lẫn công ty con khác (id 4) hay chi nhánh
  // không liên quan.
  it('lọc theo company = công ty con: chỉ giữ công ty con đó và chi nhánh trực thuộc', () => {
    const result = filterOrgUnitTree(MOCK_TREE, { company: 2 });
    const ids = flattenTree(result).map((u) => u.id);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
    expect(ids).not.toContain(4);
  });

  it('lọc theo company không tồn tại: trả về cây rỗng', () => {
    const result = filterOrgUnitTree(MOCK_TREE, { company: 999 });
    expect(result).toHaveLength(0);
  });

  it('kết hợp company + unitType: filter công ty mẹ + unitType chi_nhanh chỉ giữ chi nhánh cháu (node cha trên đường đi vẫn giữ để hiện cấu trúc cây)', () => {
    const result = filterOrgUnitTree(MOCK_TREE, {
      company: 1,
      unitType: 'chi_nhanh',
    });
    const ids = flattenTree(result).map((u) => u.id);
    expect(ids).toContain(3); // Chi nhánh 1 — khớp cả company lẫn unitType
    expect(ids).toContain(2); // Công ty con 1 — giữ vì là đường dẫn cha tới node 3
    expect(ids).not.toContain(4); // Công ty con 2 — không có chi nhánh khớp, phải loại
  });
});

describe('getSubtreeIds', () => {
  it('trả về id của node và toàn bộ hậu duệ ở mọi cấp', () => {
    const ids = getSubtreeIds(MOCK_TREE, 1);
    expect(ids).toEqual(new Set([1, 2, 3, 4]));
  });

  it('trả về đúng subtree của công ty con (không bao gồm công ty con khác)', () => {
    const ids = getSubtreeIds(MOCK_TREE, 2);
    expect(ids).toEqual(new Set([2, 3]));
  });

  it('trả về set rỗng nếu rootId không tồn tại', () => {
    const ids = getSubtreeIds(MOCK_TREE, 999);
    expect(ids.size).toBe(0);
  });
});

describe('mergeTrashedIntoTree', () => {
  // Xác minh thật qua API 2026-07-08: GET /org_units/tree trả 13/13 node đều
  // active (deleted_at/archived_at null) — BE dùng soft-delete scope mặc
  // định nên loại hẳn bản ghi trashed khỏi endpoint tree. Chỉ GET
  // /org_units/trashed mới thấy chúng → phải merge thủ công ở FE.
  const trashedWithKnownParent: OrgUnit = {
    id: 100,
    code: 'CN-TRASHED',
    name: 'Chi nhánh đã xóa',
    unitType: 'chi_nhanh',
    parentId: 1, // "Tổng công ty" — tồn tại trong MOCK_TREE
    active: false,
    deletedAt: '2026-07-01T00:00:00Z',
  } as OrgUnit;

  const trashedOrphan: OrgUnit = {
    id: 101,
    code: 'CTY-TRASHED-ORPHAN',
    name: 'Công ty mồ côi đã xóa',
    unitType: 'cong_ty_me',
    parentId: 999, // không tồn tại trong cây (cha cũng đã bị xóa)
    active: false,
    deletedAt: '2026-07-01T00:00:00Z',
  } as OrgUnit;

  it('không có trashed thì trả về nguyên cây', () => {
    expect(mergeTrashedIntoTree(MOCK_TREE, [])).toBe(MOCK_TREE);
  });

  it('gắn node trashed vào đúng cha nếu cha còn tồn tại trong cây', () => {
    const result = mergeTrashedIntoTree(MOCK_TREE, [trashedWithKnownParent]);
    expect(result).toHaveLength(1); // vẫn 1 root, không tạo root mới
    const root = result[0];
    const trashedChild = root.children?.find((c) => c.id === 100);
    expect(trashedChild).toBeDefined();
    expect(trashedChild?.name).toBe('Chi nhánh đã xóa');
    // Không mutate MOCK_TREE gốc.
    expect(MOCK_TREE[0].children?.some((c) => c.id === 100)).toBe(false);
  });

  it('thêm làm root mới nếu không tìm thấy cha trong cây', () => {
    const result = mergeTrashedIntoTree(MOCK_TREE, [trashedOrphan]);
    expect(result).toHaveLength(2);
    expect(result[1].id).toBe(101);
  });

  it('sau khi merge, filterOrgUnitTree lọc status archived/soft_deleted ra đúng node trashed', () => {
    const merged = mergeTrashedIntoTree(MOCK_TREE, [
      trashedWithKnownParent,
      trashedOrphan,
    ]);
    const result = filterOrgUnitTree(merged, { status: 'soft_deleted' });
    const ids = flattenTree(result).map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining([100, 101]));
  });
});

describe('extractProvinceOptions', () => {
  const flatUnits = flattenTree(MOCK_TREE);

  it('extracts unique provinces sorted alphabetically', () => {
    const result = extractProvinceOptions(flatUnits);
    expect(result).toEqual([
      { value: 'Hà Nội', label: 'Hà Nội' },
      { value: 'Hồ Chí Minh', label: 'Hồ Chí Minh' },
      { value: 'Đà Nẵng', label: 'Đà Nẵng' },
    ]);
  });

  it('returns empty array when no provinces', () => {
    const units: OrgUnit[] = [
      {
        id: 1,
        code: 'A',
        name: 'A',
        unitType: 'cong_ty_me',
        parentId: null,
        active: true,
      },
    ];
    expect(extractProvinceOptions(units)).toEqual([]);
  });

  it('deduplicates provinces', () => {
    const units: OrgUnit[] = [
      {
        id: 1,
        code: 'A',
        name: 'A',
        unitType: 'cong_ty_me',
        parentId: null,
        active: true,
        province: 'Hà Nội',
      },
      {
        id: 2,
        code: 'B',
        name: 'B',
        unitType: 'cong_ty_con',
        parentId: 1,
        active: true,
        province: 'Hà Nội',
      },
    ];
    expect(extractProvinceOptions(units)).toHaveLength(1);
  });
});
