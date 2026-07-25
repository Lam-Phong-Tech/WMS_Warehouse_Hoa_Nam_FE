/** Bản ghi đơn vị tổ chức dùng cho màn demo CRUD cục bộ. */
export interface DemoOrgUnit {
  id: number;
  code: string;
  name: string;
  unitType: string;
  parentId?: number | null;
  note?: string;
  active: boolean;
}

/**
 * Trạng thái hiển thị đơn vị tổ chức (computed từ active + deletedAt + archivedAt).
 * - 'active'      : hoạt động bình thường
 * - 'inactive'    : đã vô hiệu (soft-delete pending / 14-ngày chờ)
 * - 'soft_deleted': đã xóa mềm (trong cửa sổ 14 ngày, có thể khôi phục)
 * - 'archived'    : đã lưu trữ vĩnh viễn (quá 14 ngày hoặc BE archive rõ ràng)
 */
export type OrgUnitStatus = 'active' | 'inactive' | 'soft_deleted' | 'archived';

/** Tính trạng thái hiển thị từ các trường BE. */
export function getOrgUnitStatus(unit: {
  active: boolean;
  deletedAt?: string | null;
  archivedAt?: string | null;
}): OrgUnitStatus {
  if (unit.archivedAt) return 'archived';
  if (unit.deletedAt) return 'soft_deleted';
  if (unit.active) return 'active';
  return 'inactive';
}

/** Label tiếng Việt cho OrgUnitStatus. */
export const ORG_UNIT_STATUS_LABELS: Record<OrgUnitStatus, string> = {
  active: 'Hoạt động',
  inactive: 'Ngừng hoạt động',
  soft_deleted: 'Đã xóa chờ khôi phục',
  archived: 'Lưu trữ',
};

/** Màu tag cho OrgUnitStatus. */
export const ORG_UNIT_STATUS_COLORS: Record<OrgUnitStatus, string> = {
  active: 'success',
  inactive: 'default',
  soft_deleted: 'warning',
  archived: 'error',
};

export interface OrgUnitParent {
  id: number;
  parent_id?: number | null;
  company_id?: number | null;
  tenant_id?: number | null;
  code?: string;
  unit_type?: string;
  name: string;
  tax_code?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  logo?: string | null;
  manager_id?: number | null;
  status?: number;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_reason?: string | null;
  restored_at?: string | null;
  restored_by?: string | null;
  archived_at?: string | null;
  anonymized_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  tax_code_status?: string | null;
  tax_code_due_date?: string | null;
  tmp_code_locked?: boolean | null;
  created_by?: string | null;
  updated_by?: string | null;
  tax_code_status_label?: string | null;
  logo_url?: string | null;
}

export interface OrgUnitCompany {
  id: number;
  parent_id?: number | null;
  company_id?: number | null;
  tenant_id?: number | null;
  code?: string;
  unit_type?: string;
  name: string;
  tax_code?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  province?: string | null;
  logo?: string | null;
  manager_id?: number | null;
  status?: number;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_reason?: string | null;
  restored_at?: string | null;
  restored_by?: string | null;
  archived_at?: string | null;
  anonymized_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  tax_code_status?: string | null;
  tax_code_due_date?: string | null;
  tmp_code_locked?: boolean | null;
  created_by?: string | null;
  updated_by?: string | null;
  tax_code_status_label?: string | null;
  logo_url?: string | null;
}

export interface OrgUnitManager {
  id: number;
  code?: string;
  tenant_id?: number | null;
  full_name: string;
  gender?: number | null;
  birthday?: string | null;
  cccd?: string | null;
  personal_tax_code?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  hire_date?: string | null;
  employee_status?: number | null;
  manager_id?: number | null;
  user_id?: number | null;
  status?: number | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_reason?: string | null;
  restored_at?: string | null;
  restored_by?: string | null;
  archived_at?: string | null;
  anonymized_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  account_status?: number | null;
}

/** Hình dạng đơn vị tổ chức trả về từ API (GET /org_units). */
export interface OrgUnit {
  id: number;
  code: string;
  name: string;
  unitType: string;
  parentId: number | null;
  note?: string;
  active: boolean;
  canRestore?: boolean;
  can_restore?: boolean;
  /** Người quản lý — ID nhân viên */
  managerId?: number | null;
  /** ISO timestamp — BE trả khi đơn vị bị xóa mềm (trong cửa sổ 14 ngày). */
  deletedAt?: string | null;
  /** ISO timestamp — BE trả khi đơn vị đã lưu trữ vĩnh viễn. */
  archivedAt?: string | null;
  managerName?: string | null;
  taxCode?: string | null;
  address?: string | null;
  ward?: string | null;
  email?: string | null;
  phone?: string | null;
  province?: string | null;
  district?: string | null;
  logo?: string | null;
  taxCodeStatus?: string | null;
  /** Hạn cập nhật MST (ISO date string) */
  taxCodeDueDate?: string | null;
  taxCodeStatusLabel?: string | null;
  /** Khoá mã tạm TMP (không cho phép sửa) */
  tmpCodeLocked?: boolean | null;
  employeeCount?: number | null;

  // Raw API fields that may be included in the response.
  tenantId?: number | null;
  companyId?: number | null;
  orgUnitId?: number | null;
  departmentType?: string | null;
  description?: string | null;
  managerEmployeeId?: number | null;
  representativeName?: string | null;
  parent?: OrgUnitParent | null;
  company?: OrgUnitCompany | null;
  manager?: OrgUnitManager | null;
  org_unit?: OrgUnitParent | null;
}

/** Một node trong cây đơn vị tổ chức từ API (GET /org_units/tree). */
export type OrgUnitTreeNode = OrgUnit & { children?: OrgUnitTreeNode[] };

export const UNIT_TYPE_OPTIONS = [
  { value: 'cong_ty_me', label: 'Công ty mẹ' },
  { value: 'cong_ty_con', label: 'Công ty con' },
  { value: 'chi_nhanh', label: 'Chi nhánh' },
];

export const UNIT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  UNIT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export const ORG_UNIT_STATUS_OPTIONS: {
  value: OrgUnitStatus;
  label: string;
}[] = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Ngừng hoạt động' },
  { value: 'soft_deleted', label: 'Đã xóa chờ khôi phục' },
  { value: 'archived', label: 'Lưu trữ' },
];
