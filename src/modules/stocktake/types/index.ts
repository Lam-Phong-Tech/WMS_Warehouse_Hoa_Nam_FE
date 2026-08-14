/**
 * @deprecated Stocktake Model A — removed from MVP scope.
 * Retained for reference only. Do NOT import in new code.
 *
 * Stocktake session status from the exact BE v1.7 runtime plus legacy UI aliases.
 */
export type StocktakeSessionStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COUNTING"
  | "REVIEWED"
  | "REVIEWING"
  | "COMPLETED"
  | "APPLIED"
  | "ADJUSTED"
  | "CANCELLED";

export interface StocktakeSession {
  id: string;
  code: string;
  warehouse_id: string | number;
  warehouse_name: string;
  status: StocktakeSessionStatus;
  total_sku: number;
  counted_sku: number;
  variance_sku: number;
  shortage_sku?: number;
  surplus_sku?: number;
  movement_warning_count?: number;
  scope_type?: "FULL_WAREHOUSE" | "SKU" | "SKU_GROUP" | "LOCATION" | string;
  scope_label?: string;
  owner_name?: string;
  /** Exact BE field is session_version. */
  version?: string;
  etag?: string;
  snapshot_at: string;
  completed_at?: string;
  adjusted_at?: string;
  created_at: string;
  created_by: string;
  notes?: string;
}

export interface CreateStocktakeSessionRequest {
  name: string;
  warehouse_id: string | number;
  scope_type: "FULL_WAREHOUSE" | "SKU" | "SKU_GROUP" | "LOCATION";
  sku_codes?: string[] | string;
  group_code?: string;
  location_code?: string;
  notes?: string;
  idempotency_key?: string;
}

export interface StocktakeSnapshot {
  id: string;
  session_id: string;
  sku: string;
  sku_name: string;
  expected_qty: number;
  snapshot_qty: number;
  location_hint?: string;
}

export interface StocktakeCount {
  id: string;
  session_id: string;
  grain_type?: "SKU" | "ITEM" | "CONTAINER";
  grain_id?: string;
  product_id?: string;
  stock_status?: "AVAILABLE" | "DAMAGED" | "RESERVED" | string;
  sku: string;
  sku_name: string;
  expected_qty: number;
  snapshot_qty?: number;
  net_movement_after_snapshot?: number;
  expected_at_count?: number;
  actual_qty: number;
  variance: number;
  status: "PENDING" | "COUNTED" | "RE_COUNT" | "VERIFIED";
  counted_by: string;
  counted_at: string;
  notes?: string;
}

export interface StocktakeVariance {
  variance_id: string;
  status: "OPEN" | "APPROVED" | "REJECTED" | "APPLIED" | string;
  grain_type?: "SKU" | "ITEM" | "CONTAINER" | string;
  grain_id?: string;
  product_id?: string;
  stock_status?: string;
  sku: string;
  sku_name: string;
  expected_qty: number;
  snapshot_qty?: number;
  net_movement_after_snapshot?: number;
  expected_at_count?: number;
  movement_warning_count?: number;
  cutoff_at?: string;
  actual_qty: number;
  variance: number;
  variance_type: "SURPLUS" | "SHORTAGE" | "MATCH";
  reconcile_status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED" | string;
}

/**
 * UI compatibility request. Exact BE v1.7 does not accept the `lines` payload;
 * service resolves the full APPROVED variance-id set immediately before apply,
 * then sends session_version + variance_ids + reason.
 */
export interface ApplyAdjustmentRequest {
  session_id: string;
  lines: Array<{
    sku: string;
    actual_qty: number;
    reason?: string;
  }>;
  idempotency_key: string;
  version: string;
  reason?: string;
}

export interface ApplyAdjustmentResponse {
  session_id: string;
  adjusted_lines: number;
  total_variance: number;
  status: "APPLIED" | "ADJUSTED" | "PARTIALLY_ADJUSTED" | "FAILED";
  session_version?: number;
  movement_ref?: string;
  movement_ids?: string[];
  request_id: string;
  replayed?: boolean;
  request_hash?: string;
  errors?: Array<{
    sku: string;
    error_code: string;
    message: string;
  }>;
}

export type StocktakeErrorCode =
  | "WMS_STOCKTAKE_SESSION_LOCKED"
  | "WMS_STOCKTAKE_ALREADY_ADJUSTED"
  | "WMS_STOCKTAKE_SKU_NOT_FOUND"
  | "WMS_STOCKTAKE_VARIANCE_EXCEEDS_THRESHOLD"
  | "WMS_INVENTORY_INSUFFICIENT"
  | "WMS_STOCKTAKE_VERSION_CONFLICT"
  | "WMS_STOCKTAKE_IDEMPOTENCY_REPLAY";
