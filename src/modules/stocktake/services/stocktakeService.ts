import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import {
  requireArray,
  requireIdempotencyHeaders,
  requireNonEmptyString,
  requireNonNegativeNumber,
  requireUniqueStrings,
  WmsContractError,
} from "@/shared/api/wms-contract";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import type {
  StocktakeSession,
  StocktakeSnapshot,
  StocktakeCount,
  StocktakeVariance,
  CreateStocktakeSessionRequest,
  ApplyAdjustmentRequest,
  ApplyAdjustmentResponse,
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

function normalizeSession(row: RawRecord): StocktakeSession {
  return {
    id: text(row.id),
    code: text(row.code ?? row.session_code ?? row.doc_no),
    warehouse_id: num(row.warehouse_id),
    warehouse_name: text(row.warehouse_name ?? row.warehouse, "-"),
    status: (text(row.status) as StocktakeSession["status"]) || "DRAFT",
    total_sku: num(row.total_sku ?? row.total_items ?? 0),
    counted_sku: num(row.counted_sku ?? row.counted_items ?? 0),
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
    version: text(row.version) || undefined,
    etag: text(row.etag ?? row._etag) || undefined,
    snapshot_at: text(row.snapshot_at ?? row.created_at),
    completed_at: text(row.completed_at) || undefined,
    adjusted_at: text(row.adjusted_at) || undefined,
    created_at: text(row.created_at),
    created_by: text(row.created_by_name ?? row.created_by, "-"),
    notes: text(row.notes) || undefined,
  };
}

function normalizeSnapshot(row: RawRecord): StocktakeSnapshot {
  return {
    id: text(row.id),
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
    id: text(row.id),
    session_id: text(row.session_id ?? row.stocktake_session_id),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    expected_qty: expected,
    snapshot_qty: snapshotQty,
    net_movement_after_snapshot: netMovement,
    expected_at_count: expected,
    actual_qty: actual,
    variance: num(row.variance ?? actual - expected),
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
  const variance = num(row.variance ?? actual - expected);
  return {
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    expected_qty: expected,
    snapshot_qty: snapshotQty,
    net_movement_after_snapshot: netMovement,
    expected_at_count: expected,
    movement_warning_count: num(
      row.movement_warning_count ?? row.movement_warnings ?? 0,
    ),
    cutoff_at: text(row.cutoff_at ?? row.count_cutoff_at) || undefined,
    actual_qty: actual,
    variance,
    variance_type:
      variance > 0 ? "SURPLUS" : variance < 0 ? "SHORTAGE" : "MATCH",
    reconcile_status: text(
      row.reconcile_status ?? row.status,
      "PENDING",
    ) as StocktakeVariance["reconcile_status"],
  };
}

function normalizeAdjustmentResponse(
  value: unknown,
  expectedSessionId: string,
): ApplyAdjustmentResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WmsContractError(
      "WMS_FE_INVALID_ADJUSTMENT_RESPONSE",
      "Apply adjustment response must be an object",
    );
  }
  const row = (value as RawRecord).data ?? value;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new WmsContractError(
      "WMS_FE_INVALID_ADJUSTMENT_RESPONSE",
      "Apply adjustment response data must be an object",
    );
  }
  const evidence = row as RawRecord;
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
  if (status !== "ADJUSTED" && status !== "PARTIALLY_ADJUSTED") {
    throw new WmsContractError(
      "WMS_FE_INVALID_ADJUSTMENT_RESPONSE",
      `Unsupported successful adjustment status: ${status || "empty"}`,
    );
  }
  const movementRef = requireNonEmptyString(
    evidence.movement_ref ??
      evidence.movementRef ??
      evidence.stock_movement_id,
    "movement_ref",
    "WMS_FE_MISSING_ADJUSTMENT_EVIDENCE",
  );
  const requestId = requireNonEmptyString(
    evidence.request_id ?? evidence.requestId,
    "request_id",
    "WMS_FE_MISSING_ADJUSTMENT_EVIDENCE",
  );
  return {
    session_id: sessionId,
    adjusted_lines: num(evidence.adjusted_lines ?? evidence.adjustedLines),
    total_variance: num(evidence.total_variance ?? evidence.totalVariance),
    status,
    movement_ref: movementRef,
    request_id: requestId,
    replayed: Boolean(evidence.replayed ?? evidence.idempotency_replay),
    errors: Array.isArray(evidence.errors)
      ? (evidence.errors as ApplyAdjustmentResponse["errors"])
      : undefined,
  };
}

export async function createStocktakeSession(
  request: CreateStocktakeSessionRequest,
): Promise<StocktakeSession> {
  const result = await http.post<RawRecord>(
    API_ENDPOINTS.STOCKTAKE_CREATE_SESSION,
    {
      name: request.name,
      warehouse_id: request.warehouse_id,
      scope_type: request.scope_type,
      sku_codes: request.sku_codes,
      group_code: request.group_code,
      location_code: request.location_code,
      notes: request.notes,
    },
    {
      headers: {
        ...(request.idempotency_key
          ? { "Idempotency-Key": request.idempotency_key }
          : {}),
      },
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

export async function submitStocktakeCount(
  sessionId: string,
  payload: { sku: string; actual_qty: number; notes?: string },
): Promise<StocktakeCount> {
  return http.post<StocktakeCount>(
    API_ENDPOINTS.STOCKTAKE_COUNT.replace(":sessionId", sessionId),
    payload,
  );
}

export async function applyStocktakeAdjustment(
  request: ApplyAdjustmentRequest,
): Promise<ApplyAdjustmentResponse> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.APPLY_STOCKTAKE_ADJUSTMENT,
    "apply stocktake adjustment",
  );
  const sessionId = requireNonEmptyString(request.session_id, "session_id");
  const rawLines = requireArray(request.lines, "lines");
  requireUniqueStrings(
    rawLines.map((line) => line.sku),
    "lines.sku",
    "WMS_FE_DUPLICATE_SKU",
  );
  const lines = rawLines.map((line, index) => ({
    sku: requireNonEmptyString(line.sku, `lines.${index}.sku`),
    actual_qty: requireNonNegativeNumber(
      line.actual_qty,
      `lines.${index}.actual_qty`,
    ),
    ...(line.reason ? { reason: line.reason } : {}),
  }));
  const result = await http.post<unknown>(
    API_ENDPOINTS.STOCKTAKE_APPLY_ADJUSTMENT.replace(
      ":sessionId",
      sessionId,
    ),
    { lines },
    {
      headers: requireIdempotencyHeaders({
        idempotencyKey: request.idempotency_key,
        ifMatch: request.version,
      }),
    },
  );
  return normalizeAdjustmentResponse(result, sessionId);
}

export async function fetchStocktakeCounts(
  sessionId: string,
  params: Record<string, unknown> = {},
): Promise<StocktakeCount[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.STOCKTAKE_COUNT.replace(":sessionId", sessionId),
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeCount,
  );
}

export async function fetchStocktakeVariances(
  sessionId: string,
  params: Record<string, unknown> = {},
): Promise<StocktakeVariance[]> {
  const result = await http.get<
    RawRecord[] | { data?: RawRecord[]; rows?: RawRecord[] }
  >(`${API_ENDPOINTS.STOCKTAKE_SESSIONS}/${sessionId}/variance`, {
    params: clean(params),
  });
  return rowsOf(result).map(normalizeVariance);
}
