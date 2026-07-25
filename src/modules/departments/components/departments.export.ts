import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/shared/api/api-error';
import type { DepartmentListParams } from '@/modules/departments/services/departments.service';

function buildQueryString(filters: DepartmentListParams): string {
  const sp = new URLSearchParams();
  if (filters.keyword?.trim()) sp.set('q', filters.keyword.trim());
  if (filters.org_unit_id != null)
    sp.set('org_unit_id', String(filters.org_unit_id));
  if (filters.status != null) sp.set('status', String(filters.status));
  return sp.toString();
}

function triggerDownload(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

export async function exportDepartmentsExcel(filters: DepartmentListParams) {
  try {
    const qs = buildQueryString(filters);
    const url = qs
      ? `${API_ENDPOINTS.DEPARTMENTS_EXPORT}?${qs}`
      : API_ENDPOINTS.DEPARTMENTS_EXPORT;
    const blob = await http.downloadBlob(url);
    triggerDownload(
      blob,
      `phong-ban-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  } catch (err) {
    toast.error(
      getApiErrorMessage(err, 'Xuất file Excel thất bại. Vui lòng thử lại.'),
    );
  }
}

export async function exportDepartmentsPdf(filters: DepartmentListParams) {
  try {
    const qs = buildQueryString(filters);
    const url = qs
      ? `${API_ENDPOINTS.DEPARTMENTS_EXPORT_PDF}?${qs}`
      : API_ENDPOINTS.DEPARTMENTS_EXPORT_PDF;
    const blob = await http.downloadBlob(url);
    triggerDownload(
      blob,
      `phong-ban-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  } catch (err) {
    toast.error(
      getApiErrorMessage(err, 'Xuất file PDF thất bại. Vui lòng thử lại.'),
    );
  }
}
