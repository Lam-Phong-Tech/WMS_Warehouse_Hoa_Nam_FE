import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { withConcurrencyContract } from "@/shared/api/concurrency-contract";
import { http } from "@/shared/api/http";
import {
  requireIdempotencyKeyHeader,
  requireNonEmptyString,
  requirePositiveNumber,
  requireUniqueStrings,
  WmsContractError,
} from "@/shared/api/wms-contract";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import type { ApiMeta } from "@/shared/types/api-response";
import type {
  ComponentLineEnsureResult,
  CreateInboundPayload,
  InboundCartonCompleteResult,
  InboundDetail,
  InboundDocument,
  InboundLine,
  InboundScanEntry,
  InboundScanResult,
  InboundUnscanResult,
  PostReceiptRequest,
  ReceiptEvidence,
  ReceiptEvidenceMovement,
  UpdateInboundPayload,
} from "../types";

type ListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
};
type RawRecord = Record<string, unknown>;
type ScanOptions = {
  lineId?: string;
  ifMatch?: number;
  includeCodeValue?: boolean;
  quantity?: number;
  containerId?: string;
  /**
   * Loại người dùng chọn cho SKU MỚI khi quét mã item lần đầu (loại chưa suy ra
   * được từ mã). Bỏ trống với SKU đã tồn tại; SKU mới mà thiếu -> BE trả
   * NEW_SKU_TYPE_REQUIRED để FE hỏi rồi gửi lại kèm giá trị này.
   */
  newSkuType?: "PRODUCT" | "COMPONENT";
  /**
   * WWHN-187 (DEV187-P1-07) — key của đúng *hành động quét* đang thực hiện.
   *
   * Bỏ trống thì service tự sinh một key mới cho lần gửi này. Khi gọi lại đúng
   * hành động cũ (mất response, 412/409 CONCURRENCY sau khi reload), caller BẮT
   * BUỘC truyền lại đúng key cũ — đó là điều kiện để BE replay thay vì cộng dồn
   * `scanned_qty` lần thứ hai (DEC-SCAN-IDEMP-001).
   */
  idempotencyKey?: string;
};

export interface InboundListResult {
  data: InboundDocument[];
  meta: ApiMeta;
}

