/**
 * RPT-04 — mô hình dữ liệu của báo cáo "Nhập liệu, đối chiếu & lỗi".
 *
 * Baseline UI/UX: `Downloads/UIUX/WMS_HoaNam_UIUX/8.5.WMS_Hoa_Nam_Bao_Cao_Import_Match.html`
 * (+ `Other/Report05_HTML_Export/offline-preview.js`). Bản HTML đó chạy trên
 * snapshot JSON Server nên có sẵn hai "ngữ cảnh" là hai tập dữ liệu rời nhau:
 *
 *  · IMPORT — nạp danh mục SKU bằng Excel  → `/skus/import-reports`
 *  · MATCH  — đối soát toa yêu cầu xuất    → `/reports/import-match`
 *
 * Hai endpoint có schema khác hẳn nhau, nên chuẩn hoá về MỘT `ImportMatchBatch`
 * ngay tại đây; phần UI chỉ nhìn thấy một hình dạng dữ liệu và không phải rẽ
 * nhánh theo nguồn ở từng chỗ hiển thị.
 *
 * File này là logic thuần (không React, không HTTP) để test được trực tiếp.
 */
import { EMPTY_TEXT } from "@/shared/constants/display";
import {
  dayKey,
  listOf,
  n,
  text,
  type ItemKind,
  type Raw,
} from "@/modules/reports/operations/report-format";
import { reportStatusLabel } from "@/modules/reports/operations/report-labels";

export type ImportMatchContext = "IMPORT" | "MATCH";

export const CONTEXT_LABEL: Readonly<Record<ImportMatchContext, string>> = {
  IMPORT: "Import/Migration",
  MATCH: "Đối soát yêu cầu xuất",
};

/** Nhãn cột/ô tìm kiếm đổi theo ngữ cảnh — đúng như baseline 8.5. */
export const CONTEXT_KEY_LABEL: Readonly<Record<ImportMatchContext, string>> = {
  IMPORT: "Tệp / mã import",
  MATCH: "Mã đối soát / phiếu xuất",
};

export type BatchErrorLine = {
  rowNo: string;
  code: string;
  message: string;
  /** SKU hoặc khoá nghiệp vụ của dòng lỗi. */
  reference: string;
  /** Phiếu toa nguồn (chỉ ngữ cảnh đối soát mới có). */
  request: string;
};

export type ImportMatchBatch = {
  id: string;
  context: ImportMatchContext;
  /** Định danh đọc được của batch: tên tệp import hoặc mã đối soát. */
  batchNo: string;
  /** Dòng phụ dưới `batchNo` trong bảng. */
  caption: string;
  sourceFile: string;
  checksum: string;
  sourceVersion: string;
  at: string;
  total: number;
  success: number;
  failed: number;
  duplicate: number;
  actor: string;
  status: string;
  errors: BatchErrorLine[];
  /** Tầng dòng SKU của toa (§13.10 RPT-OUT-MATCH-01) — chỉ ngữ cảnh MATCH có. */
  matchLines: Raw[];
  skuCodes: string[];
  errorFileAvailable: boolean;
};

export type ImportMatchResultFilter = "" | "SUCCESS" | "FAILED" | "DUPLICATE";

export type ImportMatchFilters = {
  from: string;
  to: string;
  result: ImportMatchResultFilter;
  status: string;
  actor: string;
  keyword: string;
  sku: string;
  kind: ItemKind;
};

export type ImportMatchTotals = {
  total: number;
  success: number;
  failed: number;
  duplicate: number;
  /** Tổng SL yêu cầu / đã đối chiếu của tầng dòng SKU (ngữ cảnh MATCH). */
  required: number;
  matched: number;
};

/**
 * Mã lỗi mang nghĩa "đã tồn tại / trùng" — tách khỏi nhóm lỗi vì nghiệp vụ xử
 * lý hai nhóm này khác hẳn nhau (trùng thì bỏ qua, lỗi thì phải sửa và nộp lại).
 */
export function isDuplicateCode(code: string): boolean {
  const upper = code.toUpperCase();
  return (
    upper.includes("DUPLICATE") ||
    upper.includes("ALREADY_EXISTS") ||
    upper.includes("ALREADY_MATCHED")
  );
}

