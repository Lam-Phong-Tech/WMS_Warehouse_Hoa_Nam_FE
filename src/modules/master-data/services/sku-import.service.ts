import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { ApiEnvelopeError } from "@/shared/types/api-response";

type RawRecord = Record<string, unknown>;

function isAxiosErrorLike(error: unknown): error is {
  isAxiosError: true;
  response?: { data?: RawRecord };
} {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as Record<string, unknown>).isAxiosError === true
  );
}

/**
 * Đọc `data.data` (kết quả import đầy đủ, kèm row_errors thật) từ lỗi 422/409 mà
 * ImportController::importExcel trả về — xem `respondError($message, $rowErrors,
 * 422, $code, ['data' => $result])`. Trả về undefined nếu lỗi không mang theo result
 * có cấu trúc (network error, 401, 500 không rõ nguồn...).
 */
function getResponseDataForImport(error: unknown): RawRecord | undefined {
  let body: RawRecord | undefined;
  if (isAxiosErrorLike(error)) {
    body = error.response?.data;
  } else if (error instanceof ApiEnvelopeError) {
    body = error.data as unknown as RawRecord;
  }
  const embedded = body?.data;
  return embedded && typeof embedded === "object" && !Array.isArray(embedded)
    ? (embedded as RawRecord)
    : undefined;
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function bool(value: unknown): boolean {
  return value === true;
}

function endpointId(template: string, id: string): string {
  return template.replace(":id", encodeURIComponent(id));
}

/** Annex tương ứng WWHN-172/224/330 — 1 dòng lỗi trả về từ ImportService::error(). */
export interface SkuImportRowError {
  row: number;
  code: string;
  field: string;
  message: string;
  value: unknown;
}

/**
 * Kết quả import SKU — khớp field trong ImportService::result()/duplicateResult()
 * (Modules/Warehouse/app/Services/ImportService.php, BE m1, đọc trực tiếp mã nguồn
 * vì Swagger doc text ghi "product.manage" nhưng route thật là permission
 * `sku.manage`).
 */
export interface SkuImportResult {
  templateVersion: string;
  transactionMode: string;
  dryRun: boolean;
  committed: boolean;
  partialWrite: boolean;
  /** WWHN-330 P1-03: file trùng sha256 với 1 lần COMMIT gần đây (24h) của cùng actor. */
  duplicate: boolean;
  duplicateOfImportReportId: string | null;
  fileSha256: string;
  headerMap: Record<string, number>;
  totalRows: number;
  validRows: number;
  errorRows: number;
  insertedRows: number;
  updatedRows: number;
  wouldInsertRows: number;
  wouldUpdateRows: number;
  skippedRows: number;
  rowErrors: SkuImportRowError[];
  /** Có thể null nếu BE ghi Import báo cáo thất bại (best-effort, xem persistReport()). */
  importReportId: string | null;
}

function normalizeRowError(raw: unknown): SkuImportRowError {
  const row = (raw ?? {}) as RawRecord;
  return {
    row: num(row.row),
    code: text(row.code),
    field: text(row.field),
    message: text(row.message),
    value: row.value,
  };
}

export function normalizeSkuImportResult(payload: RawRecord): SkuImportResult {
  const rowErrorsRaw = Array.isArray(payload.row_errors) ? payload.row_errors : [];
  return {
    templateVersion: text(payload.template_version),
    transactionMode: text(payload.transaction_mode),
    dryRun: bool(payload.dry_run),
    committed: bool(payload.committed),
    partialWrite: bool(payload.partial_write),
    duplicate: bool(payload.duplicate),
    duplicateOfImportReportId:
      payload.duplicate_of_import_report_id != null
        ? text(payload.duplicate_of_import_report_id)
        : null,
    fileSha256: text(payload.file_sha256),
    headerMap: (payload.header_map ?? {}) as Record<string, number>,
    totalRows: num(payload.total_rows),
    validRows: num(payload.valid_rows),
    errorRows: num(payload.error_rows),
    insertedRows: num(payload.inserted_rows),
    updatedRows: num(payload.updated_rows),
    wouldInsertRows: num(payload.would_insert_rows),
    wouldUpdateRows: num(payload.would_update_rows),
    skippedRows: num(payload.skipped_rows),
    rowErrors: rowErrorsRaw.map(normalizeRowError),
    importReportId:
      payload.import_report_id != null ? text(payload.import_report_id) : null,
  };
}

/**
 * BE trả 422 (SKU_IMPORT_VALIDATION_FAILED / SKU_IMPORT_DRY_RUN_REJECTED /
 * SKU_IMPORT_FILE_INVALID) với body `{ message, errors: row_errors[], data: <result> }`
 * (respondError($message, $result['row_errors'], 422, $code, ['data' => $result])
 * trong ImportController::importExcel). `errors` ở đây là MẢNG các
 * {row,code,field,message,value}, không phải Record<field,string[]> như phần lớn
 * endpoint khác — nên KHÔNG được đưa thẳng error này vào <ApiErrorAlert> dùng chung
 * (nó sẽ render object thẳng ra JSX và crash). Ném lỗi có cấu trúc riêng để UI tự vẽ
 * bảng lỗi theo đúng field thật.
 */
export class SkuImportRejectedError extends Error {
  readonly result: SkuImportResult;
  readonly cause: unknown;

  constructor(result: SkuImportResult, message: string, cause: unknown) {
    super(message);
    this.name = "SkuImportRejectedError";
    this.result = result;
    this.cause = cause;
  }
}

export interface SkuImportOptions {
  updateExisting?: boolean;
  /** WWHN-224: true = chỉ kiểm tra thử, không ghi SKU/audit nghiệp vụ. */
  dryRun?: boolean;
}

/**
 * POST /skus/import-excel — permission sku.manage. Single-shot: mỗi lần gọi vừa
 * validate vừa (nếu dry_run=false) commit atomically, KHÔNG có API "confirm theo id"
 * riêng như luồng outbound-request-imports.
 */
export async function importSkuExcel(
  file: File,
  options: SkuImportOptions = {},
): Promise<SkuImportResult> {
  const body = new FormData();
  body.append("file", file);
  body.append("update_existing", String(options.updateExisting ?? false));
  body.append("dry_run", String(options.dryRun ?? false));

  try {
    const data = await http.post<RawRecord>(API_ENDPOINTS.SKU_IMPORT_EXCEL, body);
    return normalizeSkuImportResult(data);
  } catch (error) {
    const embedded = getResponseDataForImport(error);
    if (embedded) {
      const result = normalizeSkuImportResult(embedded);
      const message =
        typeof (error as { response?: { data?: { message?: unknown } } })
          .response?.data?.message === "string"
          ? ((error as { response: { data: { message: string } } }).response
              .data.message)
          : "Import bị từ chối.";
      throw new SkuImportRejectedError(result, message, error);
    }
    throw error;
  }
}

export async function downloadSkuImportTemplate(): Promise<{
  blob: Blob;
  fileName: string | null;
}> {
  return http.downloadFile(API_ENDPOINTS.SKU_IMPORT_TEMPLATE);
}

/** GET /skus/import-reports — WWHN-224, phân trang, filter mode/status/file_sha256. */
export interface SkuImportReportListParams {
  page?: number;
  per_page?: number;
  mode?: "DRY_RUN" | "COMMIT";
  status?: "VALID" | "REJECTED" | "COMMITTED";
  file_sha256?: string;
}

export interface SkuImportReportRecord {
  id: string;
  importType: string;
  mode: string;
  status: string;
  fileName: string | null;
  fileSha256: string;
  templateVersion: string | null;
  totalRows: number;
  validRows: number;
  errorRows: number;
  insertedRows: number;
  updatedRows: number;
  rowErrors: SkuImportRowError[];
  /**
   * WWHN-330 P1-01: chỉ true khi BE thật sự đã sinh file CSV lỗi
   * (ImportErrorFileService::generate()) VÀ ghi error_file_path vào bản ghi. Tại thời
   * điểm review WWHN-331, ImportController::persistReport() chưa gọi service này nên
   * field này luôn null — nút tải file lỗi phải ẩn/disable cho tới khi BE hoàn thiện.
   */
  errorFilePath: string | null;
  errorFileExpiresAt: string | null;
  duplicateOfReplay: boolean;
  createdAt: string | null;
}

function normalizeSkuImportReport(raw: RawRecord): SkuImportReportRecord {
  const rowErrorsRaw = Array.isArray(raw.row_errors) ? raw.row_errors : [];
  return {
    id: text(raw.import_report_id ?? raw.id),
    importType: text(raw.import_type),
    mode: text(raw.mode),
    status: text(raw.status),
    fileName: raw.file_name != null ? text(raw.file_name) : null,
    fileSha256: text(raw.file_sha256),
    templateVersion: raw.template_version != null ? text(raw.template_version) : null,
    totalRows: num(raw.total_rows),
    validRows: num(raw.valid_rows),
    errorRows: num(raw.error_rows),
    insertedRows: num(raw.inserted_rows),
    updatedRows: num(raw.updated_rows),
    rowErrors: rowErrorsRaw.map(normalizeRowError),
    errorFilePath: raw.error_file_path != null ? text(raw.error_file_path) : null,
    errorFileExpiresAt:
      raw.error_file_expires_at != null ? text(raw.error_file_expires_at) : null,
    duplicateOfReplay: bool(raw.duplicate_of_replay),
    createdAt: raw.created_at != null ? text(raw.created_at) : null,
  };
}

export async function fetchSkuImportReport(
  id: string,
): Promise<SkuImportReportRecord> {
  const data = await http.get<RawRecord>(
    endpointId(API_ENDPOINTS.SKU_IMPORT_REPORT, id),
  );
  return normalizeSkuImportReport(data);
}

/**
 * GET /skus/import-reports/{id}/error-file — path lấy từ mô tả OpenAPI của
 * ImportController::importExcel (BE). CHƯA có route/controller action thật tại thời
 * điểm review (xem ghi chú ở endpoints.ts) nên có thể trả 404 route-not-found cho tới
 * khi BE hoàn thiện WWHN-330 P1-01; UI phải xử lý 404 như một trạng thái hợp lệ.
 */
export async function downloadSkuImportErrorFile(
  reportId: string,
): Promise<{ blob: Blob; fileName: string | null }> {
  return http.downloadFile(
    endpointId(API_ENDPOINTS.SKU_IMPORT_REPORT_ERROR_FILE, reportId),
  );
}
