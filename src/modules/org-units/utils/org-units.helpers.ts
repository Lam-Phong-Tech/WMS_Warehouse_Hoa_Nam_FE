import type {
  OrgUnit,
  OrgUnitTreeNode,
  OrgUnitStatus,
} from '@/modules/org-units/types/org-units.types';
import { getOrgUnitStatus } from '@/modules/org-units/types/org-units.types';

// ---------------------------------------------------------------------------
// Tree helpers (P2.1)
// ---------------------------------------------------------------------------

/** Trạng thái ẩn khỏi cây/bảng theo mặc định — chỉ hiện khi người dùng chủ động
 * lọc đúng trạng thái đó qua bộ lọc "Trạng thái" (STATUS_FILTER_OPTIONS). */
export const HIDDEN_BY_DEFAULT_STATUSES: OrgUnitStatus[] = [
  'soft_deleted',
  'archived',
];

/** Loại bỏ đệ quy các node có trạng thái nằm trong danh sách ẩn — dùng để
 * không làm rối cây/bảng bằng các đơn vị đã xóa mềm/lưu trữ khi chưa lọc rõ. */
/**
 * Đơn vị có được phép chọn checkbox hàng loạt hay không — dùng cho
 * `getCheckboxProps` của OrgUnitsTable. Ancestor (Công ty mẹ/con) trong
 * Branch mode và mọi đơn vị không active (inactive/soft_deleted/archived)
 * đều không được chọn — hành động hàng loạt duy nhất hiện có ("Vô hiệu hóa")
 * chỉ áp dụng cho đơn vị đang active.
 */
export function isBulkSelectable(
  record: OrgUnitTreeNode,
  isBranchMode: boolean,
): boolean {
  if (isBranchMode && record.unitType !== 'chi_nhanh') return false;
  return getOrgUnitStatus(record) === 'active';
}

export function excludeStatuses(
  nodes: OrgUnitTreeNode[],
  hidden: OrgUnitStatus[],
): OrgUnitTreeNode[] {
  return nodes.reduce<OrgUnitTreeNode[]>((acc, node) => {
    if (hidden.includes(getOrgUnitStatus(node))) return acc;
    acc.push({
      ...node,
      children: node.children?.length
        ? excludeStatuses(node.children, hidden)
        : node.children,
    });
    return acc;
  }, []);
}

/**
 * Flatten tree structure to array for client-side operations.
 */