/**
 * Ngữ cảnh IMPORT — `/skus/import-reports`.
 *
 * Endpoint không nhận tham số ngày nên lọc kỳ xảy ra ở client (xem
 * `filterBatches`); ở đây chỉ chuẩn hoá hình dạng.
 */
export function buildImportBatches(
  rows: Raw[],
  resolveActorName: (actorId: string) => string,
): ImportMatchBatch[] {
  return rows.map((row) => {
    const rowErrors = listOf(row.row_errors);
    let duplicate = 0;
    const errors: BatchErrorLine[] = rowErrors.map((error) => {
      const code = text(error.code, "");
      if (isDuplicateCode(code)) duplicate += 1;
      return {
        rowNo: text(error.row, EMPTY_TEXT),
        code: code || "UNKNOWN",
        message: text(error.message, ""),
        reference: text(error.value ?? error.field, ""),
        request: "",
      };
    });
    const mode = text(row.mode, "");
    return {
      id: text(row.import_report_id ?? row.id, ""),
      context: "IMPORT",
      // KHÔNG fallback sang import_report_id (UUID): giá trị này hiện ở cột
      // bảng và ở tiêu đề hộp thoại chi tiết. Thiếu tên tệp thì để rỗng, nơi
      // render tự hiện "Chưa có".
      batchNo: text(row.file_name, ""),
      caption: mode
        ? `Import danh mục SKU · ${reportStatusLabel(mode)}`
        : "Import danh mục SKU",
      sourceFile: text(row.file_name, ""),
      checksum: text(row.file_sha256, ""),
      sourceVersion: text(row.template_version, ""),
      at: text(row.created_at, ""),
      total: n(row.total_rows),
      success: n(row.valid_rows),
      failed: Math.max(0, n(row.error_rows) - duplicate),
      duplicate,
      // KHÔNG fallback sang actor_id (UUID): trường này hiện ở cột "Người thực
      // hiện" và nuôi luôn danh sách chọn của bộ lọc người thực hiện.
      actor: resolveActorName(text(row.actor_id, "")),
      status: text(row.status, ""),
      errors,
      matchLines: [],
      skuCodes: [],
      errorFileAvailable: Boolean(row.error_file_available),
    };
  });
}

/** Ngữ cảnh MATCH — `/reports/import-match` (batches + tầng dòng SKU). */
export function buildMatchBatches(
  payload: Raw | undefined,
): ImportMatchBatch[] {
  const rows = listOf(payload?.rows);
  const byBatch = new Map<string, Raw[]>();
  for (const row of rows) {
    const key = text(row.import_no, "");
    const bucket = byBatch.get(key);
    if (bucket) bucket.push(row);
    else byBatch.set(key, [row]);
  }

  return listOf(payload?.batches).map((batch) => {
    const importNo = text(batch.import_no, "");
    const lines = byBatch.get(importNo) ?? [];
    let success = 0;
    let failed = 0;
    let duplicate = 0;
    const errors: BatchErrorLine[] = [];
    for (const line of lines) {
      const status = text(line.validation_status, "");
      const code = text(line.error_code, "");
      if (status === "VALID") success += 1;
      else if (code && isDuplicateCode(code)) duplicate += 1;
      else if (status === "ERROR" || status === "INVALID") failed += 1;
      if (code || status === "ERROR" || status === "INVALID") {
        errors.push({
          rowNo: text(line.row_no, EMPTY_TEXT),
          code: code || status,
          message: text(line.error_message, ""),
          reference: text(line.sku_code, ""),
          request: text(line.source_request_no, ""),
        });
      }
    }
    return {
      id: text(batch.id, importNo),
      context: "MATCH",
      batchNo: importNo,
      caption: CONTEXT_LABEL.MATCH,
      sourceFile: "",
      checksum: "",
      sourceVersion: text(batch.source_version, ""),
      at: text(batch.uploaded_at, ""),
      total: n(batch.total_rows, lines.length),
      success: success || n(batch.valid_rows),
      failed: failed || Math.max(0, n(batch.error_rows) - duplicate),
      duplicate,
      actor: text(batch.uploaded_by_name, ""),
      status: text(batch.status, ""),
      errors,
      matchLines: lines,
      skuCodes: lines
        .map((line) => text(line.sku_code, ""))
        .filter((code) => code !== ""),
      errorFileAvailable: false,
    };
  });
}

