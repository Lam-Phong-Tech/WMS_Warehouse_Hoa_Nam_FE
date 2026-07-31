/**
 * Stocktake module types for WMS Hoa Nam.
 * Based on architecture guide: stocktake session, snapshot, count, variance, apply adjustment.
 */

/** Stocktake session status */
export type StocktakeSessionStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COUNTING"
  | "COMPLETED"
  | "ADJUSTED"
  | "CANCELLED";

/** Stocktake session */
export interface StocktakeSession {
  id: string;
  code: string;
  warehouse_id: number;
  warehouse_name: string;
  status: StocktakeSessionStatus;
  total_sku: number;
  counted_sku: number;
  variance_sku: number;
  snapshot_at: string;
  completed_at?: string;
  adjusted_at?: string;
  created_at: string;
  created_by: string;
  notes?: string;
}

/** Stocktake snapshot - frozen balance at session start */
export interface StocktakeSnapshot {
  id: string;
  session_id: string;
  sku: string;
  sku_name: string;
  expected_qty: number;
  snapshot_qty: number;
  location_hint?: string;
}

/** Stocktake count line */
export interface StocktakeCount {
  id: string;
  session_id: string;
  sku: string;
  sku_name: string;
  expected_qty: number;
  actual_qty: number;
  variance: number;
  status: "PENDING" | "COUNTED" | "RE_COUNT" | "VERIFIED";
  counted_by: string;
  counted_at: string;
  notes?: string;
}

/** Stocktake variance after reconciliation */
export interface StocktakeVariance {
  sku: string;
  sku_name: string;
  expected_qty: number;
  actual_qty: number;
  variance: number;
  variance_type: "SURPLUS" | "SHORTAGE" | "MATCH";
  reconcile_status: "PENDING" | "APPROVED" | "REJECTED";
}

/** Request to apply stocktake adjustment */
export interface ApplyAdjustmentRequest {
  session_id: string;
  lines: Array<{
    sku: string;
    actual_qty: number;
    reason?: string;
  }>;
  idempotency_key?: string;
}

/** Apply adjustment response */
export interface ApplyAdjustmentResponse {
  session_id: string;
  adjusted_lines: number;
  total_variance: number;
  status: "ADJUSTED" | "PARTIALLY_ADJUSTED" | "FAILED";
  errors?: Array<{
    sku: string;
    error_code: string;
    message: string;
  }>;
}

/** Stocktake error codes */
export type StocktakeErrorCode =
  | "WMS_STOCKTAKE_SESSION_LOCKED"
  | "WMS_STOCKTAKE_ALREADY_ADJUSTED"
  | "WMS_STOCKTAKE_SKU_NOT_FOUND"
  | "WMS_STOCKTAKE_VARIANCE_EXCEEDS_THRESHOLD"
  | "WMS_INVENTORY_INSUFFICIENT";