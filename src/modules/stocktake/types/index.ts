/** Stocktake session status */
export type StocktakeSessionStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COUNTING"
  | "REVIEWING"
  | "COMPLETED"
  | "APPLIED"
  | "ADJUSTED"
  | "CANCELLED";

export interface StocktakeSession {
  id: string;
  code: string;
  warehouse_id: number;
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
  warehouse_id: number;
  scope_type: "FULL_WAREHOUSE" | "SKU" | "SKU_GROUP" | "LOCATION";
  sku_codes?: string[];
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
  reconcile_status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface ApplyAdjustmentRequest {
  session_id: string;
  lines: Array<{
    sku: string;
    actual_qty: number;
    reason?: string;
  }>;
  idempotency_key: string;
  version: string;
}

export interface ApplyAdjustmentResponse {
  session_id: string;
  adjusted_lines: number;
  total_variance: number;
  status: "ADJUSTED" | "PARTIALLY_ADJUSTED" | "FAILED";
  movement_ref: string;
  request_id: string;
  replayed?: boolean;
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
