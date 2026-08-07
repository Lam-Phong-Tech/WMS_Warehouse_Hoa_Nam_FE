import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import {
  requireIdempotencyKeyHeader,
  requireNonEmptyString,
  requirePositiveNumber,
  requireUniqueStrings,
  WmsContractError,
} from "@/shared/api/wms-contract";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import type { ApiMeta } from "@/shared/types/api-response";
import type {
  CloseRemainderRequest,
  InboundDocument,
  InboundLine,
  InboundScanResult,
  PostReceiptRequest,
  ReceiptEvidence,
} from "../types";

type ListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  warehouse_id?: number | string;
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
  if (status === "partially_posted") return "PARTIALLY_POSTED";
  if (status === "closed") return "CLOSED";
  if (status === "pending" || status === "draft") return "DRAFT";
  if (status === "cancelled" || status === "rejected") return "CANCELLED";
  return "DRAFT";
}

function normalizeDocument(row: RawRecord): InboundDocument {
  const expected = num(row.qty_expected ?? row.qty_planned ?? row.total_qty);
  const posted = num(row.qty_received ?? row.qty_posted ?? row.received_qty);
  return {
    id: text(row.id ?? row.stock_document_id),
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
  const scanned = num(row.qty_scanned ?? row.scanned_qty ?? 0);
  const posted = num(row.qty_received ?? row.qty_posted ?? row.received_qty);
  return {
    id: text(row.id ?? row.stock_document_line_id),
    documentId,
    productId: text(row.product_id) || undefined,
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.product_code),
    skuName: text(row.sku_name ?? row.product_name ?? row.name),
    scanTarget: text(row.scan_target ?? row.lot_no ?? row.product_code, "-"),
    expected,
    scanned,
    posted,
    remaining: num(row.remaining_qty ?? expected - posted),
    validation: "VALID",
    selected: false,
  };
}

function rawLines(row: RawRecord): RawRecord[] {
  return rowsOf(
    (row.lines ?? row.items ?? []) as RawRecord[] | { data?: RawRecord[] },
  );
}

function endpoint(template: string, id: string | number): string {
  return template.replace(":id", String(id));
}

function assertReadOnlyScanResponse(row: RawRecord): void {
  if (row.stock_effect !== undefined && row.stock_effect !== "NONE") {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "Line scan must have stock_effect=NONE",
    );
  }
  if (row.movement_created !== undefined && row.movement_created !== false) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "Line scan must not create stock movement",
    );
  }
}

function findSingleLineForProduct(
  lines: RawRecord[],
  productId: string,
  code: string,
): RawRecord {
  const candidates = lines.filter((line) => {
    if (text(line.product_id) !== productId) return false;
    const planned = num(line.qty_planned ?? line.qty_expected ?? line.quantity);
    const scanned = num(line.scanned_qty ?? line.qty_scanned ?? 0);
    return planned > scanned;
  });
  if (candidates.length === 0) {
    throw new WmsContractError(
      "WMS_FE_SCAN_LINE_NOT_FOUND",
      `No remaining inbound line matches scanned code ${code}`,
    );
  }
  if (candidates.length > 1) {
    throw new WmsContractError(
      "WMS_FE_SCAN_LINE_AMBIGUOUS",
      `Multiple inbound lines match scanned code ${code}; explicit line selection is required`,
    );
  }
  return candidates[0];
}

function assertFullyScannedBeforeAtomicPost(detail: RawRecord): void {
  const lines = rawLines(detail);
  if (lines.length === 0) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_LINES",
      "Inbound document must contain at least one line before post-receipt",
    );
  }
  const incomplete = lines.filter((line) => {
    const planned = num(line.qty_planned ?? line.qty_expected ?? line.quantity);
    const scanned = num(line.scanned_qty ?? line.qty_scanned ?? 0);
    return !Number.isFinite(planned) || planned <= 0 || scanned < planned;
  });
  if (incomplete.length > 0) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_FULL_SCAN",
      "WWHN-180 v1.7 post-receipt is whole-document; every planned line must be fully scanned before FE sends the atomic posting command",
    );
  }
}