export interface InboundBoxRegistration {
  container_id: string;
  box_code: string;
  sku_id: string;
  status: string;
  version: number;
  created: boolean;
  stock_effect: "NONE";
  movement_created: false;
}

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value)
    ? value
    : Array.isArray(value.data)
      ? value.data
      : [];
}
function num(value: unknown): number {
  return Number(value ?? 0);
}
function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}
function endpoint(template: string, id: string | number): string {
  return template.replace(":id", String(id));
}
function rawLines(row: RawRecord): RawRecord[] {
  return rowsOf(
    (row.lines ?? row.items ?? []) as RawRecord[] | { data?: RawRecord[] },
  );
}
function normalizeStatus(value: unknown): InboundDocument["status"] {
  const status = text(value).toUpperCase();
  if (
    status === "DRAFT" ||
    status === "SCANNING" ||
    status === "POSTED" ||
    status === "CANCELLED"
  ) {
    return status;
  }

  throw new WmsContractError(
    "WMS_FE_INVALID_INBOUND_STATUS",
    `Unsupported inbound status from API: ${status || "<empty>"}`,
  );
}
function normalizeDocument(row: RawRecord): InboundDocument {
  const lines = rawLines(row);
  const expected = lines.length
    ? lines.reduce(
        (sum, line) =>
          sum + num(line.qty_planned ?? line.qty_expected ?? line.quantity),
        0,
      )
    : num(row.qty_expected ?? row.qty_planned ?? row.total_qty);
  const scanned = lines.length
    ? lines.reduce(
        (sum, line) => sum + num(line.scanned_qty ?? line.qty_scanned),
        0,
      )
    : num(row.scanned_qty ?? row.qty_scanned ?? row.total_scanned);
  const status = normalizeStatus(row.status);
  const posted = status === "POSTED" ? expected : 0;
  return {
    id: text(row.id ?? row.stock_document_id),
    code: text(row.doc_no ?? row.code ?? row.document_no),
    // Annex A / Annex D gọi field này là `source_reference`; BE trả cả alias đó và
    // cột vật lý `source_name`. Không fallback sang `note` nữa: ghi chú là field
    // khác hẳn, đổ vào cột "Nguồn / tham chiếu" là hiển thị sai dữ liệu.
    source: text(row.source_reference ?? row.source_name ?? row.source, "-"),
    date: text(row.doc_date ?? row.date ?? row.created_at),
    warehouseId: text(row.dst_warehouse_id ?? row.warehouse_id),
    expected,
    scanned,
    posted,
    remaining: Math.max(expected - scanned, 0),
    status,
    createdBy: text(
      row.created_by_name ?? row.created_by ?? row.creator_name,
      "-",
    ),
    updatedAt: text(row.updated_at) || undefined,
    version: num(row.version ?? row.lock_version ?? 1),
    sourceReference: text(row.source_reference ?? row.source_name) || undefined,
    note: text(row.note) || undefined,
  };
}
function normalizeLine(
  row: RawRecord,
  documentId: string,
  status: InboundDocument["status"],
): InboundLine {
  const expected = num(row.qty_planned ?? row.qty_expected ?? row.quantity);
  const scanned = num(row.scanned_qty ?? row.qty_scanned ?? 0);
  const posted = status === "POSTED" ? expected : 0;
  return {
    id: text(row.id ?? row.stock_document_line_id),
    documentId,
    productId: text(row.product_id ?? row.sku_id),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.product_code),
    skuName: text(row.sku_name ?? row.product_name ?? row.name),
    scanTarget: text(row.scan_target ?? row.lot_no ?? row.product_code, "-"),
    expected,
    scanned,
    posted,
    remaining: Math.max(expected - scanned, 0),
    validation: scanned <= expected ? "VALID" : "INVALID",
    selected: false,
    note: text(row.note) || undefined,
  };
}
function normalizeDetail(row: RawRecord): InboundDetail {
  const document = normalizeDocument(row);
  return {
    document,
    lines: rawLines(row).map((line) =>
      normalizeLine(line, document.id, document.status),
    ),
  };
}
function assertReadOnlyScanResponse(row: RawRecord): void {
  if (row.stock_effect !== undefined && row.stock_effect !== "NONE") {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "Inbound scan must have stock_effect=NONE",
    );
  }
  if (row.movement_created !== undefined && row.movement_created !== false) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "Inbound scan must not create stock movement",
    );
  }
}
// GĐ1-REQ-004/006: số lượng nhập lấy từ hàng thực quét/đếm; không còn khái niệm
// "quét đủ theo dự kiến". Điều kiện duy nhất phía client là phiếu đã ghi nhận
// được ít nhất một đơn vị — thiếu/thừa so với chứng từ tham chiếu vẫn Post được.
function assertHasScannedQuantity(detail: InboundDetail): void {
  const totalScanned = detail.lines.reduce(
    (sum, line) => sum + line.scanned,
    0,
  );
  if (totalScanned <= 0) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_SCANNED",
      "Inbound document must have at least one scanned unit before Post Receipt",
    );
  }
}
function rowsOfUnknown(raw: unknown): unknown[] {
  return Array.isArray(raw)
    ? raw
    : typeof raw === "object" &&
        raw !== null &&
        Array.isArray((raw as { data?: unknown[] }).data)
      ? (raw as { data: unknown[] }).data
      : [];
}

