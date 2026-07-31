import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type {
  StocktakeSession,
  StocktakeSnapshot,
  StocktakeCount,
  StocktakeVariance,
  ApplyAdjustmentRequest,
  ApplyAdjustmentResponse,
} from "../types";

type RawRecord = Record<string, unknown>;

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value) ? value : Array.isArray(value.data) ? value.data : [];
}

function clean(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== undefined),
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
  const expected = num(row.expected_qty ?? row.qty_expected);
  const actual = num(row.actual_qty ?? row.qty_actual ?? row.counted_qty);
  return {
    id: text(row.id),
    session_id: text(row.session_id ?? row.stocktake_session_id),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    expected_qty: expected,
    actual_qty: actual,
    variance: num(row.variance ?? actual - expected),
    status: (text(row.status) as StocktakeCount["status"]) || "PENDING",
    counted_by: text(row.counted_by_name ?? row.counted_by, "-"),
    counted_at: text(row.counted_at ?? row.updated_at ?? row.created_at),
    notes: text(row.notes) || undefined,
  };
}

function normalizeVariance(row: RawRecord): StocktakeVariance {
  const expected = num(row.expected_qty ?? row.qty_expected);
  const actual = num(row.actual_qty ?? row.qty_actual);
  const variance = num(row.variance ?? actual - expected);
  return {
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    expected_qty: expected,
    actual_qty: actual,
    variance,
    variance_type: variance > 0 ? "SURPLUS" : variance < 0 ? "SHORTAGE" : "MATCH",
    reconcile_status: (text(row.reconcile_status ?? row.status, "PENDING") as StocktakeVariance["reconcile_status"]),
  };
}

/**
 * GET /stocktake/sessions
 * Fetch stocktake sessions with optional filters.
 */
export async function fetchStocktakeSessions(
  params: Record<string, unknown> = {},
): Promise<StocktakeSession[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.STOCKTAKE_SESSIONS,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(normalizeSession);
}

/**
 * GET /inventory-snapshots
 * Fetch stocktake snapshots.
 */
export async function fetchInventorySnapshots(
  params: Record<string, unknown> = {},
): Promise<StocktakeSnapshot[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.INVENTORY_SNAPSHOTS,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(normalizeSnapshot);
}

/**
 * POST /stocktake/sessions/:sessionId/count
 * Submit a stocktake count for a specific SKU.
 */
export async function submitStocktakeCount(
  sessionId: string,
  payload: { sku: string; actual_qty: number; notes?: string },
): Promise<StocktakeCount> {
  return http.post<StocktakeCount>(
    API_ENDPOINTS.STOCKTAKE_COUNT.replace(":sessionId", sessionId),
    payload,
  );
}

/**
 * POST /stocktake/sessions/:sessionId/apply-adjustment
 * Apply stocktake adjustment to update inventory balances.
 * Requires idempotency key to prevent double application.
 */
export async function applyStocktakeAdjustment(
  request: ApplyAdjustmentRequest,
): Promise<ApplyAdjustmentResponse> {
  return http.post<ApplyAdjustmentResponse>(
    API_ENDPOINTS.STOCKTAKE_APPLY_ADJUSTMENT.replace(":sessionId", request.session_id),
    { lines: request.lines },
    {
      headers: {
        ...(request.idempotency_key ? { "Idempotency-Key": request.idempotency_key } : {}),
      },
    },
  );
}

/**
 * GET /stocktake/sessions/:sessionId/count
 * Fetch stocktake count lines for a session.
 */
export async function fetchStocktakeCounts(
  sessionId: string,
  params: Record<string, unknown> = {},
): Promise<StocktakeCount[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.STOCKTAKE_COUNT.replace(":sessionId", sessionId),
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(normalizeCount);
}

/**
 * GET /stocktake/sessions/:sessionId/variance
 * Fetch stocktake variances for a session.
 */
export async function fetchStocktakeVariances(
  sessionId: string,
  params: Record<string, unknown> = {},
): Promise<StocktakeVariance[]> {
  const result = await http.get<RawRecord[] | { data?: RawRecord[]; rows?: RawRecord[] }>(
    `${API_ENDPOINTS.STOCKTAKE_SESSIONS}/${sessionId}/variance`,
    { params: clean(params) },
  );
  return rowsOf(result).map(normalizeVariance);
}