import { tStatic } from "@/shared/i18n/useT";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { ApiEnvelopeError } from "@/shared/types/api-response";
import { WmsContractError } from "@/shared/api/wms-contract";
import { nullableApiNumber, requiredApiBoolean, requiredApiIdentity, requiredApiNumber, requiredApiRows } from "@/shared/api/api-read-values";
import { sha256OfFile } from "@/shared/utils/file-digest";
import { useAuthStore } from "@/shared/store/auth.store";
import { OFFLINE_MUTATION_CODE } from "@/shared/pwa/offline-policy";

type RawRecord = Record<string, unknown>;
function isAxiosErrorLike(error: unknown): error is { isAxiosError: true; response?: { status?: number; data?: RawRecord }; code?: string } {
  return typeof error === "object" && error !== null && (error as RawRecord).isAxiosError === true;
}
function responseBody(error: unknown): RawRecord | undefined {
  return isAxiosErrorLike(error) ? error.response?.data
    : error instanceof ApiEnvelopeError ? error.data as unknown as RawRecord : undefined;
}
function getResponseDataForImport(error: unknown): RawRecord | undefined {
  const embedded = responseBody(error)?.data;
  return embedded && typeof embedded === "object" && !Array.isArray(embedded) ? embedded as RawRecord : undefined;
}
function errorCodeOf(error: unknown): string {
  const body = responseBody(error);
  if (!body) return "";
  const nested = body.error;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const code = (nested as RawRecord).code;
    if (typeof code === "string" && code !== "") return code;
  }
  return typeof body.error_code === "string" ? body.error_code : typeof body.code === "string" ? body.code : "";
}
function messageOf(error: unknown, fallback: string): string {
  const body = responseBody(error);
  return typeof body?.message === "string" && body.message !== "" ? body.message : fallback;
}
function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}
function count(value: unknown, field: string): number {
  const result = requiredApiNumber(value, field);
  if (!Number.isSafeInteger(result) || result < 0) throw new WmsContractError("WMS_FE_INVALID_IMPORT_RESULT", `Số liệu nhập SKU không hợp lệ (${field}). Vui lòng kiểm tra lại kết quả từ máy chủ.`);
  return result;
}
/** Zero here is only an internal unpublished-constraint sentinel; it is never an import count. */
function unpublishedConstraint(value: unknown): number {
  return nullableApiNumber(value) ?? 0;
}
function endpointId(template: string, id: string): string {
  return template.replace(":id", encodeURIComponent(requiredApiIdentity(id)));
}
export interface SkuImportConstraints {
  decisionRef: string;
  maxRows: number;
  maxFileSizeKb: number;
  maxFileSizeMb: number;
  allowedExtensions: string[];
  errorFileExpiryHours: number;
  idempotencyWindowHours: number;
  idempotencyIdentity: string[];
  maxPhysicalRowsToScan: number;
  errorFileMaxOnDiskHours: number;
  concurrentImportPolicy: string;
}
export function normalizeSkuImportConstraints(raw: unknown): SkuImportConstraints | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as RawRecord;
  const maxRows = nullableApiNumber(record.max_rows);
  const maxFileSizeKb = nullableApiNumber(record.max_file_size_kb);
  if (maxRows === null || maxRows <= 0 || maxFileSizeKb === null || maxFileSizeKb <= 0) return null;
  return {
    decisionRef: text(record.decision_ref), maxRows, maxFileSizeKb,
    maxFileSizeMb: nullableApiNumber(record.max_file_size_mb) ?? Math.round(maxFileSizeKb / 1024 * 100) / 100,
    allowedExtensions: Array.isArray(record.allowed_extensions) ? record.allowed_extensions.map(value => text(value)) : [],
    errorFileExpiryHours: unpublishedConstraint(record.error_file_expiry_hours),
    idempotencyWindowHours: unpublishedConstraint(record.idempotency_window_hours),
    idempotencyIdentity: Array.isArray(record.idempotency_identity) ? record.idempotency_identity.map(value => text(value)) : [],
    maxPhysicalRowsToScan: unpublishedConstraint(record.max_physical_rows_to_scan),
    errorFileMaxOnDiskHours: unpublishedConstraint(record.error_file_max_on_disk_hours),
    concurrentImportPolicy: text(record.concurrent_import_policy),
  };
}
export interface SkuImportRowError { row: number; code: string; field: string; message: string; value: unknown; }
export interface SkuImportResult {
  templateVersion: string; transactionMode: string;
  dryRun: boolean; committed: boolean; partialWrite: boolean; duplicate: boolean;
  duplicateOfImportReportId: string | null;
  updateExisting: boolean; optionsFingerprint: string | null;
  constraints: SkuImportConstraints | null;
  fileSha256: string; headerMap: Record<string, number>;
  totalRows: number; validRows: number; errorRows: number; insertedRows: number; updatedRows: number;
  wouldInsertRows: number; wouldUpdateRows: number; skippedRows: number;
  rowErrors: SkuImportRowError[]; importReportId: string | null;
  errorFileAvailable: boolean; errorFileExpiresAt: string | null;
}
function normalizeRowError(raw: unknown): SkuImportRowError {
  const row = (raw ?? {}) as RawRecord;
  return { row: count(row.row, "row"), code: text(row.code), field: text(row.field), message: text(row.message), value: row.value };
}
export function normalizeSkuImportResult(payload: RawRecord): SkuImportResult {
  const errors = requiredApiRows<unknown>(payload.row_errors, "import.row_errors");
  const errorRows = count(payload.error_rows, "error_rows");
  return {
    templateVersion: text(payload.template_version), transactionMode: text(payload.transaction_mode),
    dryRun: requiredApiBoolean(payload.dry_run, "import.dry_run"),
    committed: requiredApiBoolean(payload.committed, "import.committed"),
    partialWrite: requiredApiBoolean(payload.partial_write, "import.partial_write"),
    duplicate: requiredApiBoolean(payload.duplicate, "import.duplicate"),
    duplicateOfImportReportId: payload.duplicate_of_import_report_id != null ? text(payload.duplicate_of_import_report_id) : null,
    updateExisting: requiredApiBoolean(payload.update_existing, "import.update_existing"),
    optionsFingerprint: payload.options_fingerprint != null ? text(payload.options_fingerprint) : null,
    constraints: normalizeSkuImportConstraints(payload.constraints),
    fileSha256: requiredApiIdentity(payload.file_sha256, "file_sha256"),
    headerMap: (payload.header_map ?? {}) as Record<string, number>,
    totalRows: count(payload.total_rows, "total_rows"), validRows: count(payload.valid_rows, "valid_rows"), errorRows,
    insertedRows: count(payload.inserted_rows, "inserted_rows"), updatedRows: count(payload.updated_rows, "updated_rows"),
    wouldInsertRows: count(payload.would_insert_rows, "would_insert_rows"),
    wouldUpdateRows: count(payload.would_update_rows, "would_update_rows"), skippedRows: count(payload.skipped_rows, "skipped_rows"),
    rowErrors: errors.map(normalizeRowError),
    importReportId: payload.import_report_id != null ? requiredApiIdentity(payload.import_report_id, "import_report_id") : null,
    // The controller attaches this flag to rejected results; no row errors means no error file.
    errorFileAvailable: payload.error_file_available == null && errorRows === 0
      ? false : requiredApiBoolean(payload.error_file_available, "import.error_file_available"),
    errorFileExpiresAt: payload.error_file_expires_at != null ? text(payload.error_file_expires_at) : null,
  };
}
export class SkuImportRejectedError extends Error {
  constructor(readonly result: SkuImportResult, message: string, readonly cause: unknown) {
    super(message); this.name = "SkuImportRejectedError";
  }
}
export class SkuImportConcurrencyError extends Error {
  constructor(message: string, readonly cause: unknown) { super(message); this.name = "SkuImportConcurrencyError"; }
}
export class SkuImportUnavailableError extends Error {
  readonly retryable = true;
  constructor(message: string, readonly cause: unknown) { super(message); this.name = "SkuImportUnavailableError"; }
}
/** A sent operation without conclusive evidence is neither success nor confirmed failure. */
export class SkuImportOutcomeUnknownError extends Error {
  readonly code = "WMS_FE_WRITE_OUTCOME_UNKNOWN";
  readonly outcomeUnknown = true;
  readonly retryable = false;
  constructor(readonly cause: unknown, readonly importReportId: string | null = null) {
    super("Chưa xác định được kết quả nhập SKU. Yêu cầu đã gửi; hãy kiểm tra lịch sử nhập trước khi thực hiện lại.");
    this.name = "SkuImportOutcomeUnknownError";
  }
}
export interface SkuImportOptions { updateExisting?: boolean; dryRun?: boolean; }

