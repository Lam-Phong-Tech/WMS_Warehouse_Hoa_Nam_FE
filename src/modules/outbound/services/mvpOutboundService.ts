import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type { ApiMeta } from "@/shared/types/api-response";

export type OutboundStatus = "DRAFT" | "SCANNING" | "POSTED" | "CANCELLED";

type RawRecord = Record<string, unknown>;

export interface OutboundLineRecord {
  id: string;
  documentId: string;
  productId: string;
  /** Mã SKU đọc được (BE enrich từ bảng sku); fallback về productId khi thiếu. */
  skuCode?: string | null;
  skuName?: string | null;
  expected: number;
  scanned: number;
  remaining: number;
  note?: string | null;
}

export interface OutboundDocumentRecord {
  id: string;
  code: string;
  date: string;
  warehouseId: string;
  outboundRequestId?: string | null;
  /** Mã toa đọc được (BE enrich từ outbound_requests.request_no); fallback về outboundRequestId khi thiếu. */
  requestNo?: string | null;
  agencyId?: string | null;
  recipientName: string;
  recipientAddress: string;
  note?: string | null;
  expected: number;
  scanned: number;
  status: OutboundStatus;
  version: number;
  createdBy: string;
  updatedAt?: string;
  /** Aggregate BE trả kèm ở GET /outbound-documents (SCR-OUT-01). */
  matchedCount?: number;
  labelPrintedCount?: number;
  rfidMappedCount?: number;
}

export interface OutboundItemMatchRecord {
  id: string;
  lineId: string;
  itemId?: string | null;
  containerId?: string | null;
  skuId: string;
  itemCode?: string | null;
  serialNumber?: string | null;
  quantity: number;
  status: "ACTIVE" | "REMOVED" | "POSTED";
  matchedAt?: string;
  removedAt?: string | null;
  labelSnapshotId?: string | null;
  labelStatus?: string | null;
  rfidCode?: string | null;
}

export interface OutboundMovementRecord {
  id: string;
  movementType: string;
  productId?: string | null;
  quantity: number;
  createdAt?: string;
}

export interface OutboundStatusHistoryRecord {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  changedAt?: string;
  changedBy?: string | null;
  note?: string | null;
}

export interface OutboundDetail {
  document: OutboundDocumentRecord;
  lines: OutboundLineRecord[];
  itemMatches: OutboundItemMatchRecord[];
  movements: OutboundMovementRecord[];
  statusHistory: OutboundStatusHistoryRecord[];
}

export interface OutboundListResult {
  data: OutboundDocumentRecord[];
  meta: ApiMeta;
}

export interface OutboundLinePayload {
  product_id: string;
  qty_planned: number;
  note?: string | null;
}

// WWHN-195 / DEV195-P1-05R2 — đã gỡ hai cặp payload+hàm gọi endpoint không tồn tại:
//
//   - `CreateOutboundPayload` + `createOutboundDocument()` → POST /outbound-documents
//   - `UpdateOutboundPayload` + `updateOutboundDocument()` → PATCH /outbound-documents/{id}
//
// SRS v1.12 §8.1/Annex C: "Confirm creates exactly one outbound DRAFT; no direct
// POST /outbound-documents create operation" — BE không đăng ký hai route này nên
// mọi lần gọi chỉ trả 404. Giữ lại trong service chỉ tạo ảo giác rằng FE còn một
// đường tạo/sửa phiếu trực tiếp.
//
// Đường đúng: OutboundIntakeModal → POST /outbound-request-imports (hoặc
// /manual) → POST /outbound-request-imports/{id}/confirm, Confirm sinh đúng 01
// outbound DRAFT và chốt luôn recipient/địa chỉ/SĐT (REQ-SRS-014).

