import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import { buildListSearchParams } from '@/shared/utils/list-query-params';
import type { OrgUnitListParams } from '@/modules/org-units/services/org-units.service';
import type {
  OrgUnitStatus,
  OrgUnit,
} from '@/modules/org-units/types/org-units.types';
import {
  getOrgUnitStatus,
  ORG_UNIT_STATUS_LABELS,
  UNIT_TYPE_LABELS,
} from '@/modules/org-units/types/org-units.types';
import * as XLSX from 'xlsx';

export type OrgUnitExportParams = OrgUnitListParams;

/**
 * BE chỉ nhận status dạng số nguyên 0/1 (0: ngừng hoạt động, 1: hoạt động).
 * soft_deleted / archived là trạng thái phái sinh FE tự tính (dựa vào
 * deletedAt / archivedAt) — BE không có khái niệm tương ứng, nên với 2 trạng
 * thái đó không gửi status lên BE (khớp logic toBeStatusParam trong listPaged).
 *
 * province không gửi lên BE vì BE lỗi 500 khi giá trị có dấu tiếng Việt (bug
 * đã báo BE) — khớp với listPaged cũng bỏ qua province.
 *
 * Vì province không được gửi lên BE, nếu params có province thì bắt buộc phải
 * dùng client-side export (từ filteredUnits) để đảm bảo file export khớp với
 * dữ liệu đang hiển thị trên UI.
 */
function toBeStatusParam(status: OrgUnitStatus | undefined): 0 | 1 | undefined {
  if (status === 'active') return 1;
  if (status === 'inactive') return 0;
  // soft_deleted / archived → không gửi status lên BE; BE mặc định loại bỏ
  // bản ghi soft-delete, nếu muốn export đúng 2 trạng thái này phải dùng
  // client-side export (xem exportXlsx / exportPdf bên dưới).
  return undefined;
}

/** Build common search params cho export — mirror listPaged() params. */
function buildExportSearchParams(params: OrgUnitExportParams): URLSearchParams {
  const sp = buildListSearchParams(params, { keyword: 'q' });
  if (params.unit_type) sp.set('unit_type', params.unit_type);
  const beStatus = toBeStatusParam(params.status);
  if (beStatus !== undefined) sp.set('status', String(beStatus));
  // province: KHÔNG gửi lên BE — BE lỗi 500 khi giá trị có dấu tiếng Việt
  // (xem comment listPaged). Lọc province hoàn toàn client-side.
  return sp;
}

/**
 * Export đơn vị tổ chức ra Excel (server-side).
 * BE: GET /org_units/export-excel?q=&status=&unit_type=
 * Trả về file Excel binary.
 *
 * Chỉ dùng cho status = active / inactive (BE hỗ trợ). Với soft_deleted /
 * archived, dùng exportXlsxFromData để sinh client-side.
 */
async function exportXlsx(params: OrgUnitExportParams = {}): Promise<Blob> {
  const sp = buildExportSearchParams(params);
  const qs = sp.toString();
  const url = qs
    ? `${API_ENDPOINTS.ORG_UNITS_EXPORT}?${qs}`
    : API_ENDPOINTS.ORG_UNITS_EXPORT;
  return http.downloadBlob(url);
}

/**
 * Export đơn vị tổ chức ra PDF (server-side).
 * BE: GET /org_units/export-pdf?q=&status=&unit_type=
 * Trả về file PDF binary.
 *
 * Chỉ dùng cho status = active / inactive (BE hỗ trợ). Với soft_deleted /
 * archived, dùng exportPdfFromData để sinh client-side.
 */
async function exportPdf(params: OrgUnitExportParams = {}): Promise<Blob> {
  const sp = buildExportSearchParams(params);
  const qs = sp.toString();
  const url = qs
    ? `${API_ENDPOINTS.ORG_UNITS_EXPORT_PDF}?${qs}`
    : API_ENDPOINTS.ORG_UNITS_EXPORT_PDF;
  return http.downloadBlob(url);
}

async function exportChartPdf(orgUnitId?: number | null): Promise<Blob> {
  const url = orgUnitId
    ? `${API_ENDPOINTS.ORG_UNITS_CHART_EXPORT_PDF}?org_unit_id=${orgUnitId}`
    : API_ENDPOINTS.ORG_UNITS_CHART_EXPORT_PDF;
  return http.downloadBlob(url);
}

// ──────────────────────────────────────────────────
//  Client-side export fallback cho soft_deleted / archived
// ──────────────────────────────────────────────────

