import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import {
  WmsContractError,
  requireNonEmptyString,
} from "@/shared/api/wms-contract";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import type { ApiMeta } from "@/shared/types/api-response";
import type {
  ScanClassifyRequest,
  ScanClassifyResponse,
  ScanClassification,
  ScanContext,
  ScanResolvedSource,
  ScanBatch,
  ScanEvent,
  PhysicalCode,
} from "../types";

type RawRecord = Record<string, unknown>;

export interface ScanPageResult<T> {
  data: T[];
  meta: ApiMeta;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SCAN_CONTEXTS = new Set<ScanContext>([
  "INBOUND",
  "OUTBOUND",
  "INVENTORY",
  "TRACE",
  "WARRANTY_RECEIVE",
  "WARRANTY_TEMP_ONLY",
]);
const CLASSIFICATIONS = new Set<ScanClassification>([
  "ITEM",
  "CONTAINER",
  "SKU",
]);
const RESOLVED_SOURCES = new Set<ScanResolvedSource>([
  "physical_code",
  "inventory_serials.serial_no",
  "container.container_code",
  "products.code",
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

function requireUuid(
  value: unknown,
  field: string,
  code = "WMS_FE_INVALID_PAYLOAD",
): string {
  const normalized = requireNonEmptyString(value, field, code);
  if (!UUID_PATTERN.test(normalized)) {
    throw new WmsContractError(code, `${field} must be a UUID`);
  }
  return normalized;
}

function requireFalse(value: unknown, field: string): false {
  if (value !== false) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      `${field} must be false for read-only scan classification`,
    );
  }
  return false;
}

function requireKnownCode<T extends string>(
  value: string,
  allowed: Set<T>,
  field: string,
): T {
  if (!allowed.has(value as T)) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      `Scan classify response contains unexpected code(s) for ${field}: ${value || "empty"}`,
    );
  }
  return value as T;
}

function nullableUuid(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return requireUuid(value, field, "WMS_FE_INVALID_SCAN_RESPONSE");
}

function normalizeClassifyRequest(
  request: ScanClassifyRequest,
): ScanClassifyRequest {
  const rawCode = requireNonEmptyString(request.raw_code, "raw_code");
  if (rawCode.length > 150) {
    throw new WmsContractError(
      "WMS_FE_INVALID_PAYLOAD",
      "raw_code must contain at most 150 characters",
    );
  }

  if (!SCAN_CONTEXTS.has(request.context)) {
    throw new WmsContractError(
      "WMS_FE_INVALID_PAYLOAD",
      "context is not supported by WWHN-150.1.1.0",
    );
  }

  return {
    raw_code: rawCode,
    context: request.context,
    warehouse_id: requireUuid(request.warehouse_id, "warehouse_id"),
  };
}

function normalizeClassifyResponse(
  value: unknown,
  request: ScanClassifyRequest,
): ScanClassifyResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "Scan classify response data must be an object",
    );
  }

  const row = value as RawRecord;
  const rawCode = requireNonEmptyString(
    row.raw_code,
    "raw_code",
    "WMS_FE_INVALID_SCAN_RESPONSE",
  );
  if (rawCode !== request.raw_code) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "Scan classify response raw_code does not match the request",
    );
  }

  const context = requireKnownCode(
    text(row.context).toUpperCase(),
    SCAN_CONTEXTS,
    "context",
  );
  if (context !== request.context) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "Scan classify response context does not match the request",
    );
  }

  const classification = requireKnownCode(
    text(row.classification).toUpperCase(),
    CLASSIFICATIONS,
    "classification",
  );
  const resolvedSource = requireKnownCode(
    text(row.resolved_source),
    RESOLVED_SOURCES,
    "resolved_source",
  );

  if (row.contract_version !== "WWHN-150.1.1.0") {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "contract_version must be WWHN-150.1.1.0",
    );
  }
  if (row.stock_effect !== "NONE") {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "stock_effect must be NONE",
    );
  }

  const location = row.current_location;
  if (!location || typeof location !== "object" || Array.isArray(location)) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "current_location must be an object",
    );
  }
  const currentLocation = location as RawRecord;
  const responseWarehouseId = requireUuid(
    currentLocation.warehouse_id,
    "current_location.warehouse_id",
    "WMS_FE_INVALID_SCAN_RESPONSE",
  );
  if (responseWarehouseId !== request.warehouse_id) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "current_location.warehouse_id does not match the request",
    );
  }

  return {
    raw_code: rawCode,
    context,
    classification,
    item_id: nullableUuid(row.item_id, "item_id"),
    sku_id: nullableUuid(row.sku_id, "sku_id"),
    product_id: nullableUuid(row.product_id, "product_id"),
    stock_status: requireNonEmptyString(
      row.stock_status,
      "stock_status",
      "WMS_FE_INVALID_SCAN_RESPONSE",
    ),
    object_status:
      row.object_status === null || row.object_status === undefined
        ? undefined
        : requireNonEmptyString(
            row.object_status,
            "object_status",
            "WMS_FE_INVALID_SCAN_RESPONSE",
          ),
    resolved_source: resolvedSource,
    contract_version: "WWHN-150.1.1.0",
    stock_effect: "NONE",
    movement_created: requireFalse(row.movement_created, "movement_created"),
    posting_event_created: requireFalse(
      row.posting_event_created,
      "posting_event_created",
    ),
    idempotency_cache_written: requireFalse(
      row.idempotency_cache_written,
      "idempotency_cache_written",
    ),
    current_location: {
      warehouse_id: responseWarehouseId,
      warehouse_code: requireNonEmptyString(
        currentLocation.warehouse_code,
        "current_location.warehouse_code",
        "WMS_FE_INVALID_SCAN_RESPONSE",
      ),
      warehouse_name: requireNonEmptyString(
        currentLocation.warehouse_name,
        "current_location.warehouse_name",
        "WMS_FE_INVALID_SCAN_RESPONSE",
      ),
    },
  };
}

