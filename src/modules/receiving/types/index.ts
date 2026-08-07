export interface InboundDocument {
  id: string;
  code: string;
  source: string;
  date: string;
  expected: number;
  posted: number;
  remaining: number;
  status:
    | "DRAFT"
    | "SCANNING"
    | "PARTIALLY_POSTED"
    | "POSTED"
    | "CLOSED"
    | "CANCELLED";
  createdBy: string;
  version: number;
  sourceReference?: string;
}

export interface InboundLine {
  id: string;
  documentId: string;
  productId?: string;
  sku: string;
  skuName: string;
  scanTarget: string;
  expected: number;
  scanned: number;
  posted: number;
  remaining: number;
  validation: "VALID" | "INVALID" | "UNKNOWN";
  selected: boolean;
}

export interface ReceiptEvidence {
  receiptId: string;
  movementRef: string;
  movementRefs?: string[];
  requestId: string;
  traceSource?: string;
  replayed?: boolean;
}

/**
 * WWHN-180 v1.7 posts the approved document atomically as a whole. `lines`
 * and `ifMatch` remain optional only so existing UI callers can migrate without
 * a breaking type change; the service never serializes them to the canonical
 * posting request.
 */
export interface PostReceiptRequest {
  documentId: string;
  lines?: { lineId: string; quantity: number }[];
  idempotencyKey: string;
  ifMatch?: number;
}

export interface CloseRemainderRequest {
  documentId: string;
  reason: string;
}

export type InboundErrorCode =
  | "WMS_INBOUND_DOCUMENT_NOT_FOUND"
  | "WMS_INBOUND_ALREADY_POSTED"
  | "WMS_INBOUND_INVALID_STATUS_TRANSITION"
  | "WMS_INBOUND_LINE_SKU_MISMATCH"
  | "WMS_INBOUND_EXCEEDS_EXPECTED"
  | "WMS_INBOUND_DUPLICATE_SCAN"
  | "WMS_INBOUND_IDEMPOTENCY_REPLAY"
  | "WMS_INBOUND_VERSION_CONFLICT";

export interface InboundScanResult {
  code_value: string;
  status: "VALID" | "DUPLICATE" | "UNKNOWN" | "INVALID";
  sku?: string;
  line_id?: string;
  message?: string;
}
