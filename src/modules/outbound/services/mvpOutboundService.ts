import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type { ApiMeta } from "@/shared/types/api-response";

export type OutboundStatus = "DRAFT" | "SCANNING" | "POSTED" | "CANCELLED";

type RawRecord = Record<string, unknown>;

export interface OutboundLineRecord {
  id: string;
  documentId: string;
  productId: string;
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

/**
 * BP-WMS-04/05: phiếu xuất luôn sinh từ toa đã consume — BE bắt buộc
 * outbound_request_id và từ chối lines thủ công (lines hydrate từ toa).
 */
export interface CreateOutboundPayload {
  doc_no?: string | null;
  doc_date?: string | null;
  src_warehouse_id: string;
  outbound_request_id: string;
  agency_id?: string | null;
  recipient_name?: string | null;
  recipient_address?: string | null;
  note?: string | null;
}

export interface UpdateOutboundPayload {
  doc_no?: string | null;
  doc_date?: string | null;
  agency_id?: string | null;
  recipient_name?: string | null;
  recipient_address?: string | null;
  note?: string | null;
  lines?: OutboundLinePayload[];
}

export interface OutboundScanResult {
  codeValue: string;
  documentId: string;
  lineId: string;
  itemId?: string | null;
  quantity: number;
  expected: number;
  scanned: number;
  version: number;
  labelSnapshotId?: string | null;
  labelStatus?: string | null;
  printError?: string | null;
}

export interface IssueEvidence {
  documentId: string;
  status: "POSTED";
  movementRefs: string[];
  requestId: string;
  version: number;
  replayed?: boolean;
}

export interface OutboundRequestRowInput {
  request_no: string;
  customer_name: string;
  // SRS v1.12 §15 + REQ-SRS-014: address nullable — toa nguồn có thể không có địa chỉ.
  customer_address?: string;
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

function endpoint(template: string, id: string): string {
  return template.replace(":id", id);
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
        per_page: params.per_page ?? 15,
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

export async function createOutboundDocument(
  payload: CreateOutboundPayload,
): Promise<OutboundDetail> {
  return normalizeDetail(
    await http.post<RawRecord>(API_ENDPOINTS.OUTBOUND_DOCUMENTS, payload),
  );
}

export async function updateOutboundDocument(
  id: string,
  payload: UpdateOutboundPayload,
  ifMatch: number,
): Promise<OutboundDetail> {
  return normalizeDetail(
    await http.patch<RawRecord>(
      endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, id),
      payload,
      headers(ifMatch),
    ),
  );
}

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

export async function scanOutboundItem(input: {
  documentId: string;
  lineId: string;
  codeValue: string;
  ifMatch: number;
  printerConfigId?: string;
}): Promise<OutboundScanResult> {
  const row = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_SCAN, input.documentId),
    {
      line_id: input.lineId,
      quantity: 1,
      code_value: input.codeValue,
      ...(input.printerConfigId
        ? { printer_config_id: input.printerConfigId }
        : {}),
    },
    headers(input.ifMatch),
  );
  return {
    codeValue: input.codeValue,
    documentId: text(row.document_id, input.documentId),
    lineId: text(row.line_id, input.lineId),
    itemId: text(row.item_id) || null,
    quantity: num(row.quantity ?? 1),
    expected: num(row.required_quantity),
    scanned: num(row.scanned_quantity),
    version: num(row.version),
    labelSnapshotId: text(row.label_snapshot_id) || null,
    labelStatus: text(row.label_status) || null,
    printError: text(row.print_error) || null,
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
  const movementRefs = Array.isArray(row.movement_ids)
    ? row.movement_ids.map((value) => text(value)).filter(Boolean)
    : [];
  return {
    documentId: text(row.document_id),
    status: "POSTED",
    movementRefs,
    requestId: text(meta.request_id ?? row.request_id),
    version: num(row.version),
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

export async function consumeOutboundImport(
  id: string,
  idempotencyKey: string,
): Promise<ConsumeOutboundImportResult> {
  const row = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_REQUEST_IMPORT_CONSUME, id),
    undefined,
    headers(undefined, idempotencyKey),
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

export async function reprintLabelSnapshot(
  id: string,
  printerConfigId: string,
): Promise<RawRecord> {
  return http.post<RawRecord>(
    endpoint(API_ENDPOINTS.LABEL_SNAPSHOT_REPRINT, id),
    { printer_config_id: printerConfigId },
  );
}

export async function printLabelSnapshot(
  id: string,
  printerConfigId: string,
): Promise<RawRecord> {
  return http.post<RawRecord>(
    endpoint(API_ENDPOINTS.LABEL_SNAPSHOT_PRINT, id),
    { printer_config_id: printerConfigId },
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

export async function assignRfidToItem(input: {
  itemId: string;
  codeValue: string;
  hardwareUid: string;
}): Promise<PhysicalCodeRecord> {
  const row = await http.post<RawRecord>(API_ENDPOINTS.PHYSICAL_CODES, {
    code_value: input.codeValue,
    carrier_type: "RFID",
    hardware_uid: input.hardwareUid,
    item_id: input.itemId,
    is_primary: true,
  });
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