export interface OutboundScanResult {
  codeValue: string;
  documentId: string;
  lineId: string;
  itemId?: string | null;
  /**
   * Change Pack QR/SKU (DEC-QR-001): identity BE parse từ composite QR — FE chỉ
   * hiển thị, không tự tách SKU/serial từ raw payload.
   */
  skuCode?: string | null;
  itemUnique?: string | null;
  payloadFormat?: "COMPOSITE_V1" | "LEGACY_CODE_VALUE" | null;
  resolutionStatus?: "EXISTING_ITEM" | "LEGACY_ITEM" | null;
  quantity: number;
  expected: number;
  scanned: number;
  version: number;
  labelSnapshotId?: string | null;
  labelStatus?: string | null;
  printError?: string | null;
  /** Mode server đã ghi vào scan evidence (ERD bảng 25). */
  scanSource?: "CAMERA" | "MANUAL" | "HARDWARE" | null;
  /** EXPLICIT khi FE khai; INFERRED khi server tự suy luận. */
  scanSourceOrigin?: "EXPLICIT" | "INFERRED" | null;
}

export interface IssueEvidenceMovement {
  id: string;
  /** movement_no đọc được (vd "MV-20260830-A1B2C3D4"); thiếu ở response cũ/replay. */
  code?: string;
}

export interface IssueEvidence {
  documentId: string;
  /** doc_no đọc được (vd "PX-20260830153015-A1B2"); thiếu ở response cũ/replay. */
  documentCode?: string;
  status: "POSTED";
  movementRefs: string[];
  movements: IssueEvidenceMovement[];
  requestId: string;
  version: number;
  replayed?: boolean;
}

export interface OutboundRequestRowInput {
  request_no: string;
  /** §5.2: ngày toa do Kinh doanh phát hành (nullable, không được ở tương lai). */
  request_date?: string;
  customer_name: string;
  // SRS v1.12 §15 + REQ-SRS-014: address/phone nullable — toa nguồn có thể để trống.
  customer_address?: string;
  recipient_contact_phone?: string;
  sku_id?: string;
  sku_code?: string;
  required_qty: number;
  agency_id?: string | null;
}

export interface OutboundImportRow {
  id: string;
  rowNo: number;
  status: string;
  normalized: RawRecord;
  errors: Array<{
    row?: number;
    field?: string;
    error_code?: string;
    message?: string;
  }>;
}

export interface OutboundImportResult {
  id: string;
  importNo: string;
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  /** Annex C confirmOutboundRequestImport dùng version này cho If-Match. */
  version: number;
  rows: OutboundImportRow[];
}

export interface ConsumeOutboundImportResult {
  importId: string;
  status: string;
  outboundRequestIds: string[];
  outboundDocumentIds: string[];
}

export interface LabelSnapshotRecord {
  id: string;
  labelCode?: string | null;
  documentId?: string | null;
  itemMatchId?: string | null;
  itemId?: string | null;
  skuId?: string | null;
  skuCode?: string | null;
  skuName?: string | null;
  itemCodeValue?: string | null;
  recipientName?: string | null;
  recipientAddress?: string | null;
  status: string;
  reprintCount: number;
  outboundNo?: string | null;
  payload: RawRecord;
}

export interface PrinterConfigRecord {
  id: string;
  code: string;
  name: string;
  status: string;
  labelSize?: string | null;
  lastHealthAt?: string | null;
  lastHealthResult?: string | null;
}

export interface PhysicalCodeRecord {
  id: string;
  codeValue: string;
  carrierType: string;
  hardwareUid?: string | null;
  itemId?: string | null;
  status: string;
  version: number;
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value)
    ? value
    : Array.isArray(value.data)
      ? value.data
      : [];
}

function endpoint(
  template: string,
  id: string,
  params: Record<string, string> = {},
): string {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    template.replace(":id", encodeURIComponent(id)),
  );
}