function normalizeReceiptEvidence(
  row: RawRecord,
  meta: ApiMeta,
): ReceiptEvidence {
  const receiptId = requireNonEmptyString(
    row.document_id ?? row.id ?? row.stock_document_id,
    "document_id",
    "WMS_FE_MISSING_RECEIPT_EVIDENCE",
  );
  const receiptCode = text(row.document_no ?? row.doc_no) || undefined;

  // Ưu tiên `movements` (đối tượng {id, movement_no} — BE thêm để FE hiển thị
  // mã đọc được thay vì UUID thô). `movement_ids` (mảng id thô) luôn có mặt kể
  // cả ở response cũ trước khi BE thêm `movements`/replay bản ghi cũ — dùng làm
  // fallback, không phải nguồn ưu tiên.
  const richMovements = rowsOfUnknown(row.movements)
    .map((movement): ReceiptEvidenceMovement | null => {
      const rec = movement as RawRecord;
      const id = text(
        rec?.id ?? rec?.stock_movement_id ?? rec?.movement_id,
      );
      const code = text(rec?.movement_no ?? rec?.code) || undefined;
      return id ? { id, code } : null;
    })
    .filter((m): m is ReceiptEvidenceMovement => m !== null);

  const movements =
    richMovements.length > 0
      ? richMovements
      : rowsOfUnknown(row.movement_ids)
          .map((movement) =>
            typeof movement === "string" ? movement : text(movement),
          )
          .filter(Boolean)
          .map((id) => ({ id }));

  const movementRefs = movements.map((m) => m.id);
  if (movementRefs.length === 0) {
    throw new WmsContractError(
      "WMS_FE_MISSING_RECEIPT_EVIDENCE",
      "Post Receipt response must include movement_ids",
    );
  }
  return {
    receiptId,
    receiptCode,
    movementRef: movementRefs[0],
    movementRefs,
    movements,
    requestId: requireNonEmptyString(
      meta.request_id ?? row.request_id,
      "request_id",
      "WMS_FE_MISSING_RECEIPT_EVIDENCE",
    ),
    traceSource: "stock_document.movements",
    // AC-GWT-IN-001: retry cùng Idempotency-Key trả business result cũ kèm
    // replayed=true. Người dùng phải phân biệt được "vừa Post" và "đây là replay",
    // nếu không sẽ tưởng lần bấm thứ hai đã tăng tồn thêm một lần nữa.
    replayed: row.replayed === true,
    version: row.version === undefined ? undefined : num(row.version),
  };
}
function mutationHeaders(ifMatch: number, idempotencyKey?: string) {
  return {
    headers: {
      "If-Match": String(requirePositiveNumber(ifMatch, "If-Match")),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
  };
}
function makeIdempotencyKey(operation: string) {
  const uuid =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `fe:${operation}:${uuid}`;
}

export async function fetchInboundDocuments(
  params: ListParams = {},
): Promise<InboundListResult> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.INBOUND_DOCUMENTS,
    {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
        keyword: params.search?.trim() || undefined,
        status: params.status || undefined,
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
export async function fetchInboundDetail(id: string): Promise<InboundDetail> {
  return normalizeDetail(
    await http.get<RawRecord>(endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, id)),
  );
}
export async function fetchInboundLines(
  documentId: string,
): Promise<InboundLine[]> {
  return (await fetchInboundDetail(documentId)).lines;
}
export async function fetchInboundDocument(
  id: string,
): Promise<InboundDocument> {
  return (await fetchInboundDetail(id)).document;
}

export async function createInboundDocument(
  payload: CreateInboundPayload,
): Promise<InboundDocument> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.CREATE_INBOUND,
    "create inbound document",
  );
  return normalizeDocument(
    await http.post<RawRecord>(API_ENDPOINTS.INBOUND_DOCUMENTS, payload, {
      headers: { "Idempotency-Key": makeIdempotencyKey("inbound-create") },
    }),
  );
}
export async function updateInboundDocument(
  id: string,
  payload: UpdateInboundPayload,
  ifMatch: number,
): Promise<InboundDocument> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.CREATE_INBOUND,
    "update inbound document",
  );
  return normalizeDocument(
    await http.patch<RawRecord>(
      endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, id),
      payload,
      mutationHeaders(ifMatch),
    ),
  );
}
export async function cancelInboundDocument(
  id: string,
  reason: string,
  ifMatch: number,
): Promise<InboundDocument> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.CANCEL_INBOUND,
    "cancel inbound document",
  );
  return normalizeDocument(
    await http.post<RawRecord>(
      endpoint(API_ENDPOINTS.INBOUND_CANCEL, id),
      { reason: requireNonEmptyString(reason, "reason") },
      mutationHeaders(ifMatch),
    ),
  );
}