/** Sắp xếp mới nhất trước — cùng thứ tự người dùng đọc nhật ký. */
export function sortByNewest(batches: ImportMatchBatch[]): ImportMatchBatch[] {
  return [...batches].sort((a, b) => b.at.localeCompare(a.at));
}

export function filterBatches(
  batches: ImportMatchBatch[],
  filters: ImportMatchFilters,
  kindOfCode: (code: string) => string | undefined,
): ImportMatchBatch[] {
  const keyword = filters.keyword.trim().toLowerCase();
  const sku = filters.sku.trim().toLowerCase();
  return batches.filter((batch) => {
    const day = dayKey(batch.at);
    if (filters.from && day && day < filters.from) return false;
    if (filters.to && day && day > filters.to) return false;
    if (filters.result === "SUCCESS" && batch.success === 0) return false;
    if (filters.result === "FAILED" && batch.failed === 0) return false;
    if (filters.result === "DUPLICATE" && batch.duplicate === 0) return false;
    if (filters.status && batch.status !== filters.status) return false;
    if (filters.actor && batch.actor !== filters.actor) return false;
    if (
      keyword &&
      !`${batch.batchNo} ${batch.sourceFile}`.toLowerCase().includes(keyword)
    ) {
      return false;
    }
    if (
      sku &&
      !batch.skuCodes.some((code) => code.toLowerCase().includes(sku))
    ) {
      return false;
    }
    if (filters.kind !== "all") {
      // Chỉ batch đối soát toa mới gắn được SKU cụ thể; batch nạp danh mục SKU
      // không thuộc về một loại hàng nào nên bị loại khi lọc theo loại hàng.
      if (batch.skuCodes.length === 0) return false;
      if (!batch.skuCodes.some((code) => kindOfCode(code) === filters.kind)) {
        return false;
      }
    }
    return true;
  });
}

export function totalsOf(batches: ImportMatchBatch[]): ImportMatchTotals {
  return batches.reduce<ImportMatchTotals>(
    (acc, batch) => ({
      total: acc.total + batch.total,
      success: acc.success + batch.success,
      failed: acc.failed + batch.failed,
      duplicate: acc.duplicate + batch.duplicate,
      required:
        acc.required +
        batch.matchLines.reduce((sum, line) => sum + n(line.required_qty), 0),
      matched:
        acc.matched +
        batch.matchLines.reduce((sum, line) => sum + n(line.matched_qty), 0),
    }),
    { total: 0, success: 0, failed: 0, duplicate: 0, required: 0, matched: 0 },
  );
}

export type TrendPoint = {
  day: string;
  success: number;
  failed: number;
  duplicate: number;
};

/**
 * Diễn biến theo ngày — CHỈ những ngày thực sự có batch (đúng như baseline
 * 8.5): kỳ lọc rộng một tháng mà chỉ có hai lần nạp dữ liệu thì biểu đồ vẽ hai
 * cột, không phải 30 cột rỗng.
 */
export function trendByDay(batches: ImportMatchBatch[]): TrendPoint[] {
  const byDay = new Map<string, TrendPoint>();
  for (const batch of batches) {
    const day = dayKey(batch.at);
    if (day === "") continue;
    const point = byDay.get(day) ?? {
      day,
      success: 0,
      failed: 0,
      duplicate: 0,
    };
    point.success += batch.success;
    point.failed += batch.failed;
    point.duplicate += batch.duplicate;
    byDay.set(day, point);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export type ErrorCodeCount = { code: string; value: number };

/** Top mã lỗi trong phạm vi lọc, nhiều nhất trước. */
export function errorCodeCounts(batches: ImportMatchBatch[]): ErrorCodeCount[] {
  const counter = new Map<string, number>();
  for (const batch of batches) {
    for (const error of batch.errors) {
      counter.set(error.code, (counter.get(error.code) ?? 0) + 1);
    }
  }
  return [...counter.entries()]
    .map(([code, value]) => ({ code, value }))
    .sort((a, b) => b.value - a.value || a.code.localeCompare(b.code));
}

/** Batch đầu tiên chứa mã lỗi đang bấm — drill-down của cột "Top mã lỗi". */
export function firstBatchWithErrorCode(
  batches: ImportMatchBatch[],
  code: string,
): ImportMatchBatch | undefined {
  return batches.find((batch) =>
    batch.errors.some((error) => error.code === code),
  );
}
