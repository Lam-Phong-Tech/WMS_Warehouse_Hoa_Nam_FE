export type InboundStatus = "DRAFT" | "SCANNING" | "POSTED" | "CANCELLED";

export interface InboundDocument {
  id: string;
  code: string;
  /** Giá trị hiển thị của Annex A `source_reference` (BE lưu ở cột source_name). */
  source: string;
  date: string;
  warehouseId: string;
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
  /** Existing line id is required by BE when correcting Expected after scan evidence exists. */
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
  /** Annex A / Annex D SCR-IN-01: tên field chuẩn là `source_reference`, max 200. */
  source_reference?: string | null;
  note?: string | null;
  lines: InboundLinePayload[];
}

export interface UpdateInboundPayload {
  doc_no?: string | null;
  doc_date?: string | null;
  source_reference?: string | null;
  note?: string | null;
  lines?: InboundLinePayload[];
}

/**
 * Annex D SCR-IN-01: bảng "mã / SKU / kết quả / nguồn" của phiếu nhập phải đọc lại
 * được sau khi tải lại trang, nên nó là dữ liệu server chứ không phải state phiên.
 */
export interface InboundScanEntry {
  id: string;
  lineId: string;
  itemId?: string;
  itemCode?: string;
  serialNumber?: string;
  containerId?: string;
  sku: string;
  skuName: string;
  quantity: number;
  /** CAMERA_OR_MANUAL_CODE khi có code_value, MANUAL khi chọn item/quantity trực tiếp. */
  scanSource: string;
  status: "ACTIVE" | "REMOVED";
  capturedAt?: string;
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
  /**
   * WWHN-187 (DEV187-P1-07) — key đã dùng cho đúng *hành động quét* này. Lần gửi
   * lại của cùng hành động phải dùng lại đúng key này (AC-GWT-CONC-001: không bao
   * giờ retry bằng key mới), nếu không BE coi đó là một lần quét thật thứ hai và
   * `scanned_qty` bị cộng đôi.
   */
  idempotency_key?: string;
  /**
   * `true` khi BE trả lại snapshot của lần quét trước (replay) — `scanned_qty`
   * KHÔNG tăng thêm. UI phải nói rõ để người dùng không quét bù thêm một lần.
   */
  replayed?: boolean;
}
