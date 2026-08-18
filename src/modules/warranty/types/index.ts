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
  sales_trace_status?: string;
  serial_number?: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  purchase_date?: string;
  masked_customer_name?: string;
  masked_customer_phone?: string;
  /**
   * §13.8: true = tên/SĐT/địa chỉ đang ở dạng mask. `resolveWarrantyPii` chốt cờ này
   * fail-closed (BE báo đã mask HOẶC actor thiếu `warranty.pii.view`), nên UI đọc cờ
   * này thay vì tự suy từ danh sách quyền phía client.
   */
  pii_masked: boolean;
  agency_name?: string;
  defect: string;
  defect_code: string;
  defect_id?: string;
  reported_defect?: string;
  confirmed_defect?: string;
  accessories_received?: string;
  received_condition?: string;
  condition_status?: string;
  cancel_reason?: string;
  status: WarrantyCaseStatus;
  priority: WarrantyPriority;
  missing_code_reason?: string;
  manual_product_description?: string;
  item_status?: string;
  warehouse_name?: string;
  received_at: string;
  expected_return_at?: string;
  completed_at?: string;
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
  // Taxonomy ERD §46 (backend hiện hành)
  | "RECEIVE"
  | "CHECK"
  | "REPAIR"
  | "COMPLETE"
  | "RETURN"
  | "CANCEL"
  | "NOTE"
  | "TEMP_ONLY"
  // Giá trị legacy còn trong dữ liệu cũ
  | "RECEIVED"
  | "STATUS_CHANGE"
  | "NOTE_ADDED"
  | "PARTS_ORDERED"
  | "PARTS_RECEIVED"
  | "TEMP_RESOLUTION"
  | "CUSTOMER_CONTACTED"
  | "RETURNED";

export type WarrantyAttachmentType =
  | "INTAKE"
  | "DIAGNOSTIC"
  | "RETURN"
  | "OTHER";

export interface WarrantyAttachment {
  id: string;
  warranty_case_id: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  checksum?: string;
  attachment_type: WarrantyAttachmentType;
  status: "ACTIVE" | "DELETED" | "QUARANTINED";
  uploaded_at?: string;
  uploaded_by?: string;
}

export interface WarrantyListParams {
  search?: string;
  keyword?: string;
  status?: WarrantyCaseStatus | string;
  identification_status?: WarrantyIdentificationType | string;
  defect_id?: string;
  page?: number;
  per_page?: number;
}

export interface WarrantyCasePage {
  data: WarrantyCase[];
  meta?: Record<string, unknown>;
}

export interface CreateWarrantyCaseRequest {
  identification_type: WarrantyIdentificationType;
  item_code?: string;
  sku?: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  purchase_date?: string;
  agency_name?: string;
  defect_id?: string;
  defect_code?: string;
  defect_description: string;
  reported_defect?: string;
  accessories_received?: string;
  received_condition?: string;
  missing_code_reason?: string;
  manual_product_description?: string;
  consent_contact?: boolean;
  consent_photo?: boolean;
  notes?: string;
  priority?: WarrantyPriority;
}

export interface UpdateWarrantyCaseRequest {
  status?: WarrantyCaseStatus;
  /** Ghi chú/evidence hiển thị trên timeline. */
  reason?: string;
  confirmed_defect?: string;
  condition_status?: string;
  received_condition?: string;
  accessories_received?: string;
  cancel_reason?: string;
  /** Annex D SCR-WAR-01: gán/sửa bệnh-lỗi danh mục khi CHECKING có kết luận. */
  defect_id?: string;
  /** PII — chỉ gửi khi actor có `warranty.pii.view`; BE trả 403 nếu thiếu quyền. */
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  purchase_date?: string;
  idempotency_key?: string;
  ifMatch?: number;
}

/** @deprecated dùng UpdateWarrantyCaseRequest. */
export type UpdateWarrantyStatusRequest = UpdateWarrantyCaseRequest;

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
