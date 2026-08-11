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
}

export interface OutboundDetail {
  document: OutboundDocumentRecord;
  lines: OutboundLineRecord[];
}

export interface OutboundLinePayload {
  product_id: string;
  qty_planned: number;
  note?: string | null;
}

export interface CreateOutboundPayload {
  doc_no?: string | null;
  doc_date?: string | null;
  src_warehouse_id: string;
  outbound_request_id?: string | null;
  agency_id?: string | null;
  recipient_name?: string | null;
  recipient_address?: string | null;
  note?: string | null;
  lines?: OutboundLinePayload[];
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
  customer_address: string;
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
  itemId?: string | null;
  skuId?: string | null;
  status: string;
  outboundNo?: string | null;
  payload: RawRecord;
}

export interface PrinterConfigRecord {
  id: string;
  code: string;
  name: string;
  status: string;
  labelSize?: string | null;
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
  if (
    status === "SCANNING" ||
    status === "POSTED" ||
    status === "CANCELLED"
  ) {
    return status;
  }
  return "DRAFT";
}

function rawLines(row: RawRecord): RawRecord[] {
  return rowsOf((row.lines ?? []) as RawRecord[] | { data?: RawRecord[] });
}

function normalizeLine(
  row: RawRecord,
  documentId: string,
): OutboundLineRecord {
  const expected = num(row.qty_planned ?? row.required_qty ?? row.quantity);
  const scanned = num(row.scanned_qty ?? row.qty_scanned);
  return {
    id: text(row.id ?? row.stock_document_line_id),
    documentId,
    productId: text(row.product_id ?? row.sku_id),
    expected,
    scanned,
    remaining: Math.max(expected - scanned, 0),
    note:
      row.note === undefined || row.note === null ? null : text(row.note),
  };
}

function normalizeDocument(row: RawRecord): OutboundDocumentRecord {
  const id = text(row.id ?? row.stock_document_id);
  const lines = rawLines(row).map((line) => normalizeLine(line, id));
  const expected = lines.reduce((sum, line) => sum + line.expected, 0);
  const scanned = lines.reduce((sum, line) => sum + line.scanned, 0);
  return {
    id,
    code: text(row.doc_no ?? row.document_no ?? row.code, id),
    date: text(row.doc_date ?? row.created_at),
    warehouseId: text(row.src_warehouse_id ?? row.warehouse_id),
    outboundRequestId: text(row.outbound_request_id) || null,
    agencyId: text(row.agency_id) || null,
    recipientName: text(row.recipient_name ?? row.customer_name, "-"),
    recipientAddress: text(
      row.recipient_address ?? row.customer_address,
      "-",
    ),
    note:
      row.note === undefined || row.note === null ? null : text(row.note),
    expected,
    scanned,
    status: normalizeStatus(row.status),
    version: num(row.version),
    createdBy: text(row.created_by_name ?? row.created_by, "-"),
    updatedAt: text(row.updated_at) || undefined,
  };
}

function normalizeDetail(row: RawRecord): OutboundDetail {
  const document = normalizeDocument(row);
  return {
    document,
    lines: rawLines(row).map((line) => normalizeLine(line, document.id)),
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
): Promise<OutboundDocumentRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.OUTBOUND_DOCUMENTS,
    {
      params: {
        ...(params.search ? { keyword: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.page ? { page: params.page } : {}),
        per_page: params.per_page ?? 100,
      },
    },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeDocument,
  );
}

export async function fetchOutboundDetail(
  id: string,
): Promise<OutboundDetail> {
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

function normalizeIssueEvidence(
  row: RawRecord,
  meta: ApiMeta,
): IssueEvidence {
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
  return parseJsonObject(row.label_payload);
}

export async function fetchLabelSnapshots(): Promise<
  LabelSnapshotRecord[]
> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.LABEL_SNAPSHOTS,
    { params: { per_page: 500 } },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    (row) => {
      const payload = labelPayload(row);
      return {
        id: text(row.id),
        itemId: text(row.item_id) || null,
        skuId: text(row.sku_id) || null,
        status: text(row.status),
        outboundNo: text(payload.outbound_no) || null,
        payload,
      };
    },
  );
}

export async function fetchPrinterConfigs(): Promise<
  PrinterConfigRecord[]
> {
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
    }),
  );
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

export async function fetchActiveRfidCodes(): Promise<
  PhysicalCodeRecord[]
> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.PHYSICAL_CODES,
    { params: { carrier_type: "RFID", status: "ACTIVE", per_page: 500 } },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    (row) => ({
      id: text(row.physical_code_id ?? row.id),
      codeValue: text(row.code_value),
      carrierType: text(row.carrier_type),
      hardwareUid: text(row.hardware_uid) || null,
      itemId: text(row.item_id ?? row.assigned_object_id) || null,
      status: text(row.status),
      version: num(row.version),
    }),
  );
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
