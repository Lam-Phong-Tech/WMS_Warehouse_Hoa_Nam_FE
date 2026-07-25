import { useMutation } from '@tanstack/react-query';
import {
  orgUnitsExportService,
  exportXlsxFromData,
  exportPdfFromData,
  shouldExportClientSide,
  type OrgUnitExportParams,
} from '@/modules/org-units/services/org-units-export.service';
import type { OrgUnit } from '@/modules/org-units/types/org-units.types';

/**
 * Xuất Excel — nếu cần client-side export (soft_deleted / archived / có province)
 * thì dùng dữ liệu đã lọc sẵn, nếu không gọi server.
 *
 * Client-side export bắt buộc khi có province vì BE lỗi 500 với giá trị có dấu
 * tiếng Việt, nên service export không gửi province lên BE → file server-side
 * sẽ rộng hơn dữ liệu đang hiển thị trên UI.
 */
export function useExportOrgUnits() {
  return useMutation({
    mutationFn: ({
      params,
      filteredData,
      nameById,
    }: {
      params: OrgUnitExportParams;
      filteredData?: OrgUnit[];
      nameById?: Map<number, string>;
    }) => {
      if (shouldExportClientSide(params) && filteredData && nameById) {
        // Client-side: sinh Excel từ dữ liệu đã lọc trên FE
        exportXlsxFromData(filteredData, nameById);
        return Promise.resolve(undefined as unknown as Blob);
      }
      return orgUnitsExportService.exportXlsx(params);
    },
    onSuccess: (blob) => {
      if (!blob) return; // client-side export đã tự xử lý download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `don-vi-to-chuc-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}

/**
 * Xuất PDF — nếu cần client-side export (soft_deleted / archived / có province)
 * thì dùng dữ liệu đã lọc sẵn, nếu không gọi server.
 *
 * Client-side export bắt buộc khi có province vì BE lỗi 500 với giá trị có dấu
 * tiếng Việt, nên service export không gửi province lên BE → file server-side
 * sẽ rộng hơn dữ liệu đang hiển thị trên UI.
 */
export function useExportOrgUnitsPdf() {
  return useMutation({
    mutationFn: ({
      params,
      filteredData,
      nameById,
    }: {
      params: OrgUnitExportParams;
      filteredData?: OrgUnit[];
      nameById?: Map<number, string>;
    }) => {
      if (shouldExportClientSide(params) && filteredData && nameById) {
        // Client-side: sinh PDF từ dữ liệu đã lọc trên FE
        exportPdfFromData(filteredData, nameById);
        return Promise.resolve(undefined as unknown as Blob);
      }
      return orgUnitsExportService.exportPdf(params);
    },
    onSuccess: (blob) => {
      if (!blob) return; // client-side export đã tự xử lý download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `don-vi-to-chuc-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}
