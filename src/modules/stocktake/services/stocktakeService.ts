/**
 * @deprecated Stocktake Model A — removed from MVP scope.
 * Retained for reference only. Do NOT import in new code.
 */
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import {
  requireIdempotencyKeyHeader,
  requireNonEmptyString,
  requireNonNegativeNumber,
  requirePositiveInteger,
  requireUniqueStrings,
  WmsContractError,
} from "@/shared/api/wms-contract";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import type { ApiMeta } from "@/shared/types/api-response";
import type {
  ApplyAdjustmentRequest,
  ApplyAdjustmentResponse,
  CreateStocktakeSessionRequest,
  StocktakeCount,
  StocktakeSession,
  StocktakeSnapshot,
  StocktakeVariance,
} from "../types";

type RawRecord = Record<string, unknown>;

function rowsOf<T>(value: T[] | { data?: T[]; rows?: T[] }): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.rows)) return value.rows;
  return [];
}

function clean(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== undefined,
    ),
  );
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function sessionEndpoint(template: string, sessionId: string): string {
  return template.replace(":sessionId", sessionId);
}

function normalizeSession(row: RawRecord): StocktakeSession {
  return {
    id: text(row.session_id ?? row.id),
    code: text(row.session_no ?? row.code ?? row.session_code ?? row.doc_no),
    warehouse_id: text(row.warehouse_id),
    warehouse_name: text(row.warehouse_name ?? row.warehouse, "-"),
    status: (text(row.status) as StocktakeSession["status"]) || "DRAFT",
    total_sku: num(row.total_sku ?? row.total_items ?? row.snapshot_count ?? 0),
    counted_sku: num(
      row.counted_sku ?? row.counted_items ?? row.count_count ?? 0,
    ),
    variance_sku: num(row.variance_sku ?? row.variance_count ?? 0),
    shortage_sku: num(row.shortage_sku ?? row.shortage_count ?? 0),
    surplus_sku: num(row.surplus_sku ?? row.surplus_count ?? 0),
    movement_warning_count: num(
      row.movement_warning_count ?? row.movement_warnings ?? 0,
    ),
    scope_type: text(row.scope_type ?? row.scope),
    scope_label: text(row.scope_label ?? row.scope_name) || undefined,
    owner_name:
      text(row.owner_name ?? row.owner ?? row.created_by_name) || undefined,
    version: text(row.session_version ?? row.version) || undefined,
    etag: text(row.etag ?? row._etag) || undefined,
    snapshot_at: text(row.snapshot_at ?? row.started_at ?? row.created_at),
    completed_at: text(row.completed_at) || undefined,
    adjusted_at: text(row.applied_at ?? row.adjusted_at) || undefined,
    created_at: text(row.created_at),
    created_by: text(row.created_by_name ?? row.created_by, "-"),
    notes: text(row.notes) || undefined,
  };
}

function normalizeSnapshot(row: RawRecord): StocktakeSnapshot {
  return {
    id: text(row.id ?? row.snapshot_id),
    session_id: text(row.session_id ?? row.stocktake_session_id),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    expected_qty: num(row.expected_qty ?? row.qty_expected),
    snapshot_qty: num(row.snapshot_qty ?? row.qty_snapshot),
    location_hint: text(row.location_hint) || undefined,
  };
}

function normalizeCount(row: RawRecord): StocktakeCount {
  const snapshotQty = num(
    row.snapshot_qty ??
      row.qty_snapshot ??
      row.expected_qty ??
      row.qty_expected,
  );
  const netMovement = num(
    row.net_movement_after_snapshot ??
      row.net_movement_after_snapshot_to_count_cutoff ??
      row.net_movement ??
      0,
  );
  const expected = num(
    row.expected_at_count ??
      row.expected_qty ??
      row.qty_expected ??
      snapshotQty + netMovement,
  );
  const actual = num(row.actual_qty ?? row.qty_actual ?? row.counted_qty);
  return {
    id: text(row.count_id ?? row.id ?? row.grain_id),
    session_id: text(row.session_id ?? row.stocktake_session_id),
    grain_type: text(row.grain_type) as StocktakeCount["grain_type"],
    grain_id: text(row.grain_id) || undefined,
    product_id: text(row.product_id) || undefined,
    stock_status: text(row.stock_status) || undefined,
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.grain_key),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    expected_qty: expected,
    snapshot_qty: snapshotQty,
    net_movement_after_snapshot: netMovement,
    expected_at_count: expected,
    actual_qty: actual,
    variance: num(row.variance_qty ?? row.variance ?? actual - expected),
    status: (text(row.status) as StocktakeCount["status"]) || "PENDING",
    counted_by: text(row.counted_by_name ?? row.counted_by, "-"),
    counted_at: text(row.counted_at ?? row.updated_at ?? row.created_at),
    notes: text(row.notes) || undefined,
  };
}

