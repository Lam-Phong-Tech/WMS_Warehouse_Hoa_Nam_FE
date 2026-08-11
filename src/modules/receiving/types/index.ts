export type InboundStatus =
  | "DRAFT"
  | "SCANNING"
  | "POSTED"
  | "CANCELLED";

export interface InboundDocument {
  id: string;
  code: string;
  source: string;
  date: string;
  warehouseId: string;
  expected: number;
  posted: number;
  remaining: number;
  status: InboundStatus;
  createdBy: string;
  updatedAt?: string;
  version: number;
  sourceReference?: string;
  note?: string;
}

export interface InboundLine {
  id: string;
  documentId: string;
  productId: string;
  sku: string;
  skuName: string;
  scanTarget: string;
  expected: number;
  scanned: number;
  posted: number;
  remaining: number;
  validation: "VALID" | "INVALID" | "UNKNOWN";
  selected: boolean;
  note?: string;
}

export interface InboundDetail {
  document: InboundDocument;
  lines: InboundLine[];
}

export interface InboundLinePayload {
  product_id: string;
  qty_planned: number;
  import_batch_id?: string | null;
  note?: string | null;
}

export interface CreateInboundPayload {
  doc_no?: string | null;
  doc_date?: string | null;
  dst_warehouse_id: string;
  source_name?: string | null;
  note?: string | null;
  lines: InboundLinePayload[];
}

export interface UpdateInboundPayload {
  doc_no?: string | null;
  doc_date?: string | null;
  source_name?: string | null;
  note?: string | null;
  lines?: InboundLinePayload[];
}

export interface ReceiptEvidence {
  receiptId: string;
  movementRef: string;
  movementRefs: string[];
  requestId: string;
  traceSource: "stock_document.movements";
  replayed?: boolean;
  version?: number;
}

/**
 * Atomic receipt posting requires both optimistic-lock and idempotency headers.
 * No posting body is sent: BE posts every fully scanned line as one transaction.
 */
export interface PostReceiptRequest {
  documentId: string;
  idempotencyKey: string;
  ifMatch: number;
}

export type InboundScanStatus = "VALID" | "DUPLICATE" | "UNKNOWN" | "INVALID";

export interface InboundScanResult {
  code_value: string;
  status: InboundScanStatus;
  sku?: string;
  line_id?: string;
  message?: string;
  version: number;
}
