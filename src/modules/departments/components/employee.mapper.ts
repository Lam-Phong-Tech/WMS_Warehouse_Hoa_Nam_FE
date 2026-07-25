import type { EmployeeFormValues } from '@/modules/employees/schemas/employee.schema';
import type {
  EmployeePayload,
  EmployeeStatus,
} from '@/modules/employees/types/employees.types';

export function toEmployeePayload(v: EmployeeFormValues): EmployeePayload {
  return {
    code: v.code || undefined,
    full_name: v.fullName,
    email: v.email,
    phone: v.phone || null,
    gender: v.gender,
    birthday: v.birthday ? v.birthday.format('YYYY-MM-DD') : null,
    cccd: v.cccd || null,
    address: v.address || null,
    org_unit_id: v.orgUnitId ?? null,
    department_id: v.departmentId ?? null,
    position_id: v.positionId ?? null,
    manager_id: v.managerId ?? null,
    hire_date: v.hireDate ? v.hireDate.format('YYYY-MM-DD') : null,
    status: v.active ? 1 : 0,
    // HACK: This file seems to be a misplaced duplicate and should likely be deleted.
    employee_status: v.employeeStatus as unknown as EmployeeStatus,
  };
}
