/**
 * Reverse (Reversal) module types for WMS Hoa Nam.
 * Based on architecture guide: reversal document, reference, transaction, audit.
 */

/** Reversal document status */
export type ReversalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REVERSED"
  | "CANCELLED"
  | "REJECTED";

/** Reversal type */
export type ReversalType =
  | "INBOUND_REVERSE"
  | "OUTBOUND_REVERSE"
  | "STOCKTAKE_ADJUSTMENT"
  | "MANUAL_ADJUSTMENT"
  | "SYSTEM_CORRECTION";

/** Reversal document */
export interface ReversalDocument {
  id: string;
  reversal_code: string;
  reversal_type: ReversalType;
  status: ReversalStatus;
  reference_document_type: string;
  reference_document_code: string;
  reference_document_id: string;
  warehouse_id: number;
  warehouse_name: string;
  total_lines: number;
  total_qty: number;
  reason: string;
  reversed_at?: string;
  created_at: string;
  created_by: string;
  approved_by?: string;
  notes?: string;
}

/** Reversal line item */
export interface ReversalLine {
  id: string;
  reversal_id: string;
  sku: string;
  sku_name: string;
  original_qty: number;
  reversal_qty: number;
  remaining_qty: number;
  status: "PENDING" | "REVERSED" | "SKIPPED" | "ERROR";
  error_message?: string;
}

/** Request to create a reversal */
export interface CreateReversalRequest {
  reversal_type: ReversalType;
  reference_document_id: string;
  reference_document_type: string;
  reason: string;
  lines: Array<{
    sku: string;
    reversal_qty: number;
    reason?: string;
  }>;
  idempotency_key: string;
}

/** Reversal response */
export interface CreateReversalResponse {
  id: string;
  reversal_code: string;
  status: ReversalStatus;
  total_qty: number;
  reversed_lines: number;
  errors?: Array<{
    sku: string;
    error_code: string;
    message: string;
  }>;
}

/** Reversal error codes */
export type ReversalErrorCode =
  | "WMS_REVERSAL_DOCUMENT_NOT_FOUND"
  | "WMS_REVERSAL_ALREADY_REVERSED"
  | "WMS_REVERSAL_INSUFFICIENT_STOCK"
  | "WMS_REVERSAL_INVALID_REFERENCE"
  | "WMS_REVERSAL_EXCEEDS_ORIGINAL"
  | "WMS_REVERSAL_LINE_SKU_MISMATCH";