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

/**
 * Timeout riêng cho hai request của luồng export, thay cho `apiTimeoutMs` chung
 * (10 giây — hợp lý cho một request đọc danh sách, KHÔNG hợp lý ở đây).
 *
 * Hai request này có thể chậm một cách hợp lệ:
 *
 *  1. GET /reports/export/{id} không phải lúc nào cũng chỉ đọc trạng thái. Khi
 *     worker hàng đợi không nhặt job trong thời gian ân hạn, BE tự chạy export
 *     NGAY TRONG request poll đó (đường cứu hộ WWHN-343) — đo 09/09/2026: một
 *     bản PDF ~750 dòng mất ~20 giây. Với trần 10 giây, trình duyệt huỷ request
 *     giữa chừng và người dùng nhận "xuất thất bại" cho một file mà máy chủ vừa
 *     dựng xong — mất file, mất cả lý do.
 *  2. GET .../download tải nguyên khối file XLSX/PDF; file 10.000 dòng cỡ vài MB
 *     trên đường truyền chậm cũng vượt 10 giây.
 *
 * Chọn đúng bằng REPORT_EXPORT_POLL_TIMEOUT_MS: không request đơn lẻ nào được
 * bỏ cuộc SỚM HƠN hạn chót của cả vòng poll, nếu không thông báo cho người dùng
 * sẽ do trình duyệt quyết định thay vì do trạng thái job.
 */
const REPORT_EXPORT_REQUEST_TIMEOUT_MS = REPORT_EXPORT_POLL_TIMEOUT_MS;

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
      { timeout: REPORT_EXPORT_REQUEST_TIMEOUT_MS },
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
 * Chạy TRỌN một lần xuất báo cáo qua job Annex C: kiểm quyền → tạo job → poll
 * tới READY → tải file. Hàm này NÉM lỗi ra ngoài và không toast, để màn nào tự
 * quản lý trạng thái/thông báo (vd RPT-07) dùng lại đúng một đường xử lý thay
 * vì chép lại vòng poll.
 */
export async function runReportExport(
  format: "xlsx" | "pdf",
  request: ReportExportRequest,
): Promise<number | null> {
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
    { timeout: REPORT_EXPORT_REQUEST_TIMEOUT_MS },
  );
  handleBlobDownload(
    blob,
    fileName ?? `${request.fileStem}${request.fileSuffix ?? ""}.${format}`,
  );
  return finalStatus.row_count;
}

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
      const rowCount = await runReportExport(format, request);
      toast.success(
        tStatic("reports.export.ok", {
          format: format.toUpperCase(),
          rows: fmt(rowCount),
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
