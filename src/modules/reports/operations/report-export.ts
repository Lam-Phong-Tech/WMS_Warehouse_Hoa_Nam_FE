import { tStatic } from "@/shared/i18n/useT";
import { useState } from "react";
import { toast } from "sonner";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  getApiErrorMessage,
  isNoPermissionError,
} from "@/shared/api/api-error";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import { fmt, text, type Raw } from "./report-format";

export const EXPORT_ROW_LIMIT = 10000;
export const PII_REASON_MIN_LENGTH = 5;

function stripApiPrefix(url: string): string {
  return url.replace(/^\/api\/v1/, "");
}

function createIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `rpt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const REPORT_EXPORT_POLL_INTERVAL_MS = 1200;
const REPORT_EXPORT_POLL_TIMEOUT_MS = 60000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ReportExportJobStatus = {
  export_job_id: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  row_count: number | null;
  download_url: string | null;
  error_message: string | null;
};

/**
 * POST /reports/export chỉ TẠO job (PENDING) và dispatch nền — file thật chỉ
 * sẵn sàng sau khi GenerateReportExportJob chạy xong. Poll GET
 * /reports/export/{id} tới khi READY (có download_url) hoặc FAILED.
 */
async function pollReportExportJob(
  jobId: string,
): Promise<ReportExportJobStatus> {
  const deadline = Date.now() + REPORT_EXPORT_POLL_TIMEOUT_MS;
  for (;;) {
    const status = await http.get<ReportExportJobStatus>(
      `/reports/export/${jobId}`,
    );
    if (status.status === "READY" || status.status === "FAILED") {
      return status;
    }
    if (Date.now() >= deadline) {
      throw new Error(tStatic("reports.export.timeout"));
    }
    await sleep(REPORT_EXPORT_POLL_INTERVAL_MS);
  }
}

function handleBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type ReportExportRequest = {
  /** `report_code` theo hợp đồng Annex C (vd "inventory-xnt", "label-log"). */
  reportCode: string;
  /** Tên tệp dự phòng khi BE không phát hành Content-Disposition. */
  fileStem: string;
  /** Bộ lọc gửi kèm — phải TRÙNG bộ lọc đang hiển thị trên màn hình. */
  filters: Raw;
  /** Hậu tố khoảng ngày cho tên tệp dự phòng. */
  fileSuffix?: string;
};

/**
 * Xuất báo cáo theo ĐÚNG bộ lọc đang xem, đi qua job export của Annex C.
 * Dùng chung cho cả 7 tab để mọi lần xuất đều có Idempotency-Key và cùng một
 * đường xử lý lỗi/quyền.
 */
export function useReportExport() {
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [exportDenied, setExportDenied] = useState<string | null>(null);

  const exportReport = async (
    format: "xlsx" | "pdf",
    request: ReportExportRequest,
  ) => {
    setExporting(format);
    setExportDenied(null);
    try {
      assertWmsActionPermission(
        WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
        "report export",
      );
      const job = await http.post<Raw>(
        API_ENDPOINTS.REPORTS_EXPORT,
        {
          report_code: request.reportCode,
          format,
          filters: request.filters,
        },
        { headers: { "Idempotency-Key": createIdempotencyKey() } },
      );
      const jobId = text(job.export_job_id, "");
      if (!jobId) {
        throw new Error(tStatic("reports.export.noJobId"));
      }

      const finalStatus = await pollReportExportJob(jobId);
      if (finalStatus.status === "FAILED") {
        throw new Error(
          text(finalStatus.error_message, tStatic("reports.export.failed")),
        );
      }
      const downloadUrl = text(finalStatus.download_url, "");
      if (!downloadUrl) {
        throw new Error(tStatic("reports.export.noDownloadLink"));
      }
      const { blob, fileName } = await http.downloadFile(
        stripApiPrefix(downloadUrl),
      );
      handleBlobDownload(
        blob,
        fileName ?? `${request.fileStem}${request.fileSuffix ?? ""}.${format}`,
      );
      toast.success(
        tStatic("reports.export.ok", {
          format: format.toUpperCase(),
          rows: fmt(finalStatus.row_count),
        }),
      );
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        tStatic("reports.export.failed"),
      );
      if (isNoPermissionError(error)) setExportDenied(message);
      toast.error(message);
    } finally {
      setExporting(null);
    }
  };

  return {
    exporting,
    exportDenied,
    clearExportDenied: () => setExportDenied(null),
    exportReport,
  };
}
