import { tStatic } from "@/shared/i18n/useT";
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

/**
 * Mã lỗi nghiệp vụ của một response lỗi, đọc được ở CẢ HAI hình dạng envelope đang tồn
 * tại: `error.code` (ErrorEnvelope theo SRS §8.2) và `error_code` (hình dạng mà tầng
 * HTTP dùng chung của FE chuẩn hoá). Đọc cả hai là chủ ý — sai khác giữa hai hợp đồng
 * này đã được ghi nhận ở DEC-IMP-001 §9 và chưa chốt lại, nên FE không được phụ thuộc
 * vào đúng một trong hai rồi im lặng hỏng khi phía kia đổi.
 */
function errorCodeOf(error: unknown): string {
  let body: RawRecord | undefined;
  if (isAxiosErrorLike(error)) {
    body = error.response?.data;
  } else if (error instanceof ApiEnvelopeError) {
    body = error.data as unknown as RawRecord;
  }
  if (!body) return "";

  const nested = body.error;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const code = (nested as RawRecord).code;
    if (typeof code === "string" && code !== "") return code;
  }
  if (typeof body.error_code === "string") return body.error_code;
  if (typeof body.code === "string") return body.code;
  return "";
}

function messageOf(error: unknown, fallback: string): string {
  let body: RawRecord | undefined;
  if (isAxiosErrorLike(error)) {
    body = error.response?.data;
  } else if (error instanceof ApiEnvelopeError) {
    body = error.data as unknown as RawRecord;
  }
  return typeof body?.message === "string" && body.message !== ""
    ? body.message
    : fallback;
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

/**
 * WWHN-331 FE331-P1-03R3 — hạn mức import do BE công bố.
 *
 * Trước đây FE viết thẳng "tối đa 1000 dòng, file ≤ 10MB, hạn tải 24h" vào một Alert
 * kèm chú thích nội bộ "giá trị tạm, chưa chốt chính thức". Hai cái sai: người dùng
 * cuối phải đọc ghi chú quy trình của dev, và con số trên màn hình có thể lệch con số
 * máy chủ thực sự đang chặn. Nay BE trả nguyên khối này (đọc từ hợp đồng đã duyệt
 * `warehouse.sku_import`, DEC-IMP-001) và FE chỉ hiển thị lại.
 */
export interface SkuImportConstraints {
  decisionRef: string;
  maxRows: number;
  maxFileSizeKb: number;
  maxFileSizeMb: number;
  allowedExtensions: string[];
  errorFileExpiryHours: number;
  idempotencyWindowHours: number;
  /** Các thành phần tạo nên định danh một lần import (FE331-P1-02R3). */
  idempotencyIdentity: string[];
  /**
   * DEV330-P1-02R3: trần số dòng BẢNG TÍNH được quét. Người dùng chạm phải hạn mức này
   * khi file có nhiều dòng trống xen giữa, và khi đó thông báo lỗi nói về "dòng bảng
   * tính" chứ không phải "dòng dữ liệu" — nên UI phải nói được cả hai con số, nếu không
   * người dùng thấy file 300 dòng bị từ chối bởi một hạn mức 1000 dòng.
   * 0 = BE chưa công bố (BE cũ).
   */
  maxPhysicalRowsToScan: number;
  /**
   * DEV330-P1-01R3: thời gian tối đa file lỗi còn nằm trên đĩa, khác với hạn TẢI ĐƯỢC.
   * 0 = BE chưa công bố.
   */
  errorFileMaxOnDiskHours: number;
  /**
   * DEV330-P1-07R3: `FAIL_CLOSED_409` = hai lần import trùng định danh gửi đồng thời thì
   * lần thứ hai bị từ chối chứ không chạy song song. "" = BE chưa công bố.
   */
  concurrentImportPolicy: string;
}

export function normalizeSkuImportConstraints(
  raw: unknown,
): SkuImportConstraints | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as RawRecord;
  const maxRows = num(record.max_rows);
  const maxFileSizeKb = num(record.max_file_size_kb);
  // Thiếu hai số chặn chính thì coi như BE không công bố hợp đồng: thà không hiển thị
  // hạn mức nào còn hơn hiển thị "tối đa 0 dòng".
  if (maxRows <= 0 || maxFileSizeKb <= 0) return null;

  return {
    decisionRef: text(record.decision_ref),
    maxRows,
    maxFileSizeKb,
    maxFileSizeMb:
      num(record.max_file_size_mb) ||
      Math.round((maxFileSizeKb / 1024) * 100) / 100,
    allowedExtensions: Array.isArray(record.allowed_extensions)
      ? record.allowed_extensions.map((value) => text(value))
      : [],
    errorFileExpiryHours: num(record.error_file_expiry_hours),
    idempotencyWindowHours: num(record.idempotency_window_hours),
    idempotencyIdentity: Array.isArray(record.idempotency_identity)
      ? record.idempotency_identity.map((value) => text(value))
      : [],
    maxPhysicalRowsToScan: num(record.max_physical_rows_to_scan),
    errorFileMaxOnDiskHours: num(record.error_file_max_on_disk_hours),
    concurrentImportPolicy: text(record.concurrent_import_policy),
  };
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
 * (Modules/Warehouse/app/Services/ImportService.php, BE m1).
 *
 * WWHN-224 DEV224-P1-04R: trước đây chú thích ở đây phải cảnh báo "Swagger ghi
 * product.manage nhưng route thật là sku.manage". Drift đó đã được đóng ở BE (annotation
 * + artifact OpenAPI + Postman đều là `sku.manage`), nên hợp đồng công bố và quyền thực
 * thi nay là một; không còn phải đọc chéo mã nguồn để biết quyền đúng.
 */
