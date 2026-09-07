/**
 * PHÉP DÒ COVERAGE CỦA TỪNG MÀN BÁO CÁO — khai ở một chỗ để đối chiếu được.
 *
 * Luật bất di bất dịch: mỗi màn dò bằng CHÍNH nguồn số của nó. Nếu màn bảo hành
 * dò bằng sổ movement thì banner sẽ nói "dữ liệu tập trung ở 06→08" trong khi
 * hồ sơ bảo hành có thể nằm ở kỳ khác hẳn — một câu sai trông rất giống một câu
 * đúng, và người dùng không có cách nào phát hiện.
 *
 * Probe nào có bộ lọc riêng của màn (mã vật lý, loại movement…) thì bộ lọc đó
 * phải đi kèm: dò "toàn kho" rồi khuyên đổi kỳ cho một phép tra theo mã cụ thể
 * cũng là nói sai.
 */
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { OPERATIONS_REPORT_ENDPOINTS } from "./report-data";
import { daysFromRows, type CoverageProbe } from "./report-coverage";
import type { Raw } from "./report-format";

/**
 * RPT-01 / RPT-01B (nhập kho, xuất kho) — hai màn này đọc SỔ MOVEMENT: biểu đồ
 * theo ngày và mọi drill-down đều dựng từ đó, nên "ngày có dữ liệu" của chúng
 * đúng bằng ngày sổ có bút toán.
 */
export const LEDGER_COVERAGE_PROBE: CoverageProbe = {
  key: "inventory-ledger",
  endpoint: API_ENDPOINTS.REPORTS_INVENTORY_LEDGER,
  extractDays: (payload) => daysFromRows(payload, "occurred_at"),
};

/**
 * RPT-08 (lịch sử nhập – xuất) — bảng của màn là CHỨNG TỪ, không phải movement.
 *
 * Cố ý KHÔNG dùng chung probe sổ movement với RPT-01: hai nguồn không trùng
 * nhau hoàn toàn, và một lời khuyên "sang 06→08 mà xem" dựa trên nguồn khác với
 * nguồn dựng bảng có thể dẫn người dùng sang một kỳ mà màn này vẫn trống.
 */
export const DOCUMENT_HISTORY_COVERAGE_PROBE: CoverageProbe = {
  key: "document-history",
  endpoint: API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY,
  extractDays: (payload) =>
    daysFromRows(payload, ["posted_at", "document_date"]),
};

/** RPT-03 — tra vết movement; giữ nguyên bộ lọc phi-thời-gian của màn. */
export function movementTraceCoverageProbe(params: Raw): CoverageProbe {
  return {
    key: "movement-trace",
    endpoint: API_ENDPOINTS.REPORTS_MOVEMENT_TRACE,
    params,
    extractDays: (payload) => daysFromRows(payload, "occurred_at"),
  };
}

/**
 * RPT-04 — đối soát toa Excel. Ngày của một lô là `batches[].uploaded_at`;
 * `rows[]` là tầng dòng SKU và không mang mốc thời gian riêng.
 */
export const IMPORT_MATCH_COVERAGE_PROBE: CoverageProbe = {
  key: "import-match",
  endpoint: API_ENDPOINTS.REPORTS_IMPORT_MATCH,
  extractDays: (payload) => daysFromRows(payload, "uploaded_at", "batches"),
};

/**
 * RPT-05 — nhật ký in nhãn. `requested_at` là mốc ERD của lần in; bản ghi cũ
 * chưa backfill thì rơi về `printed_at`/`created_at`, đúng thứ tự mà adapter
 * của màn đang dùng.
 */
export const LABEL_LOG_COVERAGE_PROBE: CoverageProbe = {
  key: "label-log",
  endpoint: API_ENDPOINTS.REPORTS_LABEL_LOG,
  extractDays: (payload) =>
    daysFromRows(payload, ["requested_at", "printed_at", "created_at"]),
};

/**
 * RPT-06 — hồ sơ bảo hành. Endpoint này cắt trang ở tầng SQL nên phải cuốn hết
 * trang; trần 10 × 100 dòng giống `useWarrantyReport`.
 */
export const WARRANTY_COVERAGE_PROBE: CoverageProbe = {
  key: "warranty-defects",
  endpoint: API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS,
  paginate: { perPage: 100, maxPages: 10 },
  extractDays: (payload) =>
    daysFromRows(payload, ["received_at", "created_at"]),
};

/**
 * RPT-07 — xuất theo đối tượng nhận hàng. Sổ của màn dựng từ
 * `/reports/outbound-by-recipient`, và mốc thời gian của mỗi dòng là
 * `document_date` (ngày chứng từ xuất). Endpoint cắt trang ở tầng SQL nên phải
 * cuốn hết trang, cùng trần với `useOutboundByRecipient`.
 */
export const OUTBOUND_RECIPIENT_COVERAGE_PROBE: CoverageProbe = {
  key: "outbound-by-recipient",
  endpoint: OPERATIONS_REPORT_ENDPOINTS.OUTBOUND_BY_RECIPIENT,
  paginate: { perPage: 100, maxPages: 10 },
  extractDays: (payload) => daysFromRows(payload, "document_date"),
};