// Operation evidence, not warehouse data. The same file/options cannot be resubmitted
// after an unknown write until its exact report has been read and conclusively resolved.
const activeImports = new Set<string>();
const unknownImports = new Map<string, string | null>();
const pendingPrefix = "hn-wms.sku-import.unknown.";
function pendingReport(key: string): string | null | undefined {
  if (unknownImports.has(key)) return unknownImports.get(key);
  try {
    const stored = window.sessionStorage.getItem(pendingPrefix + key);
    if (stored !== null) return stored || null;
  } catch { /* The in-memory guard remains active when storage is unavailable. */ }
  return undefined;
}
function markUnknown(key: string, reportId: string | null) {
  unknownImports.set(key, reportId);
  try { window.sessionStorage.setItem(pendingPrefix + key, reportId ?? ""); } catch { /* Keep in-memory evidence. */ }
}
function clearUnknown(key: string) {
  unknownImports.delete(key);
  try { window.sessionStorage.removeItem(pendingPrefix + key); } catch { /* No effect on server state. */ }
}
export async function importSkuExcel(file: File, options: SkuImportOptions = {}): Promise<SkuImportResult> {
  const dryRun = options.dryRun ?? false;
  const updateExisting = options.updateExisting ?? false;
  const digest = await sha256OfFile(file);
  const actor = useAuthStore.getState().user?.id;
  const key = `${String(actor ?? "")}:${digest}:${updateExisting ? "1" : "0"}`;
  if (!dryRun) {
    const pending = pendingReport(key);
    if (pending !== undefined) throw new SkuImportOutcomeUnknownError(null, pending);
    if (activeImports.has(key)) throw new SkuImportConcurrencyError(tStatic("masterData.import.errDuplicateRun"), null);
    activeImports.add(key);
  }
  const body = new FormData();
  body.append("file", file);
  body.append("update_existing", String(updateExisting));
  body.append("dry_run", String(dryRun));
  let received: RawRecord | undefined;
  let successfulResponse = false;
  try {
    received = await http.post<RawRecord>(API_ENDPOINTS.SKU_IMPORT_EXCEL, body);
    successfulResponse = true;
    const result = normalizeSkuImportResult(received);
    if (result.fileSha256 !== digest || result.updateExisting !== updateExisting || result.dryRun !== dryRun || result.partialWrite || !result.importReportId) {
      throw new SkuImportOutcomeUnknownError(new Error("Import response evidence does not match the request"), result.importReportId);
    }
    if (dryRun && result.committed || !dryRun && !result.committed) {
      throw new SkuImportOutcomeUnknownError(new Error("Unconfirmed import transaction outcome"), result.importReportId);
    }
    if (!dryRun) clearUnknown(key);
    return result;
  } catch (error) {
    const code = errorCodeOf(error);
    const embedded = getResponseDataForImport(error);
    if (code === "CONCURRENCY_CONFLICT") throw new SkuImportConcurrencyError(messageOf(error, tStatic("masterData.import.errDuplicateRun")), error);
    if ((code === "SKU_IMPORT_REPORT_PERSISTENCE_FAILED" || code === "SKU_IMPORT_TEMP_STORAGE_FAILED") && embedded?.committed === false && embedded.partial_write === false) {
      throw new SkuImportUnavailableError(messageOf(error, tStatic("masterData.import.errRolledBack")), error);
    }
    const status = isAxiosErrorLike(error) ? error.response?.status : undefined;
    if (!successfulResponse && embedded && (status === 422 || code.startsWith("SKU_IMPORT_") && embedded.committed === false && embedded.partial_write === false)) {
      // Validate the actual rejection payload; do not manufacture an empty error report.
      const result = normalizeSkuImportResult(embedded);
      if (result.committed || result.partialWrite) {
        const unknown = new SkuImportOutcomeUnknownError(error, result.importReportId);
        if (!dryRun) markUnknown(key, result.importReportId);
        throw unknown;
      }
      throw new SkuImportRejectedError(result, messageOf(error, tStatic("masterData.import.errRejected")), error);
    }
    const definitelyUnsent = isAxiosErrorLike(error) && error.code === OFFLINE_MUTATION_CODE;
    if (!definitelyUnsent && (successfulResponse || error instanceof SkuImportOutcomeUnknownError || !dryRun && (status === undefined || status >= 500))) {
      const reportId = typeof received?.import_report_id === "string" ? received.import_report_id : error instanceof SkuImportOutcomeUnknownError ? error.importReportId : null;
      if (!dryRun) markUnknown(key, reportId);
      throw error instanceof SkuImportOutcomeUnknownError ? error : new SkuImportOutcomeUnknownError(error, reportId);
    }
    throw error;
  } finally {
    if (!dryRun) activeImports.delete(key);
  }
}
export async function downloadSkuImportTemplate(): Promise<{ blob: Blob; fileName: string | null }> {
  return http.downloadFile(API_ENDPOINTS.SKU_IMPORT_TEMPLATE);
}
export interface SkuImportReportListParams {
  page?: number; per_page?: number; mode?: "DRY_RUN" | "COMMIT";
  status?: "VALID" | "REJECTED" | "COMMITTED"; file_sha256?: string;
}
export interface SkuImportReportRecord {
  id: string; importType: string; mode: string; status: string;
  fileName: string | null; fileSha256: string; templateVersion: string | null;
  totalRows: number; validRows: number; errorRows: number; insertedRows: number; updatedRows: number;
  rowErrors: SkuImportRowError[]; errorFileAvailable: boolean; errorFileExpiresAt: string | null;
  duplicateOfReplay: boolean; optionsFingerprint: string | null; createdAt: string | null;
}
export function normalizeSkuImportReport(raw: RawRecord): SkuImportReportRecord {
  return {
    id: requiredApiIdentity(raw.import_report_id ?? raw.id, "import_report_id"),
    importType: text(raw.import_type), mode: text(raw.mode), status: text(raw.status),
    fileName: raw.file_name != null ? text(raw.file_name) : null,
    fileSha256: text(raw.file_sha256), templateVersion: raw.template_version != null ? text(raw.template_version) : null,
    totalRows: count(raw.total_rows, "total_rows"), validRows: count(raw.valid_rows, "valid_rows"),
    errorRows: count(raw.error_rows, "error_rows"), insertedRows: count(raw.inserted_rows, "inserted_rows"), updatedRows: count(raw.updated_rows, "updated_rows"),
    rowErrors: requiredApiRows<unknown>(raw.row_errors, "import_report.row_errors").map(normalizeRowError),
    errorFileAvailable: requiredApiBoolean(raw.error_file_available, "import_report.error_file_available"),
    errorFileExpiresAt: raw.error_file_expires_at != null ? text(raw.error_file_expires_at) : null,
    duplicateOfReplay: requiredApiBoolean(raw.duplicate_of_replay, "import_report.duplicate_of_replay"),
    optionsFingerprint: raw.options_fingerprint != null ? text(raw.options_fingerprint) : null,
    createdAt: raw.created_at != null ? text(raw.created_at) : null,
  };
}
export async function fetchSkuImportConstraints(): Promise<{ constraints: SkuImportConstraints | null; dataScope: string | null }> {
  const { meta } = await http.getPage<unknown>(API_ENDPOINTS.SKU_IMPORT_REPORTS, { params: { per_page: 1 } });
  const raw = meta as RawRecord;
  return { constraints: normalizeSkuImportConstraints(raw?.constraints), dataScope: raw?.data_scope != null ? text(raw.data_scope) : null };
}
export async function fetchSkuImportReport(id: string): Promise<SkuImportReportRecord> {
  const result = normalizeSkuImportReport(await http.get<RawRecord>(endpointId(API_ENDPOINTS.SKU_IMPORT_REPORT, id)));
  if (result.id === id && result.mode === "COMMIT" && (result.status === "COMMITTED" || result.status === "REJECTED")) {
    for (const [key, reportId] of unknownImports) if (reportId === id) clearUnknown(key);
    try {
      const keys = Object.keys(window.sessionStorage).filter(key => key.startsWith(pendingPrefix) && window.sessionStorage.getItem(key) === id);
      keys.forEach(key => window.sessionStorage.removeItem(key));
    } catch { /* In-memory recovery was already applied. */ }
  }
  return result;
}
export async function downloadSkuImportErrorFile(reportId: string): Promise<{ blob: Blob; fileName: string | null }> {
  return http.downloadFile(endpointId(API_ENDPOINTS.SKU_IMPORT_REPORT_ERROR_FILE, reportId));
}