function parseJsonObject(value: unknown): RawRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as RawRecord;
  }
  if (typeof value !== "string" || value.trim() === "") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as RawRecord)
      : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: unknown): OutboundImportRow["errors"] {
  if (Array.isArray(value)) return value as OutboundImportRow["errors"];
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as OutboundImportRow["errors"]) : [];
  } catch {
    return [];
  }
}

function normalizeStatus(value: unknown): OutboundStatus {
  const status = text(value).toUpperCase();
  if (status === "SCANNING" || status === "POSTED" || status === "CANCELLED") {
    return status;
  }
  return "DRAFT";
}

function rawLines(row: RawRecord): RawRecord[] {
  return rowsOf((row.lines ?? []) as RawRecord[] | { data?: RawRecord[] });
}

function normalizeLine(row: RawRecord, documentId: string): OutboundLineRecord {
  const expected = num(row.qty_planned ?? row.required_qty ?? row.quantity);
  const scanned = num(row.scanned_qty ?? row.qty_scanned);
  return {
    id: text(row.id ?? row.stock_document_line_id),
    documentId,
    productId: text(row.product_id ?? row.sku_id),
    skuCode: text(row.sku_code) || null,
    skuName: text(row.sku_name ?? row.product_name) || null,
    expected,
    scanned,
    remaining: Math.max(expected - scanned, 0),
    note: row.note === undefined || row.note === null ? null : text(row.note),
  };
}

