import { http } from "@/shared/api/http";
import type {
  CloseRemainderRequest,
  OutboundDocument,
  OutboundLine,
  OutboundScanResult,
  PostIssueRequest,
} from "../types";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

type ListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  warehouse_id?: number;
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

function mapOutboundStatus(value: unknown): OutboundDocument["status"] {
  const status = text(value).toLowerCase();
  if (status === "issued") return "POSTED";
  if (status === "approved") return "SCANNING";
  if (status === "pending") return "DRAFT";
  if (status === "cancelled" || status === "rejected") return "CANCELLED";
  return "DRAFT";
}

function normalizeDocument(row: RawRecord): OutboundDocument {
  const planned = num(row.qty_planned ?? row.total_qty);
  const issued = num(row.qty_issued ?? row.qty_posted ?? row.issued_qty);
  return {
    id: text(row.id),
    code: text(row.doc_no ?? row.code ?? row.document_no),
    receiverType:
      text(row.receiver_type ?? row.customer_type, "OTHER") === "AGENCY"
        ? "AGENCY"
        : "OTHER",
    receiverId: text(row.receiver_id ?? row.customer_id),
    receiverName: text(row.receiver_name ?? row.customer_name ?? row.note, "-"),
    date: text(row.doc_date ?? row.date ?? row.created_at),
    planned,
    issued,
    remaining: num(row.remaining_qty ?? row.qty_remaining ?? planned - issued),
    status: mapOutboundStatus(row.status),
    createdBy: text(
      row.created_by_name ?? row.created_by ?? row.creator_name,
      "-",
    ),
    version: num(row.version ?? row.lock_version ?? 1),
  };
}

function normalizeLine(row: RawRecord, documentId: string): OutboundLine {
  const planned = num(row.qty_planned ?? row.quantity);
  const issued = num(row.qty_issued ?? row.qty_posted ?? row.issued_qty);
  return {
    id: text(row.id),
    documentId,
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.product_code),
    skuName: text(row.sku_name ?? row.product_name ?? row.name),
    scanSource: text(row.scan_source ?? row.lot_no ?? row.product_code, "-"),
    available: num(row.available_qty ?? row.qty_available),
    planned,
    issued,
    subsetNew: num(row.subset_new ?? planned - issued),
    validation: "VALID",
    validationMessage: undefined,
    selected: false,
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

export async function fetchOutboundDocuments(
  params: ListParams = {},
): Promise<OutboundDocument[]> {
  const result = await http.getPage<
    OutboundDocument[] | { data?: RawRecord[] }
  >(API_ENDPOINTS.OUTBOUND_DOCUMENTS, { params });
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeDocument,
  );
}

export async function fetchOutboundLines(
  documentId: string,
): Promise<OutboundLine[]> {
  const detail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_LINES, documentId),
  );
  return rowsOf((detail.lines ?? detail.items ?? []) as RawRecord[]).map(
    (line) => normalizeLine(line, documentId),
  );
}

export async function fetchOutboundDocument(
  id: string,
): Promise<OutboundDocument> {
  const detail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, id),
  );
  return normalizeDocument(detail);
}

export async function createOutboundDocument<TPayload extends RawRecord>(
  payload: TPayload,
): Promise<OutboundDocument> {
  const result = await http.post<RawRecord>(
    API_ENDPOINTS.OUTBOUND_DOCUMENTS,
    payload,
  );
  return normalizeDocument(result);
}

export async function updateOutboundDocument<TPayload extends RawRecord>(
  id: string,
  payload: TPayload,
): Promise<OutboundDocument> {
  return http.patch<OutboundDocument>(
    endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, id),
    payload,
  );
}

export async function submitOutboundDocument(
  id: string,
): Promise<OutboundDocument> {
  return http.post<OutboundDocument>(
    endpoint(API_ENDPOINTS.OUTBOUND_SUBMIT, id),
  );
}

export async function approveOutboundDocument(
  id: string,
): Promise<OutboundDocument> {
  return http.post<OutboundDocument>(
    endpoint(API_ENDPOINTS.OUTBOUND_APPROVE, id),
  );
}

export async function rejectOutboundDocument(
  id: string,
  reason: string,
): Promise<OutboundDocument> {
  return http.post<OutboundDocument>(
    endpoint(API_ENDPOINTS.OUTBOUND_REJECT, id),
    {
      reason,
    },
  );
}

export async function cancelOutboundDocument(
  id: string,
  reason: string,
): Promise<OutboundDocument> {
  return http.post<OutboundDocument>(
    endpoint(API_ENDPOINTS.OUTBOUND_CANCEL, id),
    {
      reason,
    },
  );
}

export async function scanOutboundDocument(
  id: string,
  codes: string[],
  extra?: RawRecord,
): Promise<OutboundScanResult[]> {
  const result = await http.post<
    | OutboundScanResult[]
    | { data?: OutboundScanResult[]; results?: OutboundScanResult[] }
  >(endpoint(API_ENDPOINTS.OUTBOUND_SCAN, id), {
    ...extra,
    codes,
  });
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.results)) return result.results;
  return Array.isArray(result.data) ? result.data : [];
}

export async function postOutboundIssue(
  request: PostIssueRequest,
): Promise<RawRecord> {
  return http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_POST_ISSUE, request.documentId),
    { lines: request.lines },
    idempotencyConfig(request.idempotencyKey, request.ifMatch),
  );
}

export async function closeOutboundRemainder(
  request: CloseRemainderRequest,
): Promise<OutboundDocument> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_CLOSE_REMAINDER, request.documentId),
    { reason: request.reason },
    idempotencyConfig(request.idempotencyKey, request.ifMatch),
  );
  return normalizeDocument(result);
}

export async function reverseOutboundDocument(
  id: string,
  payload: RawRecord,
  idempotencyKey?: string,
): Promise<RawRecord> {
  return http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_REVERSE, id),
    payload,
    idempotencyConfig(idempotencyKey),
  );
}
