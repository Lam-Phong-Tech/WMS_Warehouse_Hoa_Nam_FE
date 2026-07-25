export const EmployeeStatus = {
  INTERN: 0,
  PROBATION: 1,
  OFFICIAL: 2,
  SUSPENDED: 3,
  RESIGNED: 4,
  ARCHIVED: 5,
} as const;

export type EmployeeStatus =
  (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  [EmployeeStatus.INTERN]: 'Thực tập sinh',
  [EmployeeStatus.PROBATION]: 'Thử việc',
  [EmployeeStatus.OFFICIAL]: 'Chính thức',
  [EmployeeStatus.SUSPENDED]: 'Tạm ngưng',
  [EmployeeStatus.RESIGNED]: 'Nghỉ việc',
  [EmployeeStatus.ARCHIVED]: 'Lưu trữ',
};

/**
 * P0.1, P0.2: Defines valid state transitions for employee statuses.
 * This is the single source of truth for status changes.
 */
export const EMPLOYEE_STATUS_TRANSITIONS: Record<
  EmployeeStatus,
  EmployeeStatus[]
> = {
  [EmployeeStatus.INTERN]: [EmployeeStatus.PROBATION, EmployeeStatus.RESIGNED],
  [EmployeeStatus.PROBATION]: [
    EmployeeStatus.OFFICIAL,
    EmployeeStatus.SUSPENDED,
    EmployeeStatus.RESIGNED,
  ],
  [EmployeeStatus.OFFICIAL]: [
    EmployeeStatus.SUSPENDED,
    EmployeeStatus.RESIGNED,
  ],
  [EmployeeStatus.SUSPENDED]: [
    EmployeeStatus.OFFICIAL,
    EmployeeStatus.RESIGNED,
  ],
  [EmployeeStatus.RESIGNED]: [
    EmployeeStatus.OFFICIAL,
    EmployeeStatus.PROBATION,
  ], // Allow reactivation
  [EmployeeStatus.ARCHIVED]: [
    EmployeeStatus.OFFICIAL,
    EmployeeStatus.SUSPENDED,
  ], // Can restore from archive
};

/**
 * Trạng thái tài khoản đăng nhập (khác `EmployeeStatus` — trạng thái nhân sự).
 * BE (GET /employees, xác nhận qua swagger `/api/documentation` 2026-07-09):
 * query param tên là `status` (KHÔNG phải `account_status`), enum 0/1.
 */
export const AccountStatus = {
  LOCKED: 0,
  ACTIVE: 1,
} as const;

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  [AccountStatus.LOCKED]: 'Đã khóa',
  [AccountStatus.ACTIVE]: 'Đang hoạt động',
};

export type EmployeeManager = {
  id: number;
  full_name: string;
};

export type EmployeeAssignment = {
  id: number;
  employee_id: number;
  org_unit_id: number;
  department_id: number;
  position_id: number;
  manager_id?: number | null;
  is_primary: boolean;
  status: number;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  updated_at?: string;
  org_unit?: { id: number; name: string };
  department?: { id: number; name: string };
  position?: { id: number; name: string; grade?: number };
};

export type EmployeeStatusHistory = {
  id: number;
  employee_id: number;
  /** null khi đây là bản ghi trạng thái đầu tiên (nhân sự vừa được tạo) */
  old_status: EmployeeStatus | null;
  new_status: EmployeeStatus;
  effective_date: string;
  note?: string | null;
  /** BE trả field `reason` (snake_case) tương đương `note` */
  reason?: string | null;
  /** API list trả `changed_by`, API detail trả `created_by` */
  changed_by?: number | null;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
  updated_by?: number | null;
  employee?: { id: number; code: string; fullName: string } | null;
  changed_by_user?: { id: number; fullName: string } | null;
  /** Tên người tạo do BE trả trực tiếp (ưu tiên hơn changed_by_user object) */
  created_by_name?: string | null;
  /** Email người tạo — BE trả trong object `creator`, dùng để định danh chính xác người thực hiện. */
  created_by_email?: string | null;
};

// Re-export other types to avoid breaking imports, assuming they exist
export type Employee = {
  id: number;
  code: string;
  tenant_id?: number | null;
  fullName: string;
  gender?: number | null;
  birthday?: string | null;
  cccd?: string | null;
  personalTaxCode?: string | null;
  phone: string | null;
  email: string;
  address?: string | null;
  hireDate?: string | null;
  employeeStatus?: EmployeeStatus | null;
  manager_id?: number | null;
  user_id?: number | null;
  status: number;
  accountStatus?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  managerName?: string | null;
  assignments?: EmployeeAssignment[];
  primaryAssignment?: EmployeeAssignment;
};
export type EmployeePayload = Partial<{
  code: string;
  full_name: string;
  gender: number | null;
  birthday: string | null;
  cccd: string | null;
  personal_tax_code: string | null;
  phone: string | null;
  email: string;
  address: string | null;
  hire_date: string | null;
  employee_status: EmployeeStatus | null;
  manager_id: number | null;
  user_id: number | null;
  status: number;
  account_status: number | null;
  org_unit_id: number | null;
  department_id: number | null;
  position_id: number | null;
  /** Chỉ gửi khi tạo mới — BE tạo tài khoản đăng nhập atomic kèm nhân sự. */
  password: string;
}>;

export type EmployeeStatusChangePayload = {
  employee_status: EmployeeStatus;
  note: string | null;
  effective_date: string; // YYYY-MM-DD
};

/**
 * Response thật của POST /employees/{id}/account — KHÔNG phải Employee (`id`
 * ở đây là user id vừa tạo, không phải employee id). `temporaryPassword` chỉ
 * trả về đúng 1 lần trong response này, không lưu lại được ở đâu khác — FE
 * phải hiển thị ngay cho người thực hiện thao tác copy gửi thủ công.
 * Xem docs/employee-account-provisioning-flow.md mục 3.
 */
export type CreateAccountResult = {
  userId: number;
  email: string;
  passwordChangeRequired: boolean;
  temporaryPassword: string;
  /** Chưa phải link dùng được thật — chỉ mang tính minh hoạ (xem tài liệu mục 3). */
  inviteLink: string;
};

// P0.1: Gender bổ sung option "Khác" (2)
export const GENDER_LABELS: Record<number, string> = {
  0: 'Nữ',
  1: 'Nam',
  2: 'Khác',
};

export const getPrimaryAssignment = (
  e: Employee,
): EmployeeAssignment | undefined =>
  e.assignments?.find((a) => a.is_primary) ?? e.assignments?.[0];
