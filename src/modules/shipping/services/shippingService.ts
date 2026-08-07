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
  IssueEvidence,
  OutboundDocument,
  OutboundLine,
  OutboundScanResult,
  PostIssueRequest,
} from "../types";

type ListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  warehouse_id?: number | string;
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
  if (status === "partially_posted") return "PARTIALLY_POSTED";
  if (status === "closed") return "CLOSED";
  if (status === "pending" || status === "draft") return "DRAFT";
  if (status === "cancelled" || status === "rejected") return "CANCELLED";
  return "DRAFT";
}

function normalizeDocument(row: RawRecord): OutboundDocument {
  const planned = num(row.qty_planned ?? row.total_qty);
  const issued = num(row.qty_issued ?? row.qty_posted ?? row.issued_qty);
  return {
    id: text(row.id ?? row.stock_document_id),
    code: text(row.doc_no ?? row.code ?? row.document_no),
    receiverType:
      text(row.receiver_type ?? row.customer_type, "OTHER") === "AGENCY"
        ? "AGENCY"
        : "OTHER",
    receiverId: text(row.receiver_id ?? row.customer_id),
    receiverName: text(
      row.receiver_name ?? row.customer_name ?? row.note,
      "-",
    ),
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
  const scanned = num(row.scanned_qty ?? row.qty_scanned ?? 0);
  return {
    id: text(row.id ?? row.stock_document_line_id),
    documentId,
    productId: text(row.product_id) || undefined,
    sku: text(row.sku ?? row.sku_code ?? row.product_sku ?? row.product_code),
    skuName: text(row.sku_name ?? row.product_name ?? row.name),
    scanSource: text(row.scan_source ?? row.lot_no ?? row.product_code, "-"),
    available: num(row.available_qty ?? row.qty_available),
    planned,
    issued,
    scanned,
    subsetNew: Math.max(0, scanned - issued),
    validation: "VALID",
    validationMessage: undefined,
    selected: scanned > issued,
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

function idempotencyConfig(key?: string, ifMatch?: number) {
  return {
    headers: {
      ...(key ? { "Idempotency-Key": key } : {}),
      ...(ifMatch !== undefined ? { "If-Match": String(ifMatch) } : {}),
    },
  };
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
    const planned = num(line.qty_planned ?? line.quantity);
    const scanned = num(line.scanned_qty ?? line.qty_scanned ?? 0);
    return planned > scanned;
  });
  if (candidates.length === 0) {
    throw new WmsContractError(
      "WMS_FE_SCAN_LINE_NOT_FOUND",
      `No remaining outbound line matches scanned code ${code}`,
    );
  }
  if (candidates.length > 1) {
    throw new WmsContractError(
      "WMS_FE_SCAN_LINE_AMBIGUOUS",
      `Multiple outbound lines match scanned code ${code}; explicit line selection is required`,
    );
  }
  return candidates[0];
}

function assertFullyScannedBeforeAtomicPost(detail: RawRecord): void {
  const lines = rawLines(detail);
  if (lines.length === 0) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_LINES",
      "Outbound document must contain at least one line before post-issue",
    );
  }
  const incomplete = lines.filter((line) => {
    const planned = num(line.qty_planned ?? line.quantity);
    const scanned = num(line.scanned_qty ?? line.qty_scanned ?? 0);
    return !Number.isFinite(planned) || planned <= 0 || scanned < planned;
  });
  if (incomplete.length > 0) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_FULL_SCAN",
      "WWHN-180 v1.7 post-issue is whole-document; every planned line must be fully scanned before FE sends the atomic posting command",
    );
  }
}

function normalizeIssueEvidence(row: RawRecord, meta: ApiMeta): IssueEvidence {
  const issueId = requireNonEmptyString(
    row.id ?? row.stock_document_id ?? row.document_id,
    "issue_id",
    "WMS_FE_MISSING_ISSUE_EVIDENCE",
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
      "WMS_FE_MISSING_ISSUE_EVIDENCE",
      "Post issue response must include at least one committed stock movement",
    );
  }
  const requestId = requireNonEmptyString(
    meta.request_id ?? row.request_id,
    "request_id",
    "WMS_FE_MISSING_ISSUE_EVIDENCE",
  );
  return {
    issueId,
    movementRef: movementRefs[0],
    movementRefs,
    requestId,
    traceSource: "stock_document.movements",
  };
}

export async function fetchOutboundDocuments(
  params: ListParams = {},
): Promise<OutboundDocument[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.OUTBOUND_DOCUMENTS,
    { params },
  );
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
  return rawLines(detail).map((line) => normalizeLine(line, documentId));
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
  const result = await http.patch<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, id),
    payload,
  );
  return normalizeDocument(result);
}

export async function submitOutboundDocument(
  id: string,
): Promise<OutboundDocument> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_SUBMIT, id),
  );
  return normalizeDocument(result);
}

export async function approveOutboundDocument(
  id: string,
): Promise<OutboundDocument> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_APPROVE, id),
  );
  return normalizeDocument(result);
}

export async function rejectOutboundDocument(
  id: string,
  reason: string,
): Promise<OutboundDocument> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_REJECT, id),
    { reason },
  );
  return normalizeDocument(result);
}

export async function cancelOutboundDocument(
  id: string,
  reason: string,
): Promise<OutboundDocument> {
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_CANCEL, id),
    { reason },
  );
  return normalizeDocument(result);
}

export async function scanOutboundDocument(
  id: string,
  codes: string[],
  extra: RawRecord = {},
): Promise<OutboundScanResult[]> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.SCAN_OUTBOUND,
    "scan outbound document",
  );
  const normalizedCodes = requireUniqueStrings(
    codes,
    "codes",
    "WMS_FE_DUPLICATE_SCAN_CODE",
  );
  const qty =
    extra.qty === undefined ? 1 : requirePositiveNumber(extra.qty, "qty");
  const detail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, id),
  );
  const warehouseId = requireNonEmptyString(
    detail.src_warehouse_id ?? detail.warehouse_id,
    "src_warehouse_id",
  );
  const lines = rawLines(detail);
  const results: OutboundScanResult[] = [];

  for (const code of normalizedCodes) {
    const classification = await classifyScanCodes({
      raw_code: code,
      context: "OUTBOUND",
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
      endpoint(API_ENDPOINTS.OUTBOUND_SCAN, id),
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

export async function postOutboundIssue(
  request: PostIssueRequest,
): Promise<IssueEvidence> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.POST_ISSUE,
    "post outbound issue",
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
    endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, documentId),
  );
  assertFullyScannedBeforeAtomicPost(detail);
  const result = await http.postWithMeta<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_POST_ISSUE, documentId),
    undefined,
    { headers },
  );
  return normalizeIssueEvidence(result.data, result.meta);
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