export interface SkuImportResult {
  templateVersion: string;
  transactionMode: string;
  dryRun: boolean;
  committed: boolean;
  partialWrite: boolean;
  /**
   * WWHN-330 P1-03 + WWHN-331 FE331-P1-02R3: lần gửi này trùng ĐỦ định danh
   * (`file_sha256` + `actor_id` + `options_fingerprint`) với một lần COMMIT gần đây
   * nên BE trả lại kết quả cũ. Đổi `update_existing` là một thao tác khác nên KHÔNG
   * còn bị coi là trùng.
   */
  duplicate: boolean;
  duplicateOfImportReportId: string | null;
  /** Tùy chọn của chính lần gửi này, do BE phản hồi lại (không phải state của UI). */
  updateExisting: boolean;
  /** Vân tay tùy chọn tham gia định danh replay; null với bản ghi cũ trước khi có cột. */
  optionsFingerprint: string | null;
  /** Hạn mức máy chủ đang áp dụng — null nếu BE chưa công bố (client cũ/BE cũ). */
  constraints: SkuImportConstraints | null;
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
  /**
   * WWHN-224 DEV224-P1-05R: với MỌI lần chạy được xử lý (200 và cả 422 lỗi dòng), đây
   * luôn là id thật — BE ghi Import báo cáo trong cùng transaction với phần ghi SKU nên
   * không còn trạng thái "đã chạy nhưng không có báo cáo"; ghi hỏng thì BE trả 503
   * (`SkuImportUnavailableError`) chứ không trả 200 thiếu id. Vẫn khai là nullable để
   * client cũ/BE cũ không vỡ, nhưng UI không được thiết kế quanh giả định null.
   */
  importReportId: string | null;
  /**
   * WWHN-330 P1-01: BE tự trả lời "lần import này có file lỗi CSV tải được hay không"
   * ngay trong response 422 (ImportController::importExcel gán từ accessor
   * ImportReport::error_file_available — đã tính cả điều kiện hết hạn ở server).
   * Nhờ vậy UI biết ngay có nút tải hay không mà không cần gọi thêm GET báo cáo, và
   * không bao giờ tự so hạn dùng bằng đồng hồ máy client.
   */
  errorFileAvailable: boolean;
  /** Chỉ để hiển thị mốc hết hạn cho người dùng; KHÔNG dùng để tự quyết định availability. */
  errorFileExpiresAt: string | null;
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
  const rowErrorsRaw = Array.isArray(payload.row_errors)
    ? payload.row_errors
    : [];
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
    updateExisting: bool(payload.update_existing),
    optionsFingerprint:
      payload.options_fingerprint != null
        ? text(payload.options_fingerprint)
        : null,
    constraints: normalizeSkuImportConstraints(payload.constraints),
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
    errorFileAvailable: bool(payload.error_file_available),
    errorFileExpiresAt:
      payload.error_file_expires_at != null
        ? text(payload.error_file_expires_at)
        : null,
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

/**
 * WWHN-330 DEV330-P1-07R3 — BE trả 409 `CONCURRENCY_CONFLICT`: một lần import COMMIT
 * trùng ĐỦ định danh (cùng file, cùng người, cùng tùy chọn) đang chạy và request này
 * không giành được khoá tuần tự hoá.
 *
 * Vì sao phải là một lớp lỗi riêng, không gộp vào `SkuImportRejectedError`: response
 * 409 cũng mang khối `data` nên nhánh xử lý 422 sẽ nuốt nó và dựng ra một "kết quả
 * import" rỗng — người dùng thấy bảng lỗi TRỐNG kèm chữ "Import bị từ chối" và không
 * hiểu mình phải sửa gì trong file, trong khi thực tế file hoàn toàn hợp lệ và việc
 * cần làm chỉ là đợi rồi bấm lại. Đây là lỗi tạm thời, khắc phục được, không phải lỗi
 * dữ liệu — hai thứ đó không được nói bằng cùng một câu.
 */
export class SkuImportConcurrencyError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "SkuImportConcurrencyError";
    this.cause = cause;
  }
}