function optionalNum(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function normalizeDocument(row: RawRecord): OutboundDocumentRecord {
  const id = text(row.id ?? row.stock_document_id);
  const lines = rawLines(row).map((line) => normalizeLine(line, id));
  const expected = lines.reduce((sum, line) => sum + line.expected, 0);
  const scanned = lines.reduce((sum, line) => sum + line.scanned, 0);
  return {
    matchedCount: optionalNum(row.matched_count),
    labelPrintedCount: optionalNum(row.label_printed_count),
    rfidMappedCount: optionalNum(row.rfid_mapped_count),
    id,
    code: text(row.doc_no ?? row.document_no ?? row.code, id),
    date: text(row.doc_date ?? row.created_at),
    warehouseId: text(row.src_warehouse_id ?? row.warehouse_id),
    outboundRequestId: text(row.outbound_request_id) || null,
    requestNo: text(row.request_no) || null,
    agencyId: text(row.agency_id) || null,
    recipientName: text(row.recipient_name ?? row.customer_name, "-"),
    recipientAddress: text(row.recipient_address ?? row.customer_address, "-"),
    note: row.note === undefined || row.note === null ? null : text(row.note),
    expected,
    scanned,
    status: normalizeStatus(row.status),
    version: num(row.version),
    createdBy: text(row.created_by_name ?? row.created_by, "-"),
    updatedAt: text(row.updated_at) || undefined,
  };
}

function normalizeItemMatch(row: RawRecord): OutboundItemMatchRecord {
  const status = text(row.status, "ACTIVE").toUpperCase();
  return {
    id: text(row.id),
    lineId: text(row.line_id ?? row.outbound_line_id),
    itemId: text(row.item_id) || null,
    containerId: text(row.container_id) || null,
    skuId: text(row.sku_id ?? row.product_id),
    itemCode: text(row.item_code) || null,
    serialNumber: text(row.serial_number) || null,
    quantity: num(row.quantity ?? 1) || 1,
    status:
      status === "REMOVED" || status === "POSTED"
        ? (status as "REMOVED" | "POSTED")
        : "ACTIVE",
    matchedAt: text(row.matched_at) || undefined,
    removedAt: text(row.removed_at) || null,
    labelSnapshotId: text(row.label_snapshot_id) || null,
    labelStatus: text(row.label_status) || null,
    rfidCode: text(row.rfid_code) || null,
  };
}

function normalizeMovement(row: RawRecord): OutboundMovementRecord {
  return {
    id: text(row.id ?? row.movement_id),
    movementType: text(row.movement_type ?? row.type, "-"),
    productId: text(row.product_id ?? row.sku_id) || null,
    quantity: num(row.quantity ?? row.qty ?? row.quantity_delta),
    createdAt: text(row.created_at ?? row.occurred_at) || undefined,
  };
}

function normalizeStatusHistory(row: RawRecord): OutboundStatusHistoryRecord {
  return {
    id: text(row.id),
    fromStatus: text(row.from_status ?? row.old_status) || null,
    toStatus: text(row.to_status ?? row.new_status ?? row.status, "-"),
    changedAt: text(row.created_at ?? row.changed_at) || undefined,
    changedBy:
      text(row.changed_by_name ?? row.created_by_name ?? row.changed_by) ||
      null,
    note: text(row.note ?? row.reason) || null,
  };
}

function normalizeDetail(row: RawRecord): OutboundDetail {
  const document = normalizeDocument(row);
  const movements = rowsOf(
    (row.movements ?? []) as RawRecord[] | { data?: RawRecord[] },
  ).map(normalizeMovement);
  const statusHistory = rowsOf(
    (row.status_history ?? row.statusHistory ?? []) as
      | RawRecord[]
      | { data?: RawRecord[] },
  ).map(normalizeStatusHistory);
  const itemMatches = rowsOf(
    (row.item_matches ?? []) as RawRecord[] | { data?: RawRecord[] },
  ).map(normalizeItemMatch);
  return {
    document,
    lines: rawLines(row).map((line) => normalizeLine(line, document.id)),
    itemMatches,
    movements,
    statusHistory,
  };
}

function headers(ifMatch?: number, idempotencyKey?: string) {
  return {
    headers: {
      ...(ifMatch !== undefined ? { "If-Match": String(ifMatch) } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
  };
}

export async function fetchOutboundDocuments(
  params: {
    search?: string;
    status?: string;
    page?: number;
    per_page?: number;
  } = {},
): Promise<OutboundListResult> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.OUTBOUND_DOCUMENTS,
    {
      params: {
        ...(params.search ? { keyword: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        page: params.page ?? 1,
        per_page: params.per_page ?? 10,
      },
    },
  );
  return {
    data: rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
      normalizeDocument,
    ),
    meta: result.meta,
  };
}

/**
 * Backend clamp per_page tối đa 100; các màn cần "toàn bộ" label/RFID phải
 * gom nhiều trang. Cap số trang để tránh loop vô hạn khi meta bất thường.
 */
async function fetchAllPages(
  endpointPath: string,
  params: Record<string, unknown>,
  maxPages = 10,
): Promise<RawRecord[]> {
  const rows: RawRecord[] = [];
  let page = 1;
  for (;;) {
    const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
      endpointPath,
      { params: { ...params, page, per_page: 100 } },
    );
    const chunk = rowsOf(result.data as RawRecord[] | { data?: RawRecord[] });
    rows.push(...chunk);
    const lastPage = num(result.meta.last_page ?? 1) || 1;
    if (page >= lastPage || page >= maxPages || chunk.length === 0) break;
    page += 1;
  }
  return rows;
}

export async function fetchOutboundDetail(id: string): Promise<OutboundDetail> {
  return normalizeDetail(
    await http.get<RawRecord>(endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, id)),
  );
}

// `createOutboundDocument()` đã gỡ — xem ghi chú ở chỗ khai báo payload phía trên.

// `updateOutboundDocument()` đã gỡ — xem ghi chú ở chỗ UpdateOutboundPayload.

export async function cancelOutboundDocument(
  id: string,
  reason: string,
  ifMatch: number,
): Promise<OutboundDetail> {
  return normalizeDetail(
    await http.post<RawRecord>(
      endpoint(API_ENDPOINTS.OUTBOUND_CANCEL, id),
      { reason },
      headers(ifMatch),
    ),
  );
}

