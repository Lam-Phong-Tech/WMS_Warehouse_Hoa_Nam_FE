export interface OutboundDocument {
  id: string;
  code: string;
  receiverType: "AGENCY" | "OTHER";
  receiverId: string;
  receiverName: string;
  date: string;
  planned: number;
  issued: number;
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
}

export interface OutboundLine {
  id: string;
  documentId: string;
  sku: string;
  skuName: string;
  scanSource: string;
  available: number;
  planned: number;
  issued: number;
  subsetNew: number;
  validation: "VALID" | "INVALID" | "UNKNOWN";
  validationMessage?: string;
  selected: boolean;
}

export interface PostIssueRequest {
  documentId: string;
  lines: { lineId: string; quantity: number }[];
  idempotencyKey: string;
  ifMatch: number;
}

export interface IssueEvidence {
  issueId: string;
  movementRef: string;
  requestId: string;
  traceSource?: string;
  replayed?: boolean;
}

export interface CloseRemainderRequest {
  documentId: string;
  reason: string;
  idempotencyKey: string;
  ifMatch: number;
}

/** Outbound business error codes from backend */
export type OutboundErrorCode =
  | "WMS_OUTBOUND_DOCUMENT_NOT_FOUND"
  | "WMS_OUTBOUND_ALREADY_POSTED"
  | "WMS_OUTBOUND_INVALID_STATUS_TRANSITION"
  | "WMS_OUTBOUND_INSUFFICIENT_STOCK"
  | "WMS_OUTBOUND_LINE_SKU_MISMATCH"
  | "WMS_OUTBOUND_EXCEEDS_PLANNED"
  | "WMS_OUTBOUND_NEGATIVE_STOCK"
  | "WMS_OUTBOUND_IDEMPOTENCY_REPLAY"
  | "WMS_OUTBOUND_VERSION_CONFLICT";

/** Outbound scan response item */
export interface OutboundScanResult {
  code_value: string;
  status: "VALID" | "DUPLICATE" | "UNKNOWN" | "INVALID";
  sku?: string;
  line_id?: string;
  message?: string;
}
