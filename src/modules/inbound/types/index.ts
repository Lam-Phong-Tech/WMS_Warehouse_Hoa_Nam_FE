export type InboundStatus = "DRAFT" | "SCANNING" | "POSTED" | "CANCELLED";

export interface InboundDocument {
  id: string;
  code: string;
  source: string;
  date: string;
  warehouseId: string;
  /** Under the GĐ1 scan-driven contract this mirrors actual scanned quantity. */
  expected: number;
  scanned: number;
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
  /** Compatibility field; canonical source is actual scan quantity. */
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

/**
 * Legacy shape kept only for response/read compatibility. GĐ1 UI must not submit
 * manual inbound lines; SKU and quantity are derived from physical scans.
 */
export interface InboundLinePayload {
  id?: string;
  product_id: string;
  qty_planned: number;
  import_batch_id?: string | null;
  note?: string | null;
}

export interface CreateInboundPayload {
  doc_no?: string | null;
  doc_date?: string | null;
  dst_warehouse_id: string;
  source_reference?: string | null;
  note?: string | null;
  /** Canonical GĐ1 create is header-only. */
  lines?: [];
}

export interface UpdateInboundPayload {
  doc_no?: string | null;
  doc_date?: string | null;
  source_reference?: string | null;
  note?: string | null;
  /** Canonical GĐ1 update never edits expected lines. */
  lines?: [];
}

export interface InboundScanEntry {
  id: string;
  lineId: string;
  itemId?: string;
  itemCode?: string;
  serialNumber?: string;
  containerId?: string;
  candidateItemUnique?: string;
  candidateSerialNumber?: string;
  sku: string;
  skuName: string;
  quantity: number;
  scanSource: string;
  status: "ACTIVE" | "REMOVED";
  capturedAt?: string;
}

export interface ActiveCarton {
  id: string;
  code: string;
  skuId?: string;
}

export interface InboundCartonCompleteResult {
  documentId: string;
  containerId: string;
  cartonCode: string;
  actualItemQty: number;
  completedAt?: string;
}

export interface InboundUnscanResult {
  documentId: string;
  lineId: string;
  entryId: string;
  itemId?: string;
  status: "REMOVED";
  requiredQuantity: number;
  scannedQuantity: number;
  version: number;
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
  item_id?: string;
  item_unique?: string;
  serial_number?: string;
  payload_format?: "COMPOSITE_V1" | "LEGACY_CODE_VALUE";
  resolution_status?: "NEW_ITEM_CANDIDATE" | "EXISTING_ITEM" | "LEGACY_ITEM";
  message?: string;
  version: number;
  idempotency_key?: string;
  replayed?: boolean;
}