/**
 * GĐ1 COMPONENT theo Box: materialize dòng linh kiện theo document + SKU (không
 * nhập số lượng dự kiến). Idempotent — SKU đã có dòng thì trả lại dòng đó.
 */
export async function ensureComponentLine(
  documentId: string,
  skuId: string,
): Promise<ComponentLineEnsureResult> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.SCAN_INBOUND,
    "materialize inbound component line",
  );
  const row = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_COMPONENT_LINES, documentId),
    { sku_id: requireNonEmptyString(skuId, "sku_id") },
  );
  return {
    line_id: requireNonEmptyString(row.line_id, "line_id"),
    document_id: text(row.document_id),
    sku_id: text(row.sku_id),
    sku_code: text(row.sku_code),
    sku_name: text(row.sku_name),
    is_serial_tracked: row.is_serial_tracked === true,
    scanned_qty: num(row.scanned_qty),
    quantity_source:
      text(row.quantity_source) === "ACTUAL_CODE_SCAN"
        ? "ACTUAL_CODE_SCAN"
        : "ACTUAL_BOX_COUNT",
  };
}

export async function registerInboundBox(
  documentId: string,
  lineId: string,
  boxCode: string,
): Promise<InboundBoxRegistration> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.SCAN_INBOUND,
    "register inbound component box",
  );
  return http.post<InboundBoxRegistration>(
    endpoint(API_ENDPOINTS.INBOUND_BOXES, documentId),
    {
      line_id: requireNonEmptyString(lineId, "line_id"),
      box_code: requireNonEmptyString(boxCode, "box_code"),
    },
  );
}