function normalizeVariance(row: RawRecord): StocktakeVariance {
  const snapshotQty = num(
    row.snapshot_qty ??
      row.qty_snapshot ??
      row.expected_qty ??
      row.qty_expected,
  );
  const netMovement = num(
    row.net_movement_after_snapshot ??
      row.net_movement_after_snapshot_to_count_cutoff ??
      row.net_movement ??
      0,
  );
  const expected = num(
    row.expected_at_count ??
      row.expected_qty ??
      row.qty_expected ??
      snapshotQty + netMovement,
  );
  const actual = num(row.actual_qty ?? row.qty_actual);
  const variance = num(row.variance_qty ?? row.variance ?? actual - expected);
  const status = text(row.status, "OPEN").toUpperCase();
  return {
    variance_id: text(row.variance_id ?? row.id),
    status,
    grain_type: text(row.grain_type) || undefined,
    grain_id: text(row.grain_id) || undefined,
    product_id: text(row.product_id) || undefined,
    stock_status: text(row.stock_status) || undefined,
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.grain_key),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    expected_qty: expected,
    snapshot_qty: snapshotQty,
    net_movement_after_snapshot: netMovement,
    expected_at_count: expected,
    movement_warning_count: Array.isArray(row.detected_movement_ids)
      ? row.detected_movement_ids.length
      : num(row.movement_warning_count ?? row.movement_warnings ?? 0),
    cutoff_at: text(row.cutoff_at ?? row.count_cutoff_at) || undefined,
    actual_qty: actual,
    variance,
    variance_type:
      variance > 0 ? "SURPLUS" : variance < 0 ? "SHORTAGE" : "MATCH",
    reconcile_status: status,
  };
}

function normalizeAdjustmentResponse(
  value: unknown,
  meta: ApiMeta,
  expectedSessionId: string,
  totalVariance: number,
): ApplyAdjustmentResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WmsContractError(
      "WMS_FE_INVALID_ADJUSTMENT_RESPONSE",
      "Apply adjustment response must be an object",
    );
  }
  const evidence = value as RawRecord;
  const sessionId = requireNonEmptyString(
    evidence.session_id ?? evidence.sessionId,
    "session_id",
    "WMS_FE_INVALID_ADJUSTMENT_RESPONSE",
  );
  if (sessionId !== expectedSessionId) {
    throw new WmsContractError(
      "WMS_FE_INVALID_ADJUSTMENT_RESPONSE",
      `Adjustment response session ${sessionId} does not match ${expectedSessionId}`,
    );
  }
  const status = text(evidence.status).toUpperCase();
  if (status !== "APPLIED") {
    throw new WmsContractError(
      "WMS_FE_INVALID_ADJUSTMENT_RESPONSE",
      `Exact BE v1.7 apply-adjustment must return APPLIED, received ${status || "empty"}`,
    );
  }
  const requestId = requireNonEmptyString(
    meta.request_id ?? evidence.request_id ?? evidence.requestId,
    "request_id",
    "WMS_FE_MISSING_ADJUSTMENT_EVIDENCE",
  );
  const movementIds = Array.isArray(evidence.movement_ids)
    ? evidence.movement_ids.map(String).filter(Boolean)
    : [];
  return {
    session_id: sessionId,
    adjusted_lines: num(evidence.variance_count),
    total_variance: totalVariance,
    status: "APPLIED",
    session_version: num(evidence.session_version),
    movement_ref: movementIds[0],
    movement_ids: movementIds,
    request_id: requestId,
    request_hash: text(evidence.request_hash) || undefined,
  };
}

export async function createStocktakeSession(
  request: CreateStocktakeSessionRequest,
): Promise<StocktakeSession> {
  const warehouseId = requireNonEmptyString(
    String(request.warehouse_id),
    "warehouse_id",
  );
  const result = await http.post<RawRecord>(
    API_ENDPOINTS.STOCKTAKE_CREATE_SESSION,
    {
      warehouse_id: warehouseId,
      ...(request.name.trim() ? { session_no: request.name.trim() } : {}),
    },
  );
  return normalizeSession(result);
}

export async function fetchStocktakeSessions(
  params: Record<string, unknown> = {},
): Promise<StocktakeSession[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.STOCKTAKE_SESSIONS,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeSession,
  );
}

/**
 * This endpoint is inventory-reconciliation snapshot data, not the canonical
 * stocktake session snapshot relation. It is retained as a read-only screen
 * source and never used to calculate or apply a stocktake variance.
 */
export async function fetchInventorySnapshots(
  params: Record<string, unknown> = {},
): Promise<StocktakeSnapshot[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.INVENTORY_SNAPSHOTS,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeSnapshot,
  );
}

async function fetchStocktakeSessionRaw(sessionId: string): Promise<RawRecord> {
  return http.get<RawRecord>(
    sessionEndpoint(API_ENDPOINTS.STOCKTAKE_SESSION, sessionId),
  );
}

