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
  ScanBatch,
  ScanEvent,
  PhysicalCode,
} from "../types";

type RawRecord = Record<string, unknown>;

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

function normalizePhysicalCode(row: RawRecord): PhysicalCode {
  return {
    id: text(row.id),
    code_value: text(row.code_value ?? row.code),
    code_type: text(row.code_type),
    carrier_type: text(row.carrier_type),
    target_type: text(row.target_type),
    sku_code: text(row.sku_code) || undefined,
    container_code: text(row.container_code) || undefined,
    status: text(row.status),
    location_hint: text(row.location_hint) || undefined,
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

/**
 * POST /scan-batches/classify
 * Classify scanned codes: returns VALID, DUPLICATE, UNKNOWN, or INVALID status.
 * This is the canonical scan endpoint per architecture guide.
 */
export async function classifyScanCodes(
  request: ScanClassifyRequest,
): Promise<ScanClassifyResponse> {
  return http.post<ScanClassifyResponse>(
    API_ENDPOINTS.SCAN_BATCHES_CLASSIFY,
    normalizeClassifyRequest(request),
  );
}

/**
 * GET /scan/batches
 * Fetch scan batches with optional filters.
 */
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

/**
 * GET /scan/events
 * Fetch scan events with optional filters.
 */
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
 * GET /physical-codes
 * Fetch physical codes with pagination.
 */
export async function fetchPhysicalCodes(
  params: Record<string, unknown> = {},
): Promise<PhysicalCode[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.PHYSICAL_CODES,
    { params },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizePhysicalCode,
  );
}
