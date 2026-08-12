/** Warranty module types aligned with the current /api/v1/warranty-cases contract. */
export type WarrantyCaseStatus =
  | "RECEIVED"
  | "CHECKING"
  | "REPAIRING"
  | "COMPLETED"
  | "RETURNED"
  | "CANCELLED"
  // Compatibility aliases accepted only when reading older data snapshots.
  | "OPEN"
  | "PROCESSING"
  | "WAITING_PARTS"
  | "READY"
  | "RETURNED_TO_CUSTOMER"
  | "CLOSED";

export type WarrantyIdentificationType = "IDENTIFIED" | "TEMP_ONLY";
export type WarrantyPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface WarrantyCase {
  id: string;
  case_code: string;
  sku: string;
  sku_name: string;
  item_code?: string;
  item_id?: string;
  physical_code?: string;
  temporary_item_code?: string;
  identification_type: WarrantyIdentificationType;
  serial_number?: string;
  customer_name: string;
  customer_phone?: string;
  masked_customer_name?: string;
  masked_customer_phone?: string;
  agency_name?: string;
  defect: string;
  defect_code: string;
  defect_id?: string;
  status: WarrantyCaseStatus;
  priority: WarrantyPriority;
  missing_code_reason?: string;
  manual_product_description?: string;
  item_status?: string;
  warehouse_name?: string;
  received_at: string;
  expected_return_at?: string;
  returned_at?: string;
  case_age_days?: number;
  created_at: string;
  created_by: string;
  notes?: string;
  version: number;
}

export interface WarrantyEvent {
  id: string;
  case_id: string;
  event_type: WarrantyEventType;
  from_status?: WarrantyCaseStatus;
  to_status: WarrantyCaseStatus;
  description: string;
  performed_by: string;
  performed_at: string;
}

export type WarrantyEventType =
  | "RECEIVED"
  | "STATUS_CHANGE"
  | "NOTE_ADDED"
  | "PARTS_ORDERED"
  | "PARTS_RECEIVED"
  | "TEMP_RESOLUTION"
  | "CUSTOMER_CONTACTED"
  | "RETURNED";

export interface CreateWarrantyCaseRequest {
  identification_type: WarrantyIdentificationType;
  item_code?: string;
  sku?: string;
  customer_name: string;
  customer_phone: string;
  agency_name?: string;
  defect_code: string;
  defect_description: string;
  missing_code_reason?: string;
  manual_product_description?: string;
  consent_contact?: boolean;
  consent_photo?: boolean;
  notes?: string;
  priority?: WarrantyPriority;
}

export interface UpdateWarrantyStatusRequest {
  status: WarrantyCaseStatus;
  reason?: string;
  /** Kept for caller compatibility; current BE uses If-Match rather than body idempotency. */
  idempotency_key?: string;
  ifMatch?: number;
}

export interface WarrantyDefect {
  code: string;
  name: string;
  category: string;
  description?: string;
}

export type WarrantyErrorCode =
  | "WMS_WARRANTY_CASE_NOT_FOUND"
  | "WMS_WARRANTY_INVALID_STATUS_TRANSITION"
  | "WMS_WARRANTY_SKU_NOT_FOUND"
  | "WMS_WARRANTY_DUPLICATE_SERIAL"
  | "WMS_WARRANTY_TEMP_ONLY_REQUIRED"
  | "WMS_WARRANTY_ITEM_NOT_FOUND"
  | "WMS_WARRANTY_DEFECT_NOT_FOUND"
  | "WMS_WARRANTY_VERSION_CONFLICT";