export function flattenTree(nodes: OrgUnitTreeNode[]): OrgUnit[] {
  const out: OrgUnit[] = [];
  const walk = (list: OrgUnitTreeNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/**
 * Gộp danh sách đơn vị đã xóa mềm/lưu trữ (từ `/org_units/trashed`) vào cây
 * chính (từ `/org_units/tree`) — BE loại các bản ghi này khỏi endpoint tree
 * theo soft-delete scope mặc định nên phải merge thủ công ở FE để filter
 * "Đã xóa chờ khôi phục"/"Lưu trữ" có dữ liệu thật (xác minh qua API thật
 * 2026-07-08, xem orgUnitsService.trashed).
 *
 * Mỗi đơn vị trashed được gắn vào đúng node cha (nếu cha còn active và có
 * trong cây); nếu không tìm thấy cha (cha cũng bị xóa, hoặc `parentId` null)
 * thì thêm vào làm node gốc.
 */
export function mergeTrashedIntoTree(
  tree: OrgUnitTreeNode[],
  trashedUnits: OrgUnit[],
): OrgUnitTreeNode[] {
  if (!trashedUnits.length) return tree;

  // Clone nông theo từng cấp để không mutate `tree` gốc (React Query cache).
  const cloneDeep = (nodes: OrgUnitTreeNode[]): OrgUnitTreeNode[] =>
    nodes.map((n) => ({
      ...n,
      children: n.children?.length ? cloneDeep(n.children) : n.children,
    }));
  const result = cloneDeep(tree);

  const findNode = (
    nodes: OrgUnitTreeNode[],
    id: number,
  ): OrgUnitTreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children?.length) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const roots: OrgUnitTreeNode[] = [];
  for (const unit of trashedUnits) {
    const trashedNode: OrgUnitTreeNode = { ...unit, children: [] };
    const parent = unit.parentId ? findNode(result, unit.parentId) : null;
    if (parent) {
      // P1 Fix: Check if trashed node already exists in parent's children to avoid duplicates
      const exists = parent.children?.some((c) => c.id === unit.id);
      if (!exists) {
        parent.children = [...(parent.children ?? []), trashedNode];
      }
    } else {
      // Check if trashed node already exists at root level
      const existsAtRoot = roots.some((r) => r.id === unit.id);
      if (!existsAtRoot) {
        roots.push(trashedNode);
      }
    }
  }

  return [...result, ...roots];
}

/**
 * Count children by type for a given parent node.
 */
export function countChildren(
  nodes: OrgUnitTreeNode[],
  parentId: number,
): { companies: number; branches: number } {
  let companies = 0;
  let branches = 0;
  const walk = (list: OrgUnitTreeNode[]) => {
    for (const node of list) {
      if (node.parentId === parentId) {
        if (node.unitType === 'cong_ty_con') companies++;
        if (node.unitType === 'chi_nhanh') branches++;
      }
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return { companies, branches };
}

// ---------------------------------------------------------------------------
// Filter/search helpers (P2.1)
// ---------------------------------------------------------------------------

export interface OrgUnitFilterParams {
  keyword?: string;
  unitType?: string;
  province?: string;
  status?: OrgUnitStatus;
  company?: number;
}

/**
 * Client-side filter for org units (used in tree view).
 */
export function filterOrgUnits(
  units: OrgUnit[],
  filters: OrgUnitFilterParams,
): OrgUnit[] {
  let result = units;

  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase();
    result = result.filter(
      (u) =>
        u.name.toLowerCase().includes(kw) ||
        u.code.toLowerCase().includes(kw) ||
        u.province?.toLowerCase().includes(kw) ||
        u.managerName?.toLowerCase().includes(kw) ||
        u.manager?.full_name?.toLowerCase().includes(kw),
    );
  }

  if (filters.unitType) {
    result = result.filter((u) => u.unitType === filters.unitType);
  }

  if (filters.province) {
    result = result.filter((u) => u.province === filters.province);
  }

  if (filters.status) {
    result = result.filter((u) => getOrgUnitStatus(u) === filters.status);
  }

  if (filters.company) {
    const companyId = filters.company;
    result = result.filter((u) => {
      // Nếu unit là công ty mẹ và có id === companyId
      if (u.id === companyId) return true;
      // Nếu unit có parent chain dẫn đến companyId
      // (cần parentId để check — nhưng filterOrgUnits nhận flat array, không có parent chain,
      //  nên chỉ filter được các unit có parentId === companyId)
      if (u.parentId === companyId) return true;
      return false;
    });
  }

  return result;
}

/**
 * Trả về id của node và toàn bộ hậu duệ (dùng khi lọc bảng theo đơn vị đang
 * chọn trên cây trong layout split-view WF-02).
 */
export function getSubtreeIds(
  nodes: OrgUnitTreeNode[],
  rootId: number,
): Set<number> {
  const ids = new Set<number>();
  const collect = (list: OrgUnitTreeNode[]) => {
    for (const node of list) {
      ids.add(node.id);
      if (node.children?.length) collect(node.children);
    }
  };
  const find = (list: OrgUnitTreeNode[]): OrgUnitTreeNode[] | null => {
    for (const node of list) {
      if (node.id === rootId) return [node];
      if (node.children?.length) {
        const found = find(node.children);
        if (found) return found;
      }
    }
    return null;
  };
  const root = find(nodes);
  if (root) collect(root);
  return ids;
}

export interface OrgUnitTreeFilterParams {
  keyword?: string;
  unitType?: string;
  province?: string;
  status?: OrgUnitStatus;
  company?: number;
}

function matchesTreeCriteria(
  node: OrgUnitTreeNode,
  criteria: OrgUnitTreeFilterParams,
): boolean {
  if (criteria.unitType && node.unitType !== criteria.unitType) return false;
  if (criteria.province && node.province !== criteria.province) return false;
  if (criteria.status && getOrgUnitStatus(node) !== criteria.status)
    return false;
  // Company filter được xử lý riêng ở matchCompanyFilter trong filterOrgUnitTree
  return true;
}

//// Company filter logic được xử lý trực tiếp trong filterOrgUnitTree qua matchCompanyFilter
//// Không cần hàm isDescendantOf riêng

/**
 * Lọc cây đệ quy theo từ khoá + unitType/province/status, giữ nguyên cấu
 * trúc cha-con. Giữ node nếu chính nó khớp toàn bộ tiêu chí, hoặc có con
 * cháu khớp (dùng chung cho tree view và table view dạng cây).
 *
 * **Nguyên tắc lọc children khi node match:**
 * - Nếu **có keyword filter**: node khớp keyword → giữ nguyên children (context
 *   search, user muốn thấy toàn bộ subtree của node khớp).
 * - Nếu **chỉ có non-keyword filter** (status/unitType/province): children
 *   luôn được lọc đệ quy, kể cả khi node cha match. Điều này tránh lỗi semantics:
 *   chọn filter "Hoạt động" không còn hiển thị con inactive/soft-deleted sau
 *   khi expand (P1 fix).
 */
export function filterOrgUnitTree(
  nodes: OrgUnitTreeNode[],
  criteria: OrgUnitTreeFilterParams,
  // Đánh dấu node hiện tại có phải là hậu duệ (ở bất kỳ cấp nào) của company
  // đang chọn hay không — được truyền xuống đệ quy từ node cha đã match
  // `id === criteria.company`. Nhờ vậy chọn "Công ty mẹ A" vẫn giữ được chi
  // nhánh C dù C nằm dưới Công ty con B (cháu của A), và chọn thẳng "Công ty
  // con B" vẫn hiển thị đúng các chi nhánh trực thuộc B (P0/P1 fix — trước đó
  // chỉ so khớp `parentId === company` nên bỏ sót các cấp sâu hơn 1).
  ancestorIsInSelectedCompany = false,
): OrgUnitTreeNode[] {
  const kw = criteria.keyword?.trim().toLowerCase();
  const hasCompanyFilter = !!criteria.company;

  return nodes.reduce<OrgUnitTreeNode[]>((acc, node) => {
    const matchKeyword =
      !kw ||
      node.code?.toLowerCase().includes(kw) ||
      node.name?.toLowerCase().includes(kw);
    const matchNonKeyword = matchesTreeCriteria(node, criteria);
    // Company filter: node match nếu chính nó là company được chọn, hoặc là
    // hậu duệ (bất kỳ cấp nào) của company đó.
    const matchCompanyFilter =
      !hasCompanyFilter ||
      ancestorIsInSelectedCompany ||
      node.id === criteria.company!;
    const match = matchKeyword && matchNonKeyword && matchCompanyFilter;

    const childAncestorIsInSelectedCompany =
      ancestorIsInSelectedCompany ||
      (hasCompanyFilter && node.id === criteria.company!);

    let filteredChildren: OrgUnitTreeNode[] | undefined = node.children;
    if (node.children?.length) {
      filteredChildren = filterOrgUnitTree(
        node.children,
        criteria,
        childAncestorIsInSelectedCompany,
      );
    }

    const hasFilteredChildren = !!(
      filteredChildren && filteredChildren.length > 0
    );

    if (match || hasFilteredChildren) {
      let children: OrgUnitTreeNode[] | undefined;

      if (kw && !matchNonKeyword && hasFilteredChildren) {
        // Node không khớp non-keyword criteria, nhưng có con cháu khớp keyword
        // → dùng filteredChildren (chỉ giữ nhánh con khớp).
        children = filteredChildren;
      } else if (match) {
        if (kw || hasCompanyFilter) {
          // Có keyword filter hoặc company filter → giữ nguyên children (context search)
          children = node.children;
        } else {
          // Chỉ có non-keyword filter → children phải được lọc
          children = filteredChildren;
        }
      } else {
        // Không match, chỉ giữ nhờ có con cháu khớp
        children = filteredChildren;
      }

      acc.push({ ...node, children });
    }

    return acc;
  }, []);
}

/**
 * Sắp xếp cây đơn vị theo field/order, đệ quy ở mọi cấp (giữ nguyên cấu trúc
 * cha-con). Dùng ở table view để sort trên toàn bộ dataset đã tải (cây tải
 * hết 1 lần từ `/org_units/tree`, không phân trang server-side) — tránh lỗi
 * sort chỉ đúng trong trang hiện tại nếu áp dụng sorter của antd sau khi đã
 * cắt trang.
 */
export function sortOrgUnitTree(
  nodes: OrgUnitTreeNode[],
  field: string | undefined,
  order: 'asc' | 'desc' | undefined,
  nameById: Map<number, string>,
): OrgUnitTreeNode[] {
  if (!field || !order) return nodes;
  const dir = order === 'asc' ? 1 : -1;

  const compare = (a: OrgUnitTreeNode, b: OrgUnitTreeNode): number => {
    switch (field) {
      case 'code':
        return a.code.localeCompare(b.code) * dir;
      case 'name':
        return a.name.localeCompare(b.name) * dir;
      case 'unitType':
        return a.unitType.localeCompare(b.unitType) * dir;
      case 'parentUnit': {
        const an = a.parentId ? (nameById.get(a.parentId) ?? '') : '';
        const bn = b.parentId ? (nameById.get(b.parentId) ?? '') : '';
        return an.localeCompare(bn) * dir;
      }
      case 'province':
        return (a.province ?? '').localeCompare(b.province ?? '') * dir;
      case 'representative': {
        const an = a.representativeName ?? a.manager?.full_name ?? '';
        const bn = b.representativeName ?? b.manager?.full_name ?? '';
        return an.localeCompare(bn) * dir;
      }
      case 'status':
        return getOrgUnitStatus(a).localeCompare(getOrgUnitStatus(b)) * dir;
      default:
        return 0;
    }
  };

  const sortLevel = (list: OrgUnitTreeNode[]): OrgUnitTreeNode[] =>
    [...list].sort(compare).map((n) => ({
      ...n,
      children: n.children?.length ? sortLevel(n.children) : n.children,
    }));

  return sortLevel(nodes);
}

/**
 * Extract unique provinces from org units list.
 */
export function extractProvinceOptions(
  units: OrgUnit[],
): { value: string; label: string }[] {
  const provinces = new Set(
    units.map((u) => u.province).filter((p): p is string => Boolean(p)),
  );
  return [...provinces].sort().map((p) => ({ value: p, label: p }));
}
