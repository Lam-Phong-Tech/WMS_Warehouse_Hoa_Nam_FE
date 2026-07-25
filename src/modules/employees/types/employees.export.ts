import { exportXlsx } from '@/shared/utils/export-xlsx';
import {
  EMPLOYEE_STATUS_LABELS,
  GENDER_LABELS,
  getPrimaryAssignment,
  EmployeeStatus,
  type Employee,
} from '@/modules/employees/types/employees.types';

/** P1: Export danh sách nhân sự ra Excel. */
export function exportEmployeesExcel(employees: Employee[]) {
  const headers = [
    'Mã NV',
    'Họ tên',
    'Giới tính',
    'Ngày sinh',
    'CCCD',
    'Email',
    'Điện thoại',
    'Đơn vị',
    'Phòng ban',
    'Chức vụ',
    'Ngày vào làm',
    'Trạng thái',
  ];
  const rows = employees.map((e) => {
    const a = getPrimaryAssignment(e);
    return [
      e.code,
      e.fullName,
      e.gender != null ? (GENDER_LABELS[e.gender] ?? String(e.gender)) : '',
      e.birthday ?? '',
      e.cccd ?? '',
      e.email,
      e.phone ?? '',
      a?.org_unit?.name ?? '',
      a?.department?.name ?? '',
      a?.position?.name ?? '',
      e.hireDate ?? '',
      e.employeeStatus != null
        ? (EMPLOYEE_STATUS_LABELS[e.employeeStatus as EmployeeStatus] ?? '')
        : '',
    ];
  });
  exportXlsx(headers, rows, `nhan-su-${new Date().toISOString().slice(0, 10)}`);
}