export async function scanInboundDocument(
  id: string,
  codes: string[],
  options: ScanOptions = {},
): Promise<InboundScanResult[]> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.SCAN_INBOUND,
    "scan inbound document",
  );
  const normalizedCodes = requireUniqueStrings(
    codes,
    "codes",
    "WMS_FE_DUPLICATE_SCAN_CODE",
  );
  // Change Pack QR/SKU 20/08/2026 (DEC-QR-001, AC-QR-02/10): FE gửi RAW payload
  // thẳng vào endpoint scan — backend parse composite QR authoritative, tự match
  // dòng theo SKU embedded và chấp nhận new item candidate. Không còn preflight
  // classify (classify sẽ 404 với item mới nên chặn nhầm luồng nhập) và không
  // còn resolve line phía client. COMPONENT quantity-mode (includeCodeValue=false)
  // vẫn bắt buộc chọn dòng như cũ.
  if (options.includeCodeValue === false) {
    requireNonEmptyString(options.lineId, "line_id");
  }
  let currentVersion: number;
  if (options.ifMatch !== undefined) {
    currentVersion = options.ifMatch;
  } else {
    const rawDetail = await http.get<RawRecord>(
      endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, id),
    );
    currentVersion = num(rawDetail.version);
  }
  const results: InboundScanResult[] = [];

  for (const code of normalizedCodes) {
    const quantity = options.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new WmsContractError(
        "WMS_FE_INVALID_SCAN_QUANTITY",
        "Scan quantity must be a positive integer",
      );
    }
    const body: RawRecord = { qty: quantity };
    if (options.includeCodeValue !== false) body.code_value = code;
    if (options.lineId) body.line_id = options.lineId;
    if (options.containerId) body.container_id = options.containerId;
    if (options.newSkuType) body.new_sku_type = options.newSkuType;

    // WWHN-187 (DEV187-P1-07) — mỗi hành động quét mang đúng một Idempotency-Key.
    //
    // `If-Match` chỉ chặn được replay *cũ*. Kịch bản làm hỏng dữ liệu là replay
    // *mới*: BE đã ghi xong nhưng response rơi trên đường về, client tải lại phiếu
    // thấy version đã nhảy rồi gửi lại đúng hành động đó với version mới hợp lệ.
    // Nhánh PRODUCT/serial được `DUPLICATE_ITEM_IN_DOCUMENT` che, còn COMPONENT
    // quantity-mode không có `item_id` nên `scanned_qty` bị cộng đôi (2 -> 4).
    // BE chỉ nhận diện được điều đó khi có key (DEC-SCAN-IDEMP-001) — không gửi
    // key thì hành vi vẫn y như cũ, nên FE phải luôn gửi.
    //
    // Nhiều mã trong một lần gọi là nhiều hành động quét khác nhau: phải tách key
    // theo chỉ số, nếu dùng chung một key thì mã thứ hai sẽ bị 409
    // IDEMPOTENCY_CONFLICT vì cùng key nhưng khác fingerprint.
    const scanKey = `${options.idempotencyKey ?? makeIdempotencyKey("inbound-scan")}:${results.length}`;

    // Thua race (412 STALE_VERSION / 409 CONCURRENCY_CONFLICT) phải nổi lên thành
    // hướng dẫn "reload rồi gửi lại bằng ĐÚNG key cũ" thay vì một lỗi đỏ chung —
    // AC-GWT-CONC-001 cấm UI tự submit lại bằng key mới.
    const response = await withConcurrencyContract(() =>
      http.post<RawRecord>(
        endpoint(API_ENDPOINTS.INBOUND_SCAN, id),
        body,
        mutationHeaders(currentVersion, scanKey),
      ),
    );
    assertReadOnlyScanResponse(response);
    const replayed = response.replayed === true;
    currentVersion = requirePositiveNumber(response.version, "scan.version");
    results.push({
      code_value: code,
      status: "VALID",
      sku: text(response.sku_code) || undefined,
      line_id: text(response.line_id) || undefined,
      item_id: text(response.item_id) || undefined,
      item_unique: text(response.item_unique) || undefined,
      serial_number: text(response.serial_number) || undefined,
      payload_format:
        (text(
          response.payload_format,
        ) as InboundScanResult["payload_format"]) || undefined,
      resolution_status:
        (text(
          response.resolution_status,
        ) as InboundScanResult["resolution_status"]) || undefined,
      message: text(response.message) || undefined,
      version: currentVersion,
      idempotency_key: scanKey,
      replayed,
    });
  }
  return results;
}

export async function postInboundReceipt(
  request: PostReceiptRequest,
): Promise<ReceiptEvidence> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.POST_RECEIPT,
    "post inbound receipt",
  );
  const documentId = requireNonEmptyString(request.documentId, "documentId");
  const idempotencyKey = requireIdempotencyKeyHeader(request.idempotencyKey)[
    "Idempotency-Key"
  ];
  const detail = await fetchInboundDetail(documentId);
  assertHasScannedQuantity(detail);
  if (detail.document.version !== request.ifMatch) {
    throw new WmsContractError(
      "WMS_FE_VERSION_CONFLICT",
      `Inbound version changed from ${request.ifMatch} to ${detail.document.version}`,
    );
  }
  // WWHN-234 DEV234-P1-02: pre-flight ở trên chỉ đóng được cửa sổ *trước* khi gửi.
  // Race thật nằm giữa lần đọc detail và lúc BE lấy lockForUpdate, nên 412
  // STALE_VERSION / 409 CONCURRENCY_CONFLICT phải được phân loại thành hành động
  // "tải lại rồi thử lại bằng đúng Idempotency-Key cũ" theo AC-GWT-CONC-001.
  const result = await withConcurrencyContract(() =>
    http.postWithMeta<RawRecord>(
      endpoint(API_ENDPOINTS.INBOUND_POST_RECEIPT, documentId),
      undefined,
      mutationHeaders(request.ifMatch, idempotencyKey),
    ),
  );
  return normalizeReceiptEvidence(result.data, result.meta);
}

/**
 * Annex D SCR-IN-01: bảng mã đã quét là dữ liệu server, phải đọc lại được sau khi
 * tải lại trang. `status: "ALL"` dùng để đối soát cả các dòng đã gỡ.
 */
