import { useQuery } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { fetchAllPages } from "@/shared/api/paginate-all";
import { CACHE_POLICIES } from "@/shared/cache/cache-policy";
import { n, text, type Raw } from "@/modules/reports/operations/report-format";

const IMPORT_REPORTS = "/skus/import-reports";
const PAGE_SIZE = 100;
const ISSUE_PAGE_SIZE = 50;

export type ImportQualityIssue = {
  rowNo: number;
  field: string;
  code: string;
  message: string;
  rawValue: string;
  severity: string;
  suggestedAction: string;
};

export async function fetchImportQualityBatches(): Promise<Raw[]> {
  const pages = await fetchAllPages(
    (page) => http.getPage<Raw[]>(IMPORT_REPORTS, { params: { page, per_page: PAGE_SIZE } }),
    (result) => {
      const lastPage = n(result.meta?.last_page, 1);
      if (!Number.isInteger(lastPage) || lastPage < 1 || lastPage > 100) {
        throw new Error("Too many import report pages to display completely.");
      }
      return lastPage;
    },
    100,
  );
  const rows = pages.flatMap((page) => Array.isArray(page.data) ? page.data : []);
  const reportedTotal = pages[0]?.meta?.total;
  if (reportedTotal !== undefined && rows.length !== n(reportedTotal, -1)) {
    throw new Error("Import report history changed during loading. Refresh the report.");
  }
  return rows;
}

export async function fetchImportQualityIssues(batchId: string, page: number) {
  const response = await http.getPage<Raw[]>(`${IMPORT_REPORTS}/${encodeURIComponent(batchId)}/rows`, {
    params: { page, per_page: ISSUE_PAGE_SIZE },
  });
  const rows: ImportQualityIssue[] = (Array.isArray(response.data) ? response.data : []).map((row) => ({
    rowNo: n(row.row_no),
    field: text(row.field, ""),
    code: text(row.error_code, ""),
    message: text(row.message, ""),
    rawValue: text(row.raw_value, ""),
    severity: text(row.severity, "ERROR"),
    suggestedAction: text(row.suggested_action, ""),
  }));
  return { rows, total: n(response.meta?.total, rows.length), lastPage: n(response.meta?.last_page, 1) };
}

export function useImportQualityBatches(enabled: boolean) {
  return useQuery({
    queryKey: ["rpt-04", "sku-import-batches"],
    queryFn: fetchImportQualityBatches,
    enabled,
    staleTime: CACHE_POLICIES.report.staleTime,
  });
}

export function useImportQualityIssues(batchId: string | null, page: number) {
  return useQuery({
    queryKey: ["rpt-04", "sku-import-issues", batchId, page],
    queryFn: () => fetchImportQualityIssues(batchId!, page),
    enabled: Boolean(batchId),
    staleTime: CACHE_POLICIES.report.staleTime,
  });
}

export async function downloadImportQualityExport(filters: Record<string, string>) {
  const { blob, fileName } = await http.downloadFile(`${IMPORT_REPORTS}/export-excel`, { params: filters });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "doi-chieu-du-lieu-nhap.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