export async function submitStocktakeCount(
  sessionId: string,
  payload: { sku: string; actual_qty: number; notes?: string },
): Promise<StocktakeCount> {
  const normalizedSessionId = requireNonEmptyString(sessionId, "sessionId");
  const actualQty = requireNonNegativeNumber(payload.actual_qty, "actual_qty");
  const detail = await fetchStocktakeSessionRaw(normalizedSessionId);
  const existing = rowsOf(
    (detail.counts ?? []) as RawRecord[] | { data?: RawRecord[] },
  ).find(
    (row) => text(row.sku ?? row.sku_code ?? row.grain_key) === payload.sku,
  );
  if (!existing) {
    throw new WmsContractError(
      "WMS_FE_STOCKTAKE_GRAIN_METADATA_REQUIRED",
      "Exact BE v1.7 count endpoint requires grain_type, grain_id, product_id and stock_status; current session detail does not expose a matching count row for this SKU",
    );
  }
  const line = {
    grain_type: requireNonEmptyString(existing.grain_type, "grain_type"),
    grain_id: requireNonEmptyString(existing.grain_id, "grain_id"),
    product_id: requireNonEmptyString(existing.product_id, "product_id"),
    stock_status: requireNonEmptyString(existing.stock_status, "stock_status"),
    actual_qty: actualQty,
  };
  const result = await http.post<RawRecord>(
    sessionEndpoint(API_ENDPOINTS.STOCKTAKE_COUNT, normalizedSessionId),
    { lines: [line] },
  );
  const returnedRows = rowsOf(
    (result.counts ?? result.data ?? []) as
      | RawRecord[]
      | { data?: RawRecord[] },
  );
  return normalizeCount(
    returnedRows[0] ?? {
      ...existing,
      ...line,
      session_id: normalizedSessionId,
    },
  );
}

export async function fetchStocktakeCounts(
  sessionId: string,
  _params: Record<string, unknown> = {},
): Promise<StocktakeCount[]> {
  void _params;
  const detail = await fetchStocktakeSessionRaw(
    requireNonEmptyString(sessionId, "sessionId"),
  );
  return rowsOf(
    (detail.counts ?? []) as RawRecord[] | { data?: RawRecord[] },
  ).map(normalizeCount);
}

export async function fetchStocktakeVariances(
  sessionId: string,
  _params: Record<string, unknown> = {},
): Promise<StocktakeVariance[]> {
  void _params;
  const normalizedSessionId = requireNonEmptyString(sessionId, "sessionId");
  const result = await http.get<RawRecord[] | { data?: RawRecord[] }>(
    sessionEndpoint(API_ENDPOINTS.STOCKTAKE_VARIANCES, normalizedSessionId),
  );
  return rowsOf(result).map(normalizeVariance);
}

export async function applyStocktakeAdjustment(
  request: ApplyAdjustmentRequest,
): Promise<ApplyAdjustmentResponse> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.APPLY_STOCKTAKE_ADJUSTMENT,
    "apply stocktake adjustment",
  );
  const sessionId = requireNonEmptyString(request.session_id, "session_id");
  const sessionVersion = requirePositiveInteger(
    Number(request.version),
    "session_version",
    "WMS_FE_STOCKTAKE_VERSION_REQUIRED",
  );
  const headers = requireIdempotencyKeyHeader(request.idempotency_key);

  // Exact BE requires the complete APPROVED set. Re-read it immediately before
  // posting so FE never applies a stale or hand-picked subset.
  const variances = await fetchStocktakeVariances(sessionId);
  const approved = variances.filter(
    (variance) => variance.status.toUpperCase() === "APPROVED",
  );
  if (approved.length === 0) {
    throw new WmsContractError(
      "WMS_FE_NO_APPROVED_VARIANCE",
      "No APPROVED stocktake variance exists for the exact apply command",
    );
  }
  const varianceIds = requireUniqueStrings(
    approved.map((variance) => variance.variance_id),
    "variance_ids",
    "WMS_FE_DUPLICATE_VARIANCE_ID",
  );
  const requestedReason =
    request.reason ?? request.lines.find((line) => line.reason)?.reason;
  const reason = requireNonEmptyString(
    requestedReason ?? `Stocktake ${sessionId}`,
    "reason",
  );
  if (reason.length > 500) {
    throw new WmsContractError(
      "WMS_FE_INVALID_PAYLOAD",
      "reason must not exceed 500 characters",
    );
  }
  const totalVariance = approved.reduce(
    (sum, variance) => sum + variance.variance,
    0,
  );

  const result = await http.postWithMeta<RawRecord>(
    sessionEndpoint(API_ENDPOINTS.STOCKTAKE_APPLY_ADJUSTMENT, sessionId),
    {
      session_version: sessionVersion,
      variance_ids: varianceIds,
      reason,
    },
    { headers },
  );
  return normalizeAdjustmentResponse(
    result.data,
    result.meta,
    sessionId,
    totalVariance,
  );
}
