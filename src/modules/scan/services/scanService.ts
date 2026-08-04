import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  WmsContractError,
  requireArray,
  requireNonEmptyString,
  requirePositiveNumber,
} from "@/shared/api/wms-contract";
import type {
  ScanClassifyRequest,
  ScanClassifyResponse,
  ScanClassifyItem,
  ScanClassifyStatus,
  ScanBatch,
  ScanEvent,
  PhysicalCode,
} from "../types";

type RawRecord = Record<string, unknown>;

const CLASSIFY_STATUSES = new Set<ScanClassifyStatus>([
  "VALID",
  "DUPLICATE",
  "UNKNOWN",
  "INVALID",
]);

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value)
    ? value
    : Array.isArray(value.data)
      ? value.data
      : [];
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function normalizeClassifyRequest(
  request: ScanClassifyRequest,
): ScanClassifyRequest {
  const codes = requireArray(request.codes, "codes").map((code, index) =>
    requireNonEmptyString(code, `codes.${index}`),
  );
  const duplicated = codes.find((code, index) => codes.indexOf(code) !== index);
  if (duplicated) {
    throw new WmsContractError(
      "WMS_SCAN_DUPLICATE",
      `Duplicate code in request payload: ${duplicated}`,
    );
  }
  return {
    codes,
    ...(request.warehouse_id === undefined
      ? {}
      : {
          warehouse_id: requirePositiveNumber(
            request.warehouse_id,
            "warehouse_id",
          ),
        }),
    ...(request.scan_source ? { scan_source: request.scan_source } : {}),
  };
}

function normalizeClassifyItem(
  row: RawRecord,
  index: number,
): ScanClassifyItem {
  const status = text(row.status).toUpperCase() as ScanClassifyStatus;
  if (!CLASSIFY_STATUSES.has(status)) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      `items.${index}.status is not a supported scan status`,
    );
  }
  return {
    code_value: requireNonEmptyString(
      row.code_value ?? row.code,
      `items.${index}.code_value`,
      "WMS_FE_INVALID_SCAN_RESPONSE",
    ),
    code_type: text(row.code_type, "UNKNOWN"),
    status,
    scan_source: text(row.scan_source, "unknown"),
    sku_code: text(row.sku_code ?? row.sku) || undefined,
    error_code: text(row.error_code) as ScanClassifyItem["error_code"],
    message: text(row.message) || undefined,
  };
}

function normalizeClassifyResponse(
  value: unknown,
  requestedCodeCount: number,
): ScanClassifyResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "Scan classify response must be an object",
    );
  }
  const row = value as RawRecord;
  const items = requireArray(
    rowsOf(
      (row.items ?? row.results ?? row.data ?? []) as
        | RawRecord[]
        | { data?: RawRecord[] },
    ),
    "items",
    "WMS_FE_INVALID_SCAN_RESPONSE",
  ).map(normalizeClassifyItem);

  if (items.length !== requestedCodeCount) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      `Scan classify response returned ${items.length} items for ${requestedCodeCount} requested codes`,
    );
  }

  return {
    batch_id: requireNonEmptyString(
      row.batch_id ?? row.batchId,
      "batch_id",
      "WMS_FE_INVALID_SCAN_RESPONSE",
    ),
    items,
  };
}

function normalizeBatch(row: RawRecord): ScanBatch {
  return {
    id: text(row.id),
    batch_no: text(row.batch_no ?? row.code ?? row.id),
    source_type: text(row.source_type),
    source_id: text(row.source_id) || undefined,
    warehouse_id: num(row.warehouse_id) || undefined,
    status: (text(row.status) as ScanBatch["status"]) || "OPEN",
    total_codes: num(row.total_codes ?? row.code_count ?? 0),
    valid_count: num(row.valid_count ?? 0),
    duplicate_count: num(row.duplicate_count ?? 0),
    unknown_count: num(row.unknown_count ?? 0),
    invalid_count: num(row.invalid_count ?? 0),
    created_at: text(row.created_at),
    created_by: text(row.created_by_name ?? row.created_by, "-"),
  };
}

function normalizeEvent(row: RawRecord): ScanEvent {
  return {
    id: text(row.id),
    batch_id: text(row.batch_id ?? row.scan_batch_id),
    code_value: text(row.code_value ?? row.code),
    code_type: text(row.code_type),
    status: (text(row.status) as ScanEvent["status"]) || "UNKNOWN",
    message: text(row.message) || undefined,
    scanned_at: text(row.scanned_at ?? row.created_at),
    scanned_by: text(row.scanned_by ?? row.created_by_name, "-"),
  };
}

/**
 * POST /api/v1/scan/classify at runtime.
 * `VITE_API_BASE_URL` already contains /api/v1, so the endpoint constant is
 * deliberately `/scan/classify` rather than repeating the API prefix.
 */
export async function classifyScanCodes(
  request: ScanClassifyRequest,
): Promise<ScanClassifyResponse> {
  const normalized = normalizeClassifyRequest(request);
  const result = await http.post<unknown>(
    API_ENDPOINTS.SCAN_BATCHES_CLASSIFY,
    normalized,
  );
  return normalizeClassifyResponse(result, normalized.codes.length);
}

export async function fetchScanBatches(
  params: Record<string, unknown> = {},
): Promise<ScanBatch[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.SCAN_BATCHES,
    { params },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeBatch,
  );
}

export async function fetchScanEvents(
  params: Record<string, unknown> = {},
): Promise<ScanEvent[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.SCAN_EVENTS,
    { params },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeEvent,
  );
}

/**
 * Physical-code list is not in the approved contract supplied to FE.
 * Fail closed instead of converting a legacy route or mock into evidence.
 */
export async function fetchPhysicalCodes(
  params: Record<string, unknown> = {},
): Promise<PhysicalCode[]> {
  void params;
  throw new WmsContractError(
    "WMS_FE_CONTRACT_NOT_APPROVED",
    "Physical code list endpoint is not approved. FE requires BE/BA route, payload, status enum, error code, sample response, and permission sign-off.",
  );
}
