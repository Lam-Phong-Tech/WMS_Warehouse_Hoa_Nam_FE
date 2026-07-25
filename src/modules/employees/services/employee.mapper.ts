import type { EmployeeFormValues } from '@/modules/employees/schemas/employee.schema';
import type {
  Employee,
  EmployeeAssignment,
  EmployeeManager,
  EmployeePayload,
  EmployeeStatus,
  EmployeeStatusHistory,
} from '@/modules/employees/types/employees.types';

export type EmployeeFromApi = {
  id: number;
  code: string;
  tenant_id?: number | null;
  full_name: string;
  gender?: number | null;
  birthday?: string | null;
  cccd?: string | null;
  personal_tax_code?: string | null;
  phone: string | null;
  email: string;
  address?: string | null;
  hire_date?: string | null;
  employee_status?: number | string | null;
  manager_id?: number | null;
  user_id?: number | null;
  status: number;
  /**
   * ⚠️ Field denormalized ở BE, KHÔNG đồng bộ khi tài khoản bị disable/restore
   * qua `PUT /users/{id}` (xác minh thật 2026-07-05, astrodev.test8.io.vn: disable
   * user → `user.status` đổi đúng nhưng `account_status` top-level vẫn giữ giá trị
   * cũ). Chỉ dùng làm fallback khi không có object `user` nested — nguồn đúng là
   * `user.status`, xem `remap()`.
   */
  account_status?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  manager?: EmployeeManager | null;
  user?: { id: number; email: string; status: number } | null;
  assignments?: EmployeeAssignment[];
};

export function remap(employee: EmployeeFromApi): Employee {
  const {
    full_name,
    hire_date,
    employee_status,
    account_status,
    manager,
    user,
    personal_tax_code,
    ...rest
  } = employee;
  const primaryAssignment =
    employee.assignments?.find((a) => a.is_primary) ??
    employee.assignments?.[0];
  return {
    ...rest,
    fullName: full_name,
    hireDate: hire_date,
    employeeStatus: Number(employee_status) as EmployeeStatus,
    // Ưu tiên `user.status` (nested, luôn đúng) — `account_status` top-level chỉ
    // dùng khi response không kèm object `user` (vd. field đó bị lược bớt).
    accountStatus: user ? user.status : account_status,
    managerName: manager?.full_name,
    personalTaxCode: personal_tax_code,
    primaryAssignment,
  };
}

/**
 * Map form -> payload cho POST/PUT /employees.
 *
 * Không gửi `org_unit_id`/`department_id`/`position_id`: xác minh thật qua BE
 * (astrodev.test8.io.vn, 2026-07-05) cho thấy BE bỏ qua hoàn toàn 3 field này —
 * cả khi tạo mới lẫn khi update, `assignments` của nhân sự vẫn rỗng. Việc gán
 * đơn vị/phòng ban/chức vụ phải đi qua `POST /employee-assignments` riêng
 * (xem `useCreateAssignment` — gọi ngay sau khi tạo nhân sự thành công).
 * `manager_id` thì BE có áp dụng thật (đã xác minh), nên vẫn gửi bình thường.
 */
export function toEmployeePayload(v: EmployeeFormValues): EmployeePayload {
  return {
    code: v.code || undefined,
    full_name: v.fullName,
    email: v.email,
    phone: v.phone || null,
    gender: v.gender,
    birthday: v.birthday ? v.birthday.format('YYYY-MM-DD') : null,
    cccd: v.cccd || null,
    personal_tax_code: v.personalTaxCode || null,
    address: v.address || null,
    manager_id: v.managerId ?? null,
    hire_date: v.hireDate ? v.hireDate.format('YYYY-MM-DD') : null,
    status: v.active ? 1 : 0,
    employee_status: (v.employeeStatus != null
      ? Number(v.employeeStatus)
      : null) as EmployeeStatus | null,
    password: v.password || undefined,
  };
}

export type EmployeeStatusHistoryFromApi = Omit<
  EmployeeStatusHistory,
  'employee' | 'changed_by_user' | 'created_by_email'
> & {
  employee?: { id: number; code: string; full_name: string } | null;
  changed_by_user?: { id: number; full_name: string } | null;
  /** BE trả người tạo trong object `creator` (kèm email), không phải `changed_by_user`. */
  creator?: { id: number; email: string } | null;
};

/** BE trả nested employee/changed_by_user với `full_name` (snake_case), không phải `fullName`. */
export function remapStatusHistory(
  item: EmployeeStatusHistoryFromApi,
): EmployeeStatusHistory {
  return {
    ...item,
    employee: item.employee
      ? {
          id: item.employee.id,
          code: item.employee.code,
          fullName: item.employee.full_name,
        }
      : null,
    changed_by_user: item.changed_by_user
      ? {
          id: item.changed_by_user.id,
          fullName: item.changed_by_user.full_name,
        }
      : null,
    created_by_email: item.creator?.email ?? null,
  };
}