/**
 * Xác định có nên dùng client-side export hay không.
 *
 * Client-side export bắt buộc khi:
 * 1. Status = soft_deleted / archived (BE không hỗ trợ 2 trạng thái này)
 * 2. Có filter province (vì BE lỗi 500 khi province có dấu tiếng Việt,
 *    nên service export không gửi province lên BE → file export sẽ thiếu
 *    filter province nếu dùng server-side).
 */
export function shouldExportClientSide(params: OrgUnitExportParams): boolean {
  return (
    params.status === 'soft_deleted' ||
    params.status === 'archived' ||
    Boolean(params.province)
  );
}

/** @deprecated Dùng `shouldExportClientSide` thay thế. */
export function isClientSideExportStatus(
  status: OrgUnitStatus | undefined,
): boolean {
  return status === 'soft_deleted' || status === 'archived';
}

/**
 * Sinh file Excel (.xlsx) từ dữ liệu đã lọc client-side.
 * Dùng thư viện `xlsx` đã có trong dependencies.
 */
export function exportXlsxFromData(
  data: OrgUnit[],
  nameById: Map<number, string>,
  filename?: string,
): void {
  const rows = data.map((unit) => ({
    Mã: unit.code,
    'Tên đơn vị': unit.name ?? '',
    'Loại đơn vị': UNIT_TYPE_LABELS[unit.unitType] ?? unit.unitType ?? '',
    'Đơn vị cha': unit.parentId ? (nameById.get(unit.parentId) ?? '—') : '—',
    'Tỉnh/TP': unit.province ?? '',
    'Người đại diện': unit.representativeName ?? unit.manager?.full_name ?? '',
    'Trạng thái':
      ORG_UNIT_STATUS_LABELS[getOrgUnitStatus(unit)] ?? getOrgUnitStatus(unit),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => {
    const maxLen = rows.reduce((max, row) => {
      const val = String((row as Record<string, string>)[key] ?? '');
      return Math.max(max, val.length);
    }, key.length);
    return { wch: Math.min(maxLen + 2, 60) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Đơn vị tổ chức');

  const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename ?? `don-vi-to-chuc-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sinh file PDF từ dữ liệu đã lọc client-side.
 * Dùng HTML table đơn giản + print-to-PDF (Blob).
 */
export function exportPdfFromData(
  data: OrgUnit[],
  nameById: Map<number, string>,
  filename?: string,
): void {
  const rowsHtml = data
    .map(
      (unit) => `
      <tr>
        <td>${escapeHtml(unit.code)}</td>
        <td>${escapeHtml(unit.name ?? '')}</td>
        <td>${escapeHtml(UNIT_TYPE_LABELS[unit.unitType] ?? unit.unitType ?? '')}</td>
        <td>${escapeHtml(unit.parentId ? (nameById.get(unit.parentId) ?? '—') : '—')}</td>
        <td>${escapeHtml(unit.province ?? '')}</td>
        <td>${escapeHtml(unit.representativeName ?? unit.manager?.full_name ?? '')}</td>
        <td>${escapeHtml(ORG_UNIT_STATUS_LABELS[getOrgUnitStatus(unit)] ?? getOrgUnitStatus(unit))}</td>
      </tr>`,
    )
    .join('');

  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeStr = now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Đơn vị tổ chức</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
  </style>
</head>
<body>
  <h1>Danh sách đơn vị tổ chức</h1>
  <div class="meta">Ngày xuất: ${dateStr} ${timeStr} · Tổng số: ${data.length} đơn vị</div>
  <table>
    <thead>
      <tr>
        <th>Mã</th>
        <th>Tên đơn vị</th>
        <th>Loại đơn vị</th>
        <th>Đơn vị cha</th>
        <th>Tỉnh/TP</th>
        <th>Người đại diện</th>
        <th>Trạng thái</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // Mở trong iframe ẩn và gọi print → user chọn "Save as PDF"
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '800px';
  iframe.style.height = '600px';
  document.body.appendChild(iframe);

  iframe.srcdoc = html;
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch {
        // fallback: tải file .html nếu print bị chặn
        const fallbackA = document.createElement('a');
        fallbackA.href = url;
        fallbackA.download =
          filename ??
          `don-vi-to-chuc-${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(fallbackA);
        fallbackA.click();
        document.body.removeChild(fallbackA);
      } finally {
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 1000);
      }
    }, 500);
  };
}

/** Escape HTML special chars để tránh XSS trong PDF inline HTML. */
function escapeHtml(str: string): string {
  const e = '&';
  return str
    .replace(/&/g, e + 'amp;')
    .replace(/</g, e + 'lt;')
    .replace(/>/g, e + 'gt;')
    .replace(/"/g, e + 'quot;')
    .replace(/'/g, e + '#039;');
}

export const orgUnitsExportService = {
  exportXlsx,
  exportPdf,
  exportChartPdf,
};