export async function fetchInboundScanEntries(
  documentId: string,
  status: "ACTIVE" | "ALL" = "ACTIVE",
): Promise<InboundScanEntry[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    endpoint(API_ENDPOINTS.INBOUND_SCAN_ENTRIES, documentId),
    { params: { status, per_page: 200 } },
  );

  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    (row): InboundScanEntry => ({
      id: text(row.id),
      lineId: text(row.inbound_line_id),
      itemId: text(row.item_id) || undefined,
      itemCode: text(row.item_code) || undefined,
      serialNumber: text(row.serial_number) || undefined,
      candidateItemUnique: text(row.candidate_item_unique) || undefined,
      candidateSerialNumber: text(row.candidate_serial_number) || undefined,
      containerId: text(row.container_id) || undefined,
      containerCode: text(row.container_code) || undefined,
      sku: text(row.sku_code),
      skuName: text(row.sku_name),
      quantity: num(row.quantity),
      scanSource: text(row.scan_source, "MANUAL"),
      status: text(row.status, "ACTIVE") === "REMOVED" ? "REMOVED" : "ACTIVE",
      capturedAt: text(row.created_at) || undefined,
    }),
  );
}

/**
 * Inbound Carton Scan v1.0 §3.3: ghi nhận mốc "Đã quét xong thùng" cho carton
 * trong phiếu nhập. Audit-only trên server (INBOUND_CARTON_SCAN_COMPLETED) —
 * không đổi container.status, không tạo movement/balance, không bump version,
 * nên không cần If-Match. Duplicate call là harmless theo contract (CTN-T11).
 */
export async function completeInboundCartonScan(
  documentId: string,
  containerId: string,
): Promise<InboundCartonCompleteResult> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.SCAN_INBOUND,
    "complete inbound carton scan",
  );
  const path = API_ENDPOINTS.INBOUND_CARTON_COMPLETE_SCAN.replace(
    ":id",
    requireNonEmptyString(documentId, "documentId"),
  ).replace(":containerId", requireNonEmptyString(containerId, "containerId"));
  const response = await http.post<RawRecord>(path);
  assertReadOnlyScanResponse(response);

  return {
    documentId: text(response.document_id, documentId),
    containerId: text(response.container_id, containerId),
    cartonCode: text(response.carton_code),
    actualItemQty: num(response.actual_item_qty),
    completedAt: text(response.completed_at) || undefined,
  };
}

/**
 * ERD bảng 28: inbound_scan_entries.status ACTIVE -> REMOVED để sửa mã quét sai
 * trước Post. Stock-neutral; sau Post phải dùng Reversal thay vì gỡ.
 */
export async function unscanInboundEntry(
  documentId: string,
  entryId: string,
  ifMatch: number,
  reason?: string,
): Promise<InboundUnscanResult> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.SCAN_INBOUND,
    "remove inbound scan entry",
  );
  const response = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_UNSCAN, documentId),
    {
      inbound_scan_entry_id: requireNonEmptyString(
        entryId,
        "inbound_scan_entry_id",
      ),
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    },
    mutationHeaders(ifMatch),
  );
  assertReadOnlyScanResponse(response);

  return {
    documentId: text(response.document_id, documentId),
    lineId: text(response.line_id),
    entryId: text(response.inbound_scan_entry_id, entryId),
    itemId: text(response.item_id) || undefined,
    status: "REMOVED",
    requiredQuantity: num(response.required_quantity),
    scannedQuantity: num(response.scanned_quantity),
    version: requirePositiveNumber(response.version, "unscan.version"),
  };
}

export async function reverseInboundDocument(
  id: string,
  payload: RawRecord,
  idempotencyKey: string,
  ifMatch: number,
): Promise<RawRecord> {
  return http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_REVERSE, id),
    payload,
    mutationHeaders(
      ifMatch,
      requireNonEmptyString(idempotencyKey, "Idempotency-Key"),
    ),
  );
}
