/**
 * Scan module types for WMS Hoa Nam.
 * Canonical runtime classify route: POST /api/v1/scan/classify.
 * FE endpoint constants stay relative because API base URL already includes
 * /api/v1.
 */

export type ScanCodeState =
  | "waiting"
  | "scanned"
  | "duplicate"
  | "unknown"
  | "invalid"
  | "success"
  | "error";

export interface ScanClassifyRequest {
  codes: string[];
  warehouse_id?: number;
  scan_source?: "manual" | "barcode" | "rfid" | "lookup";
}

export type ScanClassifyStatus =
  | "VALID"
  | "DUPLICATE"
  | "UNKNOWN"
  | "INVALID";

export const SCAN_ERROR_CODES = [
  "WMS_SCAN_DUPLICATE",
  "WMS_SCAN_UNKNOWN",
  "WMS_SCAN_INVALID",
  "WMS_SCAN_BATCH_NOT_FOUND",
  "WMS_SCAN_WAREHOUSE_MISMATCH",
] as const;

export interface ScanClassifyItem {
  code_value: string;
  code_type: string;
  status: ScanClassifyStatus;
  scan_source: string;
  sku_code?: string;
  error_code?: ScanErrorCode;
  message?: string;
}

export interface ScanClassifyResponse {
  batch_id: string;
  request_id?: string;
  items: ScanClassifyItem[];
}

export type ScanErrorCode = (typeof SCAN_ERROR_CODES)[number];

export interface ScanBatch {
  id: string;
  batch_no: string;
  source_type: string;
  source_id?: string;
  warehouse_id?: number;
  status:
    | "OPEN"
    | "CLASSIFIED"
    | "PARTIALLY_POSTED"
    | "CLOSED"
    | "CANCELLED";
  total_codes: number;
  valid_count: number;
  duplicate_count: number;
  unknown_count: number;
  invalid_count: number;
  created_at: string;
  created_by: string;
}

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