/**
 * WWHN-195 / DEV195-P1-01R2 — chế độ quét khai tường minh.
 *
 * Trước đây FE gửi đúng `code_value` cho cả hai đường (camera decode và gõ tay),
 * nên server chỉ suy luận được "có mã / không mã" và ghi mọi lần camera thành
 * HARDWARE. ERD bảng 25 `scan_events.scan_source` có sẵn CHECK
 * CAMERA/MANUAL/HARDWARE; chỉ FE mới biết mã đến từ camera hay bàn phím, nên FE
 * phải khai. Không khai thì server vẫn nhận và đánh dấu INFERRED.
 */
export type OutboundScanSource = "CAMERA" | "MANUAL" | "HARDWARE";

export async function scanOutboundItem(input: {
  documentId: string;
  /**
   * Change Pack QR/SKU (DEC-QR-001): bỏ trống — server tự match dòng theo SKU
   * embedded trong QR composite; gửi tường minh thì server cross-check WRONG_SKU.
   */
  lineId?: string;
  codeValue: string;
  ifMatch: number;
  scanSource?: OutboundScanSource;
  printerConfigId?: string;
}): Promise<OutboundScanResult> {
  const row = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_SCAN, input.documentId),
    {
      ...(input.lineId ? { line_id: input.lineId } : {}),
      quantity: 1,
      code_value: input.codeValue,
      ...(input.scanSource ? { scan_source: input.scanSource } : {}),
      ...(input.printerConfigId
        ? { printer_config_id: input.printerConfigId }
        : {}),
    },
    headers(input.ifMatch),
  );
  return {
    codeValue: input.codeValue,
    documentId: text(row.document_id, input.documentId),
    lineId: text(row.line_id, input.lineId ?? ""),
    itemId: text(row.item_id) || null,
    skuCode: text(row.sku_code) || null,
    itemUnique: text(row.item_unique) || null,
    payloadFormat: (text(row.payload_format) ||
      null) as OutboundScanResult["payloadFormat"],
    resolutionStatus: (text(row.resolution_status) ||
      null) as OutboundScanResult["resolutionStatus"],
    quantity: num(row.quantity ?? 1),
    expected: num(row.required_quantity),
    scanned: num(row.scanned_quantity),
    version: num(row.version),
    labelSnapshotId: text(row.label_snapshot_id) || null,
    labelStatus: text(row.label_status) || null,
    printError: text(row.print_error) || null,
    scanSource: (text(row.scan_source) || null) as OutboundScanSource | null,
    scanSourceOrigin: (text(row.scan_source_origin) || null) as
      | "EXPLICIT"
      | "INFERRED"
      | null,
  };
}

export interface OutboundUnmatchResult {
  documentId: string;
  lineId: string;
  matchId: string;
  itemId?: string | null;
  scannedQuantity: number;
  requiredQuantity: number;
  version: number;
}

/**
 * Gỡ một item đã match khỏi phiếu xuất trước Post (match → REMOVED,
 * scanned_qty giảm; stock-neutral). Item có thể quét lại sau đó.
 */
export async function unmatchOutboundItem(input: {
  documentId: string;
  matchId: string;
  reason?: string;
  ifMatch: number;
}): Promise<OutboundUnmatchResult> {
  const row = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_UNMATCH, input.documentId),
    {
      outbound_item_match_id: input.matchId,
      ...(input.reason ? { reason: input.reason } : {}),
    },
    headers(input.ifMatch),
  );
  return {
    documentId: text(row.document_id, input.documentId),
    lineId: text(row.line_id),
    matchId: text(row.outbound_item_match_id, input.matchId),
    itemId: text(row.item_id) || null,
    scannedQuantity: num(row.scanned_quantity),
    requiredQuantity: num(row.required_quantity),
    version: num(row.version),
  };
}

