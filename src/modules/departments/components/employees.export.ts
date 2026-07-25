import {
  EMPLOYEE_STATUS_LABELS,
  EmployeeStatus,
  GENDER_LABELS,
  getPrimaryAssignment,
  type Employee,
} from '@/modules/employees/types/employees.types';

/** Export danh sách nhân sự ra CSV (UTF-8 BOM cho Excel). */
export function exportEmployeesCsv(employees: Employee[]) {
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
        ? (EMPLOYEE_STATUS_LABELS[e.employeeStatus as EmployeeStatus] ??
          String(e.employeeStatus))
        : '',
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nhan-su-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