function normalizeBatch(row: RawRecord): ScanBatch {
  // BE trả khoá canonical scan_batch_id (bảng scan_batches).
  const id = text(row.scan_batch_id ?? row.id);
  return {
    id,
    batch_no: text(row.batch_no ?? row.code ?? id),
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
  // Endpoint /scan/events hợp nhất hai kho evidence: raw_code + result_status là
  // tên cột canonical, evidence_source cho biết bản ghi đến từ kho nào.
  return {
    id: text(row.id ?? row.scan_event_id),
    batch_id: text(row.batch_id ?? row.scan_batch_id),
    code_value: text(row.code_value ?? row.raw_code ?? row.code),
    code_type: text(row.code_type ?? row.resolved_object_type),
    status:
      (text(row.status ?? row.result_status) as ScanEvent["status"]) ||
      "UNKNOWN",
    message: text(row.message) || undefined,
    scanned_at: text(row.scanned_at ?? row.created_at),
    scanned_by: text(row.scanned_by ?? row.created_by_name, "-"),
  };
}

/**
 * WWHN-150.1.1.0: read-only classification.
 * No movement, posting event, scan event or idempotency cache may be created.
 */
export async function classifyScanCodes(
  request: ScanClassifyRequest,
): Promise<ScanClassifyResponse> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.SCAN_CLASSIFY_GENERIC,
    "scan classify",
  );
  const normalized = normalizeClassifyRequest(request);
  const result = await http.post<unknown>(
    API_ENDPOINTS.SCAN_BATCHES_CLASSIFY,
    normalized,
  );
  return normalizeClassifyResponse(result, normalized);
}

export async function fetchScanBatchesPage(
  params: Record<string, unknown> = {},
): Promise<ScanPageResult<ScanBatch>> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.SCAN_BATCHES,
    { params },
  );
  return {
    data: rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
      normalizeBatch,
    ),
    meta: result.meta,
  };
}

export async function fetchScanBatches(
  params: Record<string, unknown> = {},
): Promise<ScanBatch[]> {
  return (await fetchScanBatchesPage(params)).data;
}

export async function fetchScanEventsPage(
  params: Record<string, unknown> = {},
): Promise<ScanPageResult<ScanEvent>> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.SCAN_EVENTS,
    { params },
  );
  return {
    data: rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
      normalizeEvent,
    ),
    meta: result.meta,
  };
}

export async function fetchScanEvents(
  params: Record<string, unknown> = {},
): Promise<ScanEvent[]> {
  return (await fetchScanEventsPage(params)).data;
}

export async function fetchPhysicalCodes(
  params: Record<string, unknown> = {},
): Promise<PhysicalCode[]> {
  void params;
  throw new WmsContractError(
    "WMS_FE_CONTRACT_NOT_APPROVED",
    "Physical code list endpoint is not approved. FE requires BE/BA route, payload, status enum, error code, sample response, and permission sign-off.",
  );
}