function normalizeIssueEvidence(row: RawRecord, meta: ApiMeta): IssueEvidence {
  // Ưu tiên `movements` ({id, movement_no}) — BE trả kèm để FE hiện mã đọc được
  // thay vì UUID thô. `movement_ids` (mảng id thô) vẫn có ở response cũ/replay
  // nên giữ làm fallback.
  const richMovements = (
    Array.isArray(row.movements) ? row.movements : []
  )
    .map((movement): IssueEvidenceMovement | null => {
      const rec = movement as RawRecord;
      const id = text(rec?.id ?? rec?.stock_movement_id ?? rec?.movement_id);
      const code = text(rec?.movement_no ?? rec?.code) || undefined;
      return id ? { id, code } : null;
    })
    .filter((m): m is IssueEvidenceMovement => m !== null);
  const movements =
    richMovements.length > 0
      ? richMovements
      : (Array.isArray(row.movement_ids) ? row.movement_ids : [])
          .map((value) => text(value))
          .filter(Boolean)
          .map((id) => ({ id }));
  const movementRefs = movements.map((m) => m.id);
  return {
    documentId: text(row.document_id),
    documentCode: text(row.document_no ?? row.doc_no) || undefined,
    status: "POSTED",
    movementRefs,
    movements,
    requestId: text(meta.request_id ?? row.request_id),
    version: num(row.version),
    // AC-GWT-IN-001 (đối xứng cho outbound, WWHN-201/DEV201-P1-01R): BE đặt
    // `data.replayed` khi retry cùng Idempotency-Key trả lại snapshot cũ. Bỏ qua cờ
    // này khiến người dùng thấy "Post thành công" hai lần và tưởng tồn bị trừ hai lần.
    replayed: row.replayed === true,
  };
}

export async function postOutboundIssue(input: {
  documentId: string;
  ifMatch: number;
  idempotencyKey: string;
}): Promise<IssueEvidence> {
  const result = await http.postWithMeta<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_POST_ISSUE, input.documentId),
    undefined,
    headers(input.ifMatch, input.idempotencyKey),
  );
  return normalizeIssueEvidence(result.data, result.meta);
}

function normalizeImport(payload: RawRecord): OutboundImportResult {
  const importRow = (payload.import ?? {}) as RawRecord;
  const rows = rowsOf(
    (payload.rows ?? []) as RawRecord[] | { data?: RawRecord[] },
  ).map(
    (row): OutboundImportRow => ({
      id: text(row.id),
      rowNo: num(row.row_no),
      status: text(row.validation_status),
      normalized: parseJsonObject(row.normalized_payload),
      errors: parseJsonArray(row.validation_errors ?? row.errors),
    }),
  );
  return {
    id: text(importRow.id),
    importNo: text(importRow.import_no),
    status: text(importRow.status),
    totalRows: num(importRow.total_rows),
    validRows: num(importRow.valid_rows),
    errorRows: num(importRow.error_rows),
    version: num(importRow.version),
    rows,
  };
}

export async function validateOutboundRequestRows(
  rows: OutboundRequestRowInput[],
  sourceKey?: string,
): Promise<OutboundImportResult> {
  return normalizeImport(
    await http.post<RawRecord>(API_ENDPOINTS.OUTBOUND_REQUEST_IMPORTS, {
      ...(sourceKey ? { source_key: sourceKey } : {}),
      rows,
    }),
  );
}

export async function uploadOutboundRequestFile(
  file: File,
  sourceKey?: string,
): Promise<OutboundImportResult> {
  const body = new FormData();
  body.append("file", file);
  if (sourceKey) body.append("source_key", sourceKey);
  return normalizeImport(
    await http.post<RawRecord>(API_ENDPOINTS.OUTBOUND_REQUEST_IMPORTS, body),
  );
}

export async function fetchOutboundImport(
  id: string,
): Promise<OutboundImportResult> {
  return normalizeImport(
    await http.get<RawRecord>(
      endpoint(API_ENDPOINTS.OUTBOUND_REQUEST_IMPORT, id),
    ),
  );
}

