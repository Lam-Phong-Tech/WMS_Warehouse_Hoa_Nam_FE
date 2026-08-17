/**
 * Reverse (Reversal) module types — luồng 05 · Tồn kho & kiểm soát.
 *
 * Nguồn: SRS/FRD v1.12 §5.5 (BR-REV-01..12), §6 State Model, Annex C
 * (postReceiptReversal / postIssueReversal) và ERD bảng 33/34.
 */

/**
 * §6: Reversal chạy DRAFT → CONFIRMED → POSTED, POSTED/CANCELLED là terminal.
 * ERD bảng 33 giữ `status` ∈ DRAFT/POSTED/CANCELLED nên bước CONFIRMED được biểu diễn
 * bằng `physical_return_status` (xem ReversalPhysicalReturnStatus) — đây là quyết định
 * kiến trúc của BE, không phải trạng thái thứ tư.
 */
export type ReversalStatus = "DRAFT" | "POSTED" | "CANCELLED";

/** BR-REV-06: Reverse Issue chỉ cộng tồn khi hàng vật lý đã quay lại kho. */
export type ReversalPhysicalReturnStatus = "PENDING_RETURN" | "CONFIRMED";

/** ERD bảng 33 original_document_type. MVP chỉ đảo Receipt/Issue (Annex C). */
export type ReversalOriginalDocumentType = "INBOUND" | "OUTBOUND";

/** BR-REV-06/07: tình trạng hàng quay về khi Reverse Issue. */
export type ReversalReturnCondition = "SELLABLE" | "DEFECTIVE" | "NON_SELLABLE";

/** ERD bảng 29/30 stock_status. */
export type ReversalStockStatus =
  | "AVAILABLE"
  | "NON_SELLABLE"
  | "DEFECTIVE"
  | "QUARANTINE";

/** Reversal document header (ERD bảng 33). */
export interface ReversalDocument {
  id: string;
  reversal_code: string;
  status: ReversalStatus;
  physical_return_status?: ReversalPhysicalReturnStatus;
  condition_status?: ReversalReturnCondition;
  reference_document_type: ReversalOriginalDocumentType | string;
  reference_document_code: string;
  reference_document_id: string;
  /** BR-REV-04/08: khoá liên kết chuỗi Reversal append-only. */
  correction_chain_id?: string;
  warehouse_id: string;
  warehouse_name: string;
  total_lines: number;
  total_qty: number;
  reason_code?: string;
  reason: string;
  reversed_at?: string;
  created_at: string;
  created_by: string;
  posted_by?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  /** Optimistic lock — BR-REV-02 bắt buộc gửi lại qua If-Match. */
  version: number;
}

/** Reversal line (ERD bảng 34) — đúng field Annex D SCR-REV-01. */
export interface ReversalLine {
  id: string;
  reversal_id: string;
  line_no: number;
  original_movement_id: string;
  original_movement_code?: string;
  sku: string;
  sku_name: string;
  uom?: string;
  item_id?: string;
  item_code?: string;
  serial_number?: string;
  /** Số lượng của chính movement gốc, KHÔNG phải số lượng đảo. */
  original_qty: number;
  reversal_qty: number;
  reversed_qty: number;
  remaining_qty: number;
  return_condition?: ReversalReturnCondition;
  stock_status?: ReversalStockStatus;
  posted_movement_id?: string;
  status: ReversalStatus;
  reason?: string;
}

/** Ứng viên item cho Reverse SKU serial-tracked (BE /stock-movements/reversible). */
export interface ReversibleItemCandidate {
  item_id: string;
  sku_id: string;
  item_code?: string;
  serial_number?: string;
  item_status: string;
}

export interface ReversibleMovementLine {
  id: string;
  sku: string;
  sku_name: string;
  original_qty: number;
  reversed_qty: number;
  reversible_qty: number;
  remaining_qty: number;
  uom?: string;
  /** BR-REV-03/04: lý do bị chặn khi còn dependency downstream. */
  dependency_guard?: string;
  can_reverse: boolean;
  /** SKU serial-tracked: BE bắt buộc reverse theo item (quantity=1 + item_id). */
  is_serial_tracked?: boolean;
  items?: ReversibleItemCandidate[];
}

export interface ReversibleMovement {
  id: string;
  movement_code: string;
  movement_type: "RECEIPT" | "ISSUE" | string;
  source_document_type: string;
  source_document_id: string;
  source_document_code: string;
  warehouse_id: string;
  warehouse_name: string;
  posted_at: string;
  posted_by?: string;
  version?: string;
  dependency_guard?: string;
  can_reverse: boolean;
  lines: ReversibleMovementLine[];
}

export interface ReversalLookupParams {
  search?: string;
  warehouse_id?: string;
  movement_type?: string;
  reversible_only?: boolean;
  per_page?: number;
}

/** Request to create a reversal (Annex C ReversalRequest). */
export interface CreateReversalRequest {
  reference_document_id: string;
  reference_document_type: string;
  reason: string;
  /** Bắt buộc với Reverse Issue; chỉ SELLABLE mới cộng available_qty. */
  return_condition?: ReversalReturnCondition;
  /** Xác nhận hàng vật lý đã quay lại kho (điều kiện cộng tồn theo BR-REV-06). */
  physical_return_confirmed?: boolean;
  lines: Array<{
    sku: string;
    reversal_qty: number;
    reason?: string;
    /** Bắt buộc với SKU serial-tracked (mỗi line 1 item, quantity=1). */
    item_id?: string;
  }>;
  idempotency_key: string;
  reference_version?: string;
}

/** Annex C ReversalResult. */
export interface CreateReversalResponse {
  id: string;
  reversal_code: string;
  status: ReversalStatus;
  total_qty: number;
  reversed_lines: number;
}

/** BR-REV-02/12: mọi lifecycle op đều cần If-Match; Post cần thêm Idempotency-Key. */
export interface ReversalLifecycleRequest {
  id: string;
  version: number;
}

export interface ReversalConfirmRequest extends ReversalLifecycleRequest {
  return_condition?: ReversalReturnCondition;
}

export interface ReversalPostRequest extends ReversalLifecycleRequest {
  idempotency_key: string;
}

export interface ReversalCancelRequest extends ReversalLifecycleRequest {
  reason: string;
}
