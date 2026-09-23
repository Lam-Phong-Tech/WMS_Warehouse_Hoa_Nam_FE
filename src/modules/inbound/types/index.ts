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
  /** Distinct SKU identities from the loaded receipt lines; absent when not supplied. */
  skuCount?: number;
  posted: number;
  remaining: number;
  status: InboundStatus;
  createdBy: string;
  updatedAt?: string;
  version: number;
  sourceReference?: string;
  note?: string;
  /**
   * Phiếu còn SKU sinh ra lúc quét mà chưa đủ thông tin (tên thật + đơn vị
   * tính) nên chưa Ghi nhận nhập kho được — hay gặp nhất với phiếu do Mini App
   * gửi lên. BE tính bằng SkuInboundInfoRule, FE KHÔNG tự suy ra.
   */
  pendingProductInfo: boolean;
  /** Số SKU đang thiếu thông tin trong phiếu (0 khi đã đủ). */
  pendingProductInfoCount: number;
}

export interface InboundLine {
  id: string;
  documentId: string;
  productId: string;
  sku: string;
  skuName: string;
  /** PRODUCT/COMPONENT gắn thẳng trên dòng (BE) — không phụ thuộc danh sách SKU tải sẵn (bị giới hạn per_page). */
  productType: string;
  scanTarget: string;
  /** Compatibility field; canonical source is actual scan quantity. */
  expected: number;
  scanned: number;
  posted: number;
  remaining: number;
  validation: "VALID" | "INVALID" | "UNKNOWN";
  /**
   * SKU của dòng đã đủ thông tin để được Ghi nhận nhập kho hay chưa (BE tính
   * theo SkuInboundInfoRule, KHÔNG suy ra ở FE): SKU sinh tự động lúc quét chỉ
   * có mã, tên tạm bằng chính mã và chưa có đơn vị tính.
   */
  /** Đơn vị tính hiện tại của SKU — để form bổ sung thông tin prefill đúng. */
  productUnit: string;
  infoComplete: boolean;
  /** Các trường còn thiếu — hiện tại BE trả "sku_name" và/hoặc "unit". */
  missingInfo: string[];
  selected: boolean;
  note?: string;
}

/** Payload bổ sung thông tin cho SKU mới của một dòng phiếu nhập. */
export interface CompleteInboundLineSkuPayload {
  skuName: string;
  unit: string;
  brandId?: string | null;
  categoryId?: string | null;
  modelId?: string | null;
  powerSourceId?: string | null;
}

export interface CompleteInboundLineSkuResult {
  documentId: string;
  lineId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  unit: string;
  infoComplete: boolean;
  missingInfo: string[];
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
  lines?: InboundLinePayload[];
}

export interface UpdateInboundPayload {
  doc_no?: string | null;
  doc_date?: string | null;
  source_reference?: string | null;
  note?: string | null;
  /** Canonical GĐ1 update never edits expected lines. */
  lines?: InboundLinePayload[];
}

/**
 * GĐ1 COMPONENT theo Box: kết quả materialize dòng linh kiện (idempotent theo
 * document + SKU, qty_planned luôn 0 — số lượng đến từ scan/đếm thực tế).
 */
export interface ComponentLineEnsureResult {
  line_id: string;
  document_id: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  is_serial_tracked: boolean;
  scanned_qty: number;
  quantity_source: "ACTUAL_CODE_SCAN" | "ACTUAL_BOX_COUNT";
}

export interface InboundScanEntry {
  id: string;
  lineId: string;
  itemId?: string;
  itemCode?: string;
  serialNumber?: string;
  containerId?: string;
  containerCode?: string;
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

export interface ReceiptEvidenceMovement {
  id: string;
  /** movement_no đọc được (vd "MV-20260830-A1B2C3D4") — thiếu ở response cũ/replay trước khi BE thêm trường này. */
  code?: string;
}

export interface ReceiptEvidence {
  receiptId: string;
  /** doc_no đọc được (vd "PN-20260830153015-A1B2") — thiếu ở response cũ/replay trước khi BE thêm trường này. */
  receiptCode?: string;
  movementRef: string;
  movementRefs: string[];
  movements: ReceiptEvidenceMovement[];
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
