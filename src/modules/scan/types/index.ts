/**
 * Scan module types for WMS Hoa Nam.
 * Based on architecture guide: POST /scan-batches/classify
 */

/** Scan code state machine: waiting → scanned → duplicate/unknown/invalid → success/error */
export type ScanCodeState =
  | "waiting"
  | "scanned"
  | "duplicate"
  | "unknown"
  | "invalid"
  | "success"
  | "error";

/** Classify request payload */
export interface ScanClassifyRequest {
  codes: string[];
  warehouse_id?: number;
  scan_source?: "manual" | "barcode" | "rfid" | "lookup";
}

export type ScanClassifyStatus = "VALID" | "DUPLICATE" | "UNKNOWN" | "INVALID";

export const SCAN_ERROR_CODES = [
  "WMS_SCAN_DUPLICATE",
  "WMS_SCAN_UNKNOWN",
  "WMS_SCAN_INVALID",
  "WMS_SCAN_BATCH_NOT_FOUND",
  "WMS_SCAN_WAREHOUSE_MISMATCH",
] as const;

/** Individual code classify result */
export interface ScanClassifyItem {
  code_value: string;
  code_type: string;
  status: ScanClassifyStatus;
  scan_source: string;
  sku_code?: string;
  error_code?: ScanErrorCode;
  message?: string;
}

/** Classify response from backend */
export interface ScanClassifyResponse {
  batch_id: string;
  items: ScanClassifyItem[];
}

/** Scan error codes from backend */
export type ScanErrorCode = (typeof SCAN_ERROR_CODES)[number];

/** Scan batch record */
export interface ScanBatch {
  id: string;
  batch_no: string;
  source_type: string;
  source_id?: string;
  warehouse_id?: number;
  status: "OPEN" | "CLASSIFIED" | "PARTIALLY_POSTED" | "CLOSED" | "CANCELLED";
  total_codes: number;
  valid_count: number;
  duplicate_count: number;
  unknown_count: number;
  invalid_count: number;
  created_at: string;
  created_by: string;
}

/** Scan event record */
export interface ScanEvent {
  id: string;
  batch_id: string;
  code_value: string;
  code_type: string;
  status: "VALID" | "DUPLICATE" | "UNKNOWN" | "INVALID";
  message?: string;
  scanned_at: string;
  scanned_by: string;
}

/** Physical code record */
export interface PhysicalCode {
  id: string;
  code_value: string;
  code_type: string;
  carrier_type: string;
  target_type: string;
  sku_code?: string;
  container_code?: string;
  status: string;
  location_hint?: string;
  created_at: string;
  updated_at: string;
}