/** Annex C OutboundRequestImportConfirmRequest (§8.1). */
export interface ConfirmOutboundImportInput {
  /** Map lại từng source line sang SKU/số lượng chuẩn hoá trước khi Confirm. */
  lines?: Array<{
    row_no: number;
    sku_id?: string;
    sku_code?: string;
    required_qty?: number;
  }>;
  /** Override người nhận cho toàn bộ toa trong import. */
  receiver_name?: string;
  receiver_address?: string;
  receiver_contact_phone?: string;
  request_date?: string;
}

/**
 * Annex C confirmOutboundRequestImport — POST /outbound-request-imports/{id}/confirm
 * với Idempotency-Key + If-Match; tạo đúng 01 outbound DRAFT cho mỗi toa.
 */
export async function consumeOutboundImport(
  id: string,
  idempotencyKey: string,
  ifMatch: number,
  payload: ConfirmOutboundImportInput = {},
): Promise<ConsumeOutboundImportResult> {
  const row = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_REQUEST_IMPORT_CONFIRM, id),
    payload,
    headers(ifMatch, idempotencyKey),
  );
  return {
    importId: text(row.import_id, id),
    status: text(row.status),
    outboundRequestIds: Array.isArray(row.outbound_request_ids)
      ? row.outbound_request_ids.map((value) => text(value)).filter(Boolean)
      : [],
    outboundDocumentIds: Array.isArray(row.outbound_document_ids)
      ? row.outbound_document_ids.map((value) => text(value)).filter(Boolean)
      : [],
  };
}

function labelPayload(row: RawRecord): RawRecord {
  return parseJsonObject(row.label_payload ?? row.payload);
}

function normalizeLabelSnapshot(row: RawRecord): LabelSnapshotRecord {
  const payload = labelPayload(row);
  return {
    id: text(row.id),
    labelCode: text(row.label_code) || null,
    documentId: text(row.outbound_document_id) || null,
    itemMatchId: text(row.outbound_item_match_id) || null,
    itemId: text(row.item_id ?? payload.item_id) || null,
    skuId: text(row.sku_id) || null,
    skuCode: text(row.sku_code ?? payload.sku_code) || null,
    skuName: text(row.product_name ?? payload.sku_name) || null,
    itemCodeValue: text(row.item_code_value ?? payload.item_code_value) || null,
    recipientName: text(row.customer_name ?? payload.recipient_name) || null,
    recipientAddress:
      text(row.customer_address ?? payload.recipient_address) || null,
    status: text(row.status),
    reprintCount: num(row.reprint_count),
    outboundNo: text(row.outbound_no ?? payload.outbound_no) || null,
    payload,
  };
}

export async function fetchLabelSnapshots(): Promise<LabelSnapshotRecord[]> {
  const rows = await fetchAllPages(API_ENDPOINTS.LABEL_SNAPSHOTS, {});
  return rows.map(normalizeLabelSnapshot);
}

export async function fetchPrinterConfigs(): Promise<PrinterConfigRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.PRINTER_CONFIGS,
    { params: { per_page: 100 } },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    (row) => ({
      id: text(row.id),
      code: text(row.printer_code),
      name: text(row.printer_name, text(row.printer_code)),
      status: text(row.status, "ACTIVE"),
      labelSize: text(row.label_size) || null,
      lastHealthAt: text(row.last_health_at) || null,
      lastHealthResult: text(row.last_health_result) || null,
    }),
  );
}

/**
 * Tổng available_qty theo từng SKU (OUT-REQ-01: cột "Khả dụng" trong preview).
 * Chỉ mang tính tham khảo tại thời điểm mở màn — availability thật được BE
 * kiểm tra lại lúc scan/Post (nguyên tắc 2.1 tài liệu tổng hợp).
 */