/**
 * WWHN-224 DEV224-P1-05R — BE trả 503 `SKU_IMPORT_REPORT_PERSISTENCE_FAILED`: không
 * ghi/không đọc được Import báo cáo, vốn là output BẮT BUỘC của luồng này, nên toàn bộ
 * transaction đã rollback (`committed=false`, `partial_write=false`).
 *
 * Vì sao phải là lớp lỗi riêng thay vì để rơi vào nhánh 422: response 503 cũng mang
 * khối `data` (để client đọc được `partial_write`/`constraints`), nên nhánh 422 sẽ nuốt
 * nó và dựng ra một "kết quả import" KHÔNG có dòng lỗi nào — người dùng nhìn thấy bảng
 * lỗi trống kèm chữ "Import bị từ chối" rồi đi sửa một file vốn hoàn toàn hợp lệ. Đây là
 * sự cố hạ tầng phía máy chủ và thử lại được; gọi nó là lỗi dữ liệu là đẩy nhầm việc
 * sang người dùng. Đúng lý do đã buộc `SkuImportConcurrencyError` phải tách riêng.
 */
export class SkuImportUnavailableError extends Error {
  readonly cause: unknown;

  /** Máy chủ đã rollback nên bấm lại là an toàn, không sinh bản ghi trùng. */
  readonly retryable = true;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "SkuImportUnavailableError";
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
    const data = await http.post<RawRecord>(
      API_ENDPOINTS.SKU_IMPORT_EXCEL,
      body,
    );
    return normalizeSkuImportResult(data);
  } catch (error) {
    // Phải xét TRƯỚC nhánh 422 bên dưới: 409 cũng mang khối `data` (kèm constraints)
    // nên nếu để lọt xuống, nó sẽ bị dựng thành một "kết quả import" không có dòng lỗi
    // nào và hiển thị sai bản chất sự cố.
    if (errorCodeOf(error) === "CONCURRENCY_CONFLICT") {
      throw new SkuImportConcurrencyError(
        messageOf(error, tStatic("masterData.import.errDuplicateRun")),
        error,
      );
    }

    // WWHN-224 DEV224-P1-05R — cùng lý do với nhánh 409 ngay trên: 503 cũng mang khối
    // `data`, để lọt xuống nhánh 422 là báo "file có lỗi" cho một file không hề có lỗi.
    if (errorCodeOf(error) === "SKU_IMPORT_REPORT_PERSISTENCE_FAILED") {
      throw new SkuImportUnavailableError(
        messageOf(error, tStatic("masterData.import.errRolledBack")),
        error,
      );
    }

    const embedded = getResponseDataForImport(error);
    if (embedded) {
      const result = normalizeSkuImportResult(embedded);
      const message =
        typeof (error as { response?: { data?: { message?: unknown } } })
          .response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data
              .message
          : tStatic("masterData.import.errRejected");
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
   * WWHN-330 P1-01: nguồn sự thật DUY NHẤT để bật/tắt nút tải file lỗi.
   *
   * BE tính field này ở server (ImportReport::error_file_available = đã sinh file VÀ
   * chưa quá hạn) đúng bằng điều kiện mà endpoint tải dùng để trả 200 hay 404, nên UI
   * không bao giờ hiện nút dẫn tới chắc chắn 404. `error_file_path` (đường dẫn lưu trữ
   * nội bộ) KHÔNG được BE trả ra ngoài nữa và FE cũng không được phụ thuộc vào nó.
   */
  errorFileAvailable: boolean;
  /** Chỉ để hiển thị mốc hết hạn cho người dùng; KHÔNG dùng để tự tính availability. */
  errorFileExpiresAt: string | null;
  duplicateOfReplay: boolean;
  /** WWHN-331 FE331-P1-02R3: vân tay tùy chọn của lần import đã tạo báo cáo này. */
  optionsFingerprint: string | null;
  createdAt: string | null;
}

/** Export để test được mapper thuần này mà không phải dựng HTTP mock. */
export function normalizeSkuImportReport(
  raw: RawRecord,
): SkuImportReportRecord {
  const rowErrorsRaw = Array.isArray(raw.row_errors) ? raw.row_errors : [];
  return {
    id: text(raw.import_report_id ?? raw.id),
    importType: text(raw.import_type),
    mode: text(raw.mode),
    status: text(raw.status),
    fileName: raw.file_name != null ? text(raw.file_name) : null,
    fileSha256: text(raw.file_sha256),
    templateVersion:
      raw.template_version != null ? text(raw.template_version) : null,
    totalRows: num(raw.total_rows),
    validRows: num(raw.valid_rows),
    errorRows: num(raw.error_rows),
    insertedRows: num(raw.inserted_rows),
    updatedRows: num(raw.updated_rows),
    rowErrors: rowErrorsRaw.map(normalizeRowError),
    errorFileAvailable: bool(raw.error_file_available),
    errorFileExpiresAt:
      raw.error_file_expires_at != null
        ? text(raw.error_file_expires_at)
        : null,
    duplicateOfReplay: bool(raw.duplicate_of_replay),
    optionsFingerprint:
      raw.options_fingerprint != null ? text(raw.options_fingerprint) : null,
    createdAt: raw.created_at != null ? text(raw.created_at) : null,
  };
}

/**
 * WWHN-331 FE331-P1-03R3 — đọc hạn mức import máy chủ đang áp dụng.
 *
 * Không có (và cố ý không thêm) route riêng cho việc này: `/skus/import-excel` +
 * `/skus/import-template` + 3 route Import báo cáo vốn đã nằm NGOÀI 67 operation Annex C
 * (REQ-SRS-034 / DEC-MIG-API-001), nên mở thêm một endpoint công khai nữa là tự mở rộng
 * bề mặt API ngoài baseline. BE gắn hợp đồng vào `meta.constraints` của chính endpoint
 * danh sách báo cáo — endpoint đọc duy nhất mà màn hình import gọi được TRƯỚC khi người
 * dùng chọn file. `per_page=1` vì ở đây chỉ cần phần meta.
 *
 * `meta.data_scope` (GLOBAL | ACTOR_SCOPED) trả kèm là phạm vi dữ liệu đang áp dụng cho
 * người đăng nhập (FE331-P1-06R3).
 */
export async function fetchSkuImportConstraints(): Promise<{
  constraints: SkuImportConstraints | null;
  dataScope: string | null;
}> {
  const { meta } = await http.getPage<unknown>(
    API_ENDPOINTS.SKU_IMPORT_REPORTS,
    {
      params: { per_page: 1 },
    },
  );
  const raw = meta as RawRecord;
  return {
    constraints: normalizeSkuImportConstraints(raw?.constraints),
    dataScope: raw?.data_scope != null ? text(raw.data_scope) : null,
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
 * GET /skus/import-reports/{id}/error-file — route thật tại
 * Modules/Warehouse/routes/import.php (ImportReportController::downloadErrorFile),
 * permission `sku.manage`, trả text/csv.
 *
 * 404 vẫn là một trạng thái hợp lệ chứ không phải sự cố: báo cáo không có dòng lỗi,
 * file đã hết hạn (theo `constraints.error_file_expiry_hours` do BE công bố), hoặc file
 * đã bị lệnh `import:purge-error-files` dọn. UI phải
 * hiển thị đúng nghĩa đó thay vì báo lỗi kỹ thuật chung chung.
 */
export async function downloadSkuImportErrorFile(
  reportId: string,
): Promise<{ blob: Blob; fileName: string | null }> {
  return http.downloadFile(
    endpointId(API_ENDPOINTS.SKU_IMPORT_REPORT_ERROR_FILE, reportId),
  );
}