function normalizeReceiptEvidence(
  row: RawRecord,
  meta: ApiMeta,
): ReceiptEvidence {
  const receiptId = requireNonEmptyString(
    row.id ?? row.stock_document_id ?? row.document_id,
    "receipt_id",
    "WMS_FE_MISSING_RECEIPT_EVIDENCE",
  );
  const movements = rowsOf(
    (row.movements ?? []) as RawRecord[] | { data?: RawRecord[] },
  );
  const movementRefs = movements
    .map((movement) =>
      text(
        movement.id ??
          movement.stock_movement_id ??
          movement.movement_id ??
          movement.movement_no,
      ),
    )
    .filter(Boolean);
  if (movementRefs.length === 0) {
    throw new WmsContractError(
      "WMS_FE_MISSING_RECEIPT_EVIDENCE",
      "Post receipt response must include at least one committed stock movement",
    );
  }
  const requestId = requireNonEmptyString(
    meta.request_id ?? row.request_id,
    "request_id",
    "WMS_FE_MISSING_RECEIPT_EVIDENCE",
  );
  return {
    receiptId,
    movementRef: movementRefs[0],
    movementRefs,
    requestId,
    traceSource: "stock_document.movements",
  };
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
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
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
    API_ENDPOINTS.INBOUND_LINES.replace(":id", documentId),
  );
  return rawLines(detail).map((line) => normalizeLine(line, documentId));
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
  const result = await http.post<RawRecord>(
    API_ENDPOINTS.INBOUND_DOCUMENTS,
    payload,
  );
  return normalizeDocument(result);
}

export async function updateInboundDocument<TPayload extends RawRecord>(
  id: string,
  payload: TPayload,
): Promise<InboundDocument> {
  const result = await http.patch<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, id),
    payload,
  );
  return normalizeDocument(result);
}

export async function submitInboundDocument(
  id: string,
): Promise<InboundDocument> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_SUBMIT, id),
  );
  return normalizeDocument(result);
}

export async function approveInboundDocument(
  id: string,
): Promise<InboundDocument> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_APPROVE, id),
  );
  return normalizeDocument(result);
}

export async function rejectInboundDocument(
  id: string,
  reason: string,
): Promise<InboundDocument> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_REJECT, id),
    { reason },
  );
  return normalizeDocument(result);
}

export async function cancelInboundDocument(
  id: string,
  reason: string,
): Promise<InboundDocument> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_CANCEL, id),
    { reason },
  );
  return normalizeDocument(result);
}

/**
 * UI scans raw physical/SKU codes. Exact BE line-scan accepts line_id + qty,
 * so FE first calls the read-only canonical classifier, resolves exactly one
 * remaining document line, then sends the no-stock-effect line validation.
 */
export async function scanInboundDocument(
  id: string,
  codes: string[],
  extra: RawRecord = {},
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
  const qty =
    extra.qty === undefined ? 1 : requirePositiveNumber(extra.qty, "qty");
  const detail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, id),
  );
  const warehouseId = requireNonEmptyString(
    detail.dst_warehouse_id ?? detail.warehouse_id,
    "dst_warehouse_id",
  );
  const lines = rawLines(detail);
  const results: InboundScanResult[] = [];

  for (const code of normalizedCodes) {
    const classification = await classifyScanCodes({
      raw_code: code,
      context: "INBOUND",
      warehouse_id: warehouseId,
    });
    const productId = requireNonEmptyString(
      classification.product_id,
      "classification.product_id",
      "WMS_FE_SCAN_PRODUCT_UNRESOLVED",
    );
    const line = findSingleLineForProduct(lines, productId, code);
    const lineId = requireNonEmptyString(
      line.id ?? line.stock_document_line_id,
      "line_id",
    );
    const response = await http.post<RawRecord>(
      endpoint(API_ENDPOINTS.INBOUND_SCAN, id),
      { line_id: lineId, qty },
    );
    assertReadOnlyScanResponse(response);
    results.push({
      code_value: code,
      status: "VALID",
      sku: text(line.sku ?? line.sku_code ?? line.product_code) || undefined,
      line_id: lineId,
      message: text(response.message) || undefined,
    });
    const lineIndex = lines.indexOf(line);
    if (lineIndex >= 0) {
      lines[lineIndex] = {
        ...line,
        scanned_qty: num(line.scanned_qty ?? line.qty_scanned ?? 0) + qty,
      };
    }
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
  if (request.lines && request.lines.length > 0) {
    requireUniqueStrings(
      request.lines.map((line) => line.lineId),
      "lines.lineId",
      "WMS_FE_DUPLICATE_LINE",
    );
  }
  const headers = requireIdempotencyKeyHeader(request.idempotencyKey);
  const detail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, documentId),
  );
  assertFullyScannedBeforeAtomicPost(detail);
  const result = await http.postWithMeta<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_POST_RECEIPT, documentId),
    undefined,
    { headers },
  );
  return normalizeReceiptEvidence(result.data, result.meta);
}

export async function closeInboundRemainder(
  request: CloseRemainderRequest,
): Promise<InboundDocument> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_CLOSE_REMAINDER, request.documentId),
    { reason: request.reason },
  );
  return normalizeDocument(result);
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
