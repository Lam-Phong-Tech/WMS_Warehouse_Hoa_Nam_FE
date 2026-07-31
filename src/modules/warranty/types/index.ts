/**
 * Warranty module types for WMS Hoa Nam.
 * Based on architecture guide: warranty case, warranty event, TEMP_ONLY support,
 * defect/status enum.
 */

/** Warranty case status */
export type WarrantyCaseStatus =
  | "OPEN"
  | "PROCESSING"
  | "WAITING_PARTS"
  | "REPAIRING"
  | "TEMP_ONLY"
  | "READY"
  | "RETURNED"
  | "RETURNED_TO_CUSTOMER"
  | "CLOSED"
  | "CANCELLED";

/** Warranty case priority */
export type WarrantyPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/** Warranty case */
export interface WarrantyCase {
  id: string;
  case_code: string;
  sku: string;
  sku_name: string;
  serial_number?: string;
  customer_name: string;
  customer_phone?: string;
  agency_name?: string;
  defect: string;
  defect_code: string;
  status: WarrantyCaseStatus;
  priority: WarrantyPriority;
  temp_only_reason?: string;
  received_at: string;
  expected_return_at?: string;
  returned_at?: string;
  created_at: string;
  created_by: string;
  notes?: string;
}

/** Warranty event */
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

/** Warranty event type */
export type WarrantyEventType =
  | "STATUS_CHANGE"
  | "NOTE_ADDED"
  | "PARTS_ORDERED"
  | "PARTS_RECEIVED"
  | "TEMP_RESOLUTION"
  | "CUSTOMER_CONTACTED"
  | "RETURNED";

/** Request to create a warranty case */
export interface CreateWarrantyCaseRequest {
  sku: string;
  serial_number?: string;
  customer_name: string;
  customer_phone?: string;
  agency_name?: string;
  defect_code: string;
  defect_description: string;
  notes?: string;
  priority?: WarrantyPriority;
}

/** Request to update warranty case status */
export interface UpdateWarrantyStatusRequest {
  status: WarrantyCaseStatus;
  reason?: string;
  idempotency_key?: string;
}

/** Warranty defect type */
export interface WarrantyDefect {
  code: string;
  name: string;
  category: string;
  description?: string;
}

/** Warranty error codes */
export type WarrantyErrorCode =
  | "WMS_WARRANTY_CASE_NOT_FOUND"
  | "WMS_WARRANTY_INVALID_STATUS_TRANSITION"
  | "WMS_WARRANTY_SKU_NOT_FOUND"
  | "WMS_WARRANTY_DUPLICATE_SERIAL"
  | "WMS_WARRANTY_TEMP_ONLY_REQUIRED";