export async function fetchAvailableQtyBySku(
  skuIds: string[],
): Promise<Record<string, number>> {
  const unique = [...new Set(skuIds.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (skuId): Promise<[string, number]> => {
      const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
        API_ENDPOINTS.INVENTORY_BALANCES,
        { params: { product_id: skuId, per_page: 100 } },
      );
      const total = rowsOf(
        result.data as RawRecord[] | { data?: RawRecord[] },
      ).reduce(
        (sum, row) =>
          sum + num(row.available_qty ?? row.quantity ?? row.on_hand_qty),
        0,
      );
      return [skuId, total];
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Annex C printPackingLabel/reprintPackingLabel — path theo phiếu xuất, bắt buộc
 * Idempotency-Key + If-Match (version nhãn). §6: chỉ in khi nhãn READY_TO_PRINT
 * (hoặc retry sau PRINT_FAILED); reprint dùng lại đúng snapshot và stock-neutral.
 */
export async function reprintLabelSnapshot(input: {
  documentId: string;
  labelId: string;
  printerConfigId: string;
  ifMatch: number;
  idempotencyKey: string;
  /** Lý do in lại (bắt buộc chọn ở UI) — BE ghi vào nhật ký in để truy trách nhiệm. */
  reason?: string;
}): Promise<RawRecord> {
  return http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_PACKING_LABEL_REPRINT, input.documentId, {
      labelId: input.labelId,
    }),
    {
      printer_config_id: input.printerConfigId,
      ...(input.reason ? { reason: input.reason } : {}),
    },
    headers(input.ifMatch, input.idempotencyKey),
  );
}

export async function printLabelSnapshot(input: {
  documentId: string;
  labelId: string;
  printerConfigId: string;
  ifMatch: number;
  idempotencyKey: string;
}): Promise<RawRecord> {
  return http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_PACKING_LABEL_PRINT, input.documentId, {
      labelId: input.labelId,
    }),
    { printer_config_id: input.printerConfigId },
    headers(input.ifMatch, input.idempotencyKey),
  );
}

function normalizePhysicalCode(row: RawRecord): PhysicalCodeRecord {
  return {
    id: text(row.physical_code_id ?? row.id),
    codeValue: text(row.code_value),
    carrierType: text(row.carrier_type),
    hardwareUid: text(row.hardware_uid) || null,
    itemId: text(row.item_id ?? row.assigned_object_id) || null,
    status: text(row.status),
    version: num(row.version),
  };
}

export async function fetchActiveRfidCodes(): Promise<PhysicalCodeRecord[]> {
  const rows = await fetchAllPages(API_ENDPOINTS.PHYSICAL_CODES, {
    carrier_type: "RFID",
    status: "ACTIVE",
  });
  return rows
    .map(normalizePhysicalCode)
    .filter((code) => code.carrierType === "RFID" && code.status === "ACTIVE");
}

/**
 * Annex C assignItemRfid — PUT /outbound-documents/{id}/items/{item_id}/rfid với
 * permission physical_code.assign_rfid. Idempotent theo hardware_uid, trả
 * 409 DUPLICATE_HARDWARE_UID khi UID đã gắn item khác. RFID stock-neutral và
 * KHÔNG phải gate Post Issue (§15 OP-05).
 */
export async function assignRfidToItem(input: {
  documentId: string;
  itemId: string;
  codeValue: string;
  hardwareUid: string;
  ifMatch: number;
}): Promise<PhysicalCodeRecord> {
  const row = await http.put<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_ITEM_RFID, input.documentId, {
      itemId: input.itemId,
    }),
    {
      code_value: input.codeValue,
      hardware_uid: input.hardwareUid,
    },
    headers(input.ifMatch),
  );
  return {
    id: text(row.physical_code_id ?? row.id),
    codeValue: text(row.code_value),
    carrierType: text(row.carrier_type),
    hardwareUid: text(row.hardware_uid) || null,
    itemId: text(row.item_id ?? row.assigned_object_id) || null,
    status: text(row.status),
    version: num(row.version),
  };
}
