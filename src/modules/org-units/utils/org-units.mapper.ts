import type {
  OrgUnit,
  OrgUnitTreeNode,
  OrgUnitParent,
  OrgUnitCompany,
  OrgUnitManager,
} from '@/modules/org-units/types/org-units.types';
import type { OrgUnitFormValues } from '@/modules/org-units/schemas/org-unit.schema';

// ---------------------------------------------------------------------------
// Raw API shape (snake_case) — mirrors what BE sends
// ---------------------------------------------------------------------------

export type OrgUnitFromApi = Omit<
  OrgUnit,
  | 'unitType'
  | 'parentId'
  | 'active'
  | 'deletedAt'
  | 'archivedAt'
  | 'managerName'
  | 'taxCode'
  | 'address'
  | 'note'
  | 'orgUnitId'
  | 'description'
  | 'departmentType'
  | 'representativePersonId'
> & {
  unit_type?: string | null;
  parent_id?: number | null;
  org_unit_id?: number | null;
  department_type?: string | null;
  description?: string | null;
  address?: string | null;
  ward?: string | null;
  manager_employee_id?: number | null;
  representative_person_id?: number | null;
  manager_id?: number | null;
  status: number; // 1: active, 0: inactive
  deleted_at?: string | null;
  archived_at?: string | null;
  tax_code?: string | null;
  tax_code_status?: string | null;
  tax_code_status_label?: string | null;
  company_id?: number | null;
  tenant_id?: number | null;
  org_unit?: OrgUnitParent | null;
  manager?: OrgUnitManager | null;
  parent?: OrgUnitParent | null;
  company?: OrgUnitCompany | null;
};

export type OrgUnitTreeNodeFromApi = OrgUnitFromApi & {
  children?: OrgUnitTreeNodeFromApi[];
};

// ---------------------------------------------------------------------------
// remap: API → client
// ---------------------------------------------------------------------------

/**
 * BE có lúc trả tax_code_status bằng slug tiếng Việt (vd. 'cho_cap_nhat', 'da_cap_nhat')
 * thay vì khoá chuẩn 'pending'/'active' mà schema và UI đang dùng để so sánh.
 * Chuẩn hoá về khoá chuẩn để tránh lỗi validate/hiển thị sai khi sửa đơn vị dùng mã TMP.
 */
const TAX_CODE_STATUS_ALIASES: Record<string, string> = {
  pending: 'pending',
  cho_cap_nhat: 'pending',
  cho_cap: 'pending',
  active: 'active',
  da_cap_nhat: 'active',
  inactive: 'inactive',
};

function normalizeTaxCodeStatus(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  return TAX_CODE_STATUS_ALIASES[raw] ?? raw;
}

export function remap(unit: OrgUnitFromApi): OrgUnit {
  const {
    unit_type,
    parent_id,
    org_unit_id,
    department_type,
    description,
    address,
    manager_employee_id,
    status,
    deleted_at,
    archived_at,
    org_unit,
    manager,
    email,
    phone,
    province,
    district,
    ward,
    logo,
    tax_code,
    tax_code_status,
    tax_code_status_label,
    company_id,
    tenant_id,
    ...rest
  } = unit;

  return {
    ...rest,
    unitType: org_unit?.unit_type ?? unit_type ?? 'unknown',
    parentId: parent_id ?? null,
    active: status === 1,
    deletedAt: deleted_at ?? null,
    archivedAt: archived_at ?? null,
    managerName: manager?.full_name ?? undefined,
    taxCode: org_unit?.tax_code ?? tax_code ?? undefined,
    // BE có 3 field địa chỉ độc lập: address (địa chỉ cụ thể, bắt buộc),
    // ward (Phường/Xã) và district (Quận/Huyện) — xem
    // docs/api-evidence/org_units.md (2026-07-07). Sau sáp nhập 07/2025 không
    // còn cấp Quận/Huyện thật nên FE không thu thập/gửi `district` nữa, chỉ
    // đọc lại để hiển thị nếu bản ghi cũ còn dữ liệu.
    address: org_unit?.address ?? address ?? undefined,
    district: org_unit?.district ?? district ?? undefined,
    ward: org_unit?.ward ?? ward ?? undefined,
    email: org_unit?.email ?? email ?? undefined,
    phone: org_unit?.phone ?? phone ?? undefined,
    province: org_unit?.province ?? province ?? undefined,
    logo: org_unit?.logo ?? logo ?? undefined,
    taxCodeStatus: normalizeTaxCodeStatus(
      org_unit?.tax_code_status ?? tax_code_status,
    ),
    taxCodeStatusLabel:
      org_unit?.tax_code_status_label ?? tax_code_status_label ?? undefined,
    note: description ?? undefined,
    orgUnitId: org_unit_id ?? undefined,
    description: description ?? undefined,
    departmentType: department_type ?? undefined,
    managerEmployeeId: manager_employee_id ?? undefined,
    companyId: org_unit?.company_id ?? company_id ?? undefined,
    tenantId: org_unit?.tenant_id ?? tenant_id ?? undefined,
    // Map manager_id từ API
    managerId: unit.manager_id ?? org_unit?.manager_id ?? undefined,
    // Map representative name from manager field
    representativeName: manager?.full_name ?? undefined,
    org_unit,
    manager,
  };
}

export function remapTree(nodes: OrgUnitTreeNodeFromApi[]): OrgUnitTreeNode[] {
  return nodes.map((node) => ({
    ...remap(node),
    children: node.children ? remapTree(node.children) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// toPayload: form values → API request body
// ---------------------------------------------------------------------------

export function toPayload(values: OrgUnitFormValues) {
  return {
    code: values.code,
    name: values.name,
    unit_type: values.unitType,
    parent_id: values.parentId ?? null,
    manager_id: values.managerId ?? null,
    tax_code: values.taxCode || null,
    // tax_code_status/tax_code_due_date/tmp_code_locked KHÔNG gửi lên BE — xác minh
    // thật (docs/api-evidence/org_units.md mục 2) BE bỏ qua cả 3 field, tự tính lại
    // tax_code_status từ tax_code. Gửi lên chỉ là dead payload.
    email: values.email || null,
    phone: values.phone || null,
    // BE có 3 field địa chỉ độc lập: address (địa chỉ cụ thể, bắt buộc), ward
    // (Phường/Xã) và district (Quận/Huyện) — xem docs/api-evidence/org_units.md
    // (2026-07-07). Sau sáp nhập 07/2025 không còn cấp Quận/Huyện thật (chỉ
    // còn Tỉnh/Thành phố + Phường/Xã) nên FE không thu thập `district` nữa —
    // luôn gửi null. `district` cũ chỉ còn dùng tạm trong UI tra cứu "biết
    // địa chỉ cũ" để thu hẹp danh sách phường/xã cũ, không được submit lên BE.
    address: values.address || null,
    ward: values.ward || null,
    province: values.province || null,
    district: null,
    status: values.active ? 1 : 0,
  };
}
