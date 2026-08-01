import { http } from "@/shared/api/http";
import type {
  CloseRemainderRequest,
  InboundDocument,
  InboundLine,
  InboundScanResult,
  PostReceiptRequest,
  ReceiptEvidence,
} from "../types";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

type ListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  warehouse_id?: number;
  from_date?: string;
  to_date?: string;
};

type RawRecord = Record<string, unknown>;

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

function mapInboundStatus(value: unknown): InboundDocument["status"] {
  const status = text(value).toLowerCase();
  if (status === "received") return "POSTED";
  if (status === "approved") return "SCANNING";
  if (status === "pending") return "DRAFT";
  if (status === "cancelled" || status === "rejected") return "CANCELLED";
  return "DRAFT";
}

function normalizeDocument(row: RawRecord): InboundDocument {
  const expected = num(row.qty_expected ?? row.qty_planned ?? row.total_qty);
  const posted = num(row.qty_received ?? row.qty_posted ?? row.received_qty);
  return {
    id: text(row.id),
    code: text(row.doc_no ?? row.code ?? row.document_no),
    source: text(row.supplier_name ?? row.source ?? row.note, "-"),
    date: text(row.doc_date ?? row.date ?? row.created_at),
    expected,
    posted,
    remaining: num(row.remaining_qty ?? row.qty_remaining ?? expected - posted),
    status: mapInboundStatus(row.status),
    createdBy: text(
      row.created_by_name ?? row.created_by ?? row.creator_name,
      "-",
    ),
    version: num(row.version ?? row.lock_version ?? 1),
    sourceReference: text(row.source_reference ?? row.note),
  };
}

function normalizeLine(row: RawRecord, documentId: string): InboundLine {
  const expected = num(row.qty_expected ?? row.qty_planned ?? row.quantity);
  const posted = num(row.qty_received ?? row.qty_posted ?? row.received_qty);
  return {
    id: text(row.id),
    documentId,
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.product_code),
    skuName: text(row.sku_name ?? row.product_name ?? row.name),
    scanTarget: text(row.scan_target ?? row.lot_no ?? row.product_code, "-"),
    expected,
    scanned: num(row.qty_scanned ?? row.scanned_qty ?? posted),
    posted,
    remaining: num(row.remaining_qty ?? expected - posted),
    validation: "VALID",
    selected: false,
  };
}

function normalizeScanResult(row: RawRecord): InboundScanResult {
  const rawStatus = text(row.status ?? row.result).toUpperCase();
  const status: InboundScanResult["status"] =
    rawStatus === "DUPLICATE" ||
    rawStatus === "UNKNOWN" ||
    rawStatus === "INVALID"
      ? rawStatus
      : "VALID";
  return {
    code_value: text(row.code_value ?? row.code ?? row.value),
    status,
    sku: text(row.sku ?? row.sku_code, undefined),
    line_id: text(row.line_id ?? row.lineId, undefined),
    message: text(row.message, undefined),
  };
}

export function normalizeReceiptEvidence(row: RawRecord): ReceiptEvidence {
  const evidence = (row.evidence ??
    row.receipt ??
    row.data ??
    row) as RawRecord;
  return {
    receiptId: text(
      evidence.receipt_id ?? evidence.receiptId ?? evidence.receipt_no,
      undefined,
    ),
    movementRef: text(
      evidence.movement_ref ??
        evidence.movementRef ??
        evidence.stock_movement_id ??
        evidence.movement_id,
      undefined,
    ),
    requestId: text(
      evidence.request_id ?? evidence.requestId ?? row.request_id,
      undefined,
    ),
    traceSource: text(
      evidence.trace_source ?? evidence.traceSource ?? evidence.trace,
      undefined,
    ),
    replayed: Boolean(evidence.replayed ?? evidence.idempotency_replay),
  };
}

function endpoint(template: string, id: string | number): string {
  return template.replace(":id", String(id));
}

function idempotencyConfig(key?: string, ifMatch?: number) {
  return {
    headers: {
      ...(key ? { "Idempotency-Key": key } : {}),
      ...(ifMatch !== undefined ? { "If-Match": String(ifMatch) } : {}),
    },
  };
}

export async function fetchInboundDocuments(
  params: ListParams = {},
): Promise<InboundDocument[]> {
  const result = await http.getPage<InboundDocument[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.INBOUND_DOCUMENTS,
    { params },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeDocument,
  );
}

export async function fetchInboundLines(
  documentId: string,
): Promise<InboundLine[]> {
  const detail = await http.get<RawRecord>(
    `${API_ENDPOINTS.INBOUND_LINES.replace(":id", documentId)}`,
  );
  return rowsOf((detail.lines ?? detail.items ?? []) as RawRecord[]).map(
    (line) => normalizeLine(line, documentId),
  );
}

export async function fetchInboundDocument(
  id: string,
): Promise<InboundDocument> {
  const detail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, id),
  );
  return normalizeDocument(detail);
}

export async function createInboundDocument<TPayload extends RawRecord>(
  payload: TPayload,
): Promise<InboundDocument> {
  return http.post<InboundDocument>(API_ENDPOINTS.INBOUND_DOCUMENTS, payload);
}

export async function updateInboundDocument<TPayload extends RawRecord>(
  id: string,
  payload: TPayload,
): Promise<InboundDocument> {
  return http.patch<InboundDocument>(
    endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, id),
    payload,
  );
}

export async function submitInboundDocument(
  id: string,
): Promise<InboundDocument> {
  return http.post<InboundDocument>(endpoint(API_ENDPOINTS.INBOUND_SUBMIT, id));
}

export async function approveInboundDocument(
  id: string,
): Promise<InboundDocument> {
  return http.post<InboundDocument>(
    endpoint(API_ENDPOINTS.INBOUND_APPROVE, id),
  );
}

export async function rejectInboundDocument(
  id: string,
  reason: string,
): Promise<InboundDocument> {
  return http.post<InboundDocument>(
    endpoint(API_ENDPOINTS.INBOUND_REJECT, id),
    {
      reason,
    },
  );
}

export async function cancelInboundDocument(
  id: string,
  reason: string,
): Promise<InboundDocument> {
  return http.post<InboundDocument>(
    endpoint(API_ENDPOINTS.INBOUND_CANCEL, id),
    {
      reason,
    },
  );
}

export async function scanInboundDocument(
  id: string,
  codes: string[],
  extra?: RawRecord,
): Promise<InboundScanResult[]> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_SCAN, id),
    {
      ...extra,
      codes,
    },
  );
  return rowsOf(
    (result.results ?? result.items ?? result.scans ?? result.data ?? []) as
      | RawRecord[]
      | { data?: RawRecord[] },
  ).map(normalizeScanResult);
}

export async function postInboundReceipt(
  request: PostReceiptRequest,
): Promise<RawRecord> {
  return http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_POST_RECEIPT, request.documentId),
    { lines: request.lines },
    idempotencyConfig(request.idempotencyKey, request.ifMatch),
  );
}

export async function closeInboundRemainder(
  request: CloseRemainderRequest,
): Promise<InboundDocument> {
  return http.post<InboundDocument>(
    endpoint(API_ENDPOINTS.INBOUND_CLOSE_REMAINDER, request.documentId),
    { reason: request.reason },
  );
}

export async function reverseInboundDocument(
  id: string,
  payload: RawRecord,
  idempotencyKey?: string,
): Promise<RawRecord> {
  return http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_REVERSE, id),
    payload,
    idempotencyConfig(idempotencyKey),
  );
}
