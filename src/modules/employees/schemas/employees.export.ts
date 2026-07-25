import { toast } from 'sonner';
import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import { getApiErrorMessage } from '@/shared/api/api-error';
import {
  employeesService,
  type EmployeeListParams,
} from '@/modules/employees/services/employees.service';

function buildQueryString(filters: EmployeeListParams): string {
  const sp = new URLSearchParams();
  if (filters.keyword?.trim()) sp.set('q', filters.keyword.trim());
  if (filters.org_unit_id != null)
    sp.set('org_unit_id', String(filters.org_unit_id));
  if (filters.department_id != null)
    sp.set('department_id', String(filters.department_id));
  if (filters.position_id != null)
    sp.set('position_id', String(filters.position_id));
  if (filters.employee_status != null)
    sp.set('employee_status', String(filters.employee_status));
  if (filters.account_status != null)
    sp.set('status', String(filters.account_status));
  return sp.toString();
}

/** Xuất danh sách nhân sự ra Excel (.xlsx) qua server-side. */
export async function exportEmployeesExcel(filters: EmployeeListParams) {
  try {
    const qs = buildQueryString(filters);
    const url = qs
      ? `${API_ENDPOINTS.EMPLOYEES_EXPORT}?${qs}`
      : API_ENDPOINTS.EMPLOYEES_EXPORT;
    const blob = await http.downloadBlob(url);
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `nhan-su-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    toast.error(
      getApiErrorMessage(err, 'Xuất file Excel thất bại. Vui lòng thử lại.'),
    );
  }
}

/** Xuất danh sách nhân sự ra PDF (.pdf) qua server-side. */
export async function exportEmployeesPdf(filters: EmployeeListParams) {
  try {
    const qs = buildQueryString(filters);
    const url = qs
      ? `${API_ENDPOINTS.EMPLOYEES_EXPORT_PDF}?${qs}`
      : API_ENDPOINTS.EMPLOYEES_EXPORT_PDF;
    const blob = await http.downloadBlob(url);
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `nhan-su-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    toast.error(
      getApiErrorMessage(err, 'Xuất file PDF thất bại. Vui lòng thử lại.'),
    );
  }
}

/** Tải file Excel mẫu (.xlsx) để import nhân sự. */
export async function downloadEmployeeImportTemplate() {
  try {
    const blob = await http.downloadBlob(
      API_ENDPOINTS.EMPLOYEES_IMPORT_TEMPLATE,
    );
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'mau-import-nhan-su.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    toast.error(
      getApiErrorMessage(err, 'Tải file Excel mẫu thất bại. Vui lòng thử lại.'),
    );
  }
}

/**
 * Lấy danh sách nhân sự có thể phân công làm người phụ trách.
 * @param assignment_type 'department_manager' | 'org_unit_manager'
 * @param department_id bắt buộc nếu assignment_type = 'department_manager'
 * @param org_unit_id bắt buộc nếu assignment_type = 'org_unit_manager'
 */
export async function getAssignableEmployees(params: {
  assignment_type: 'department_manager' | 'org_unit_manager';
  department_id?: number;
  org_unit_id?: number;
}): Promise<
  Array<{
    id: number;
    code: string;
    full_name: string;
    position: string;
    management_level: number;
  }>
> {
  return employeesService.listAssignableEmployees(params);
}

/**
 * Cấp lại mật khẩu tạm cho tài khoản nhân sự đã tồn tại.
 * @param employee_id ID của nhân viên
 * @returns Kết quả chứa temporary_password (chỉ hiển thị 1 lần)
 */
export async function reissueTemporaryCredential(employee_id: number): Promise<{
  userId: number;
  email: string;
  passwordChangeRequired: boolean;
  temporaryPassword: string;
  inviteLink: string;
}> {
  return employeesService.reissueTemporaryCredential(employee_id);
}
