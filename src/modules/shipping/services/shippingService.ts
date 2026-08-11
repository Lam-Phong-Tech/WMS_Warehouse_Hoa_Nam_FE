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
import {
  WMS_ACTION_PERMISSIONS,
  WMS_PERMISSION_CATALOG,
} from "@/shared/constants/wms-permissions";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import type { ApiMeta } from "@/shared/types/api-response";
import type {
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
};
type RawRecord = Record<string, unknown>;
type ScanOptions = {
  ifMatch?: number;
  quantity?: number;
  printerConfigId?: string;
};

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value)
    ? value
    : Array.isArray(value.data)
      ? value.data
      : [];
}

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function endpoint(template: string, id: string | number): string {
  return template.replace(":id", String(id));
}

function rawLines(row: RawRecord): RawRecord[] {
  return rowsOf((row.lines ?? []) as RawRecord[] | { data?: RawRecord[] });
}

function normalizeStatus(value: unknown): OutboundDocument["status"] {
  const status = text(value).toUpperCase();
  if (status === "POSTED" || status === "ISSUED") return "POSTED";
  if (status === "CANCELLED" || status === "REJECTED") return "CANCELLED";
  if (status === "SCANNING" || status === "APPROVED") return "SCANNING";
  return "DRAFT";
}

function normalizeDocument(row: RawRecord): OutboundDocument {
  const lines = rawLines(row);
  const planned = lines.length
    ? lines.reduce(
        (sum, line) => sum + num(line.qty_planned ?? line.quantity),
        0,
      )
    : num(row.qty_planned ?? row.total_qty);
  const scanned = lines.length
    ? lines.reduce(
        (sum, line) => sum + num(line.scanned_qty ?? line.qty_scanned),
        0,
      )
    : num(row.scanned_qty ?? row.total_scanned);
  const status = normalizeStatus(row.status);
  const issued = status === "POSTED" ? planned : 0;

  return {
    id: text(row.id ?? row.stock_document_id),
    code: text(row.doc_no ?? row.document_no ?? row.code),
    receiverType: text(row.agency_id) ? "AGENCY" : "OTHER",
    receiverId: text(row.agency_id),
    receiverName: text(row.recipient_name ?? row.customer_name, "-"),
    date: text(row.doc_date ?? row.created_at),
    planned,
    issued,
    remaining: Math.max(planned - scanned, 0),
    status,
    createdBy: text(row.created_by_name ?? row.created_by, "-"),
    version: num(row.version),
  };
}

function normalizeLine(row: RawRecord, documentId: string): OutboundLine {
  const planned = num(row.qty_planned ?? row.quantity);
  const scanned = num(row.scanned_qty ?? row.qty_scanned);
  return {
    id: text(row.id ?? row.stock_document_line_id),
    documentId,
    productId: text(row.product_id) || undefined,
    sku: text(row.sku_code ?? row.product_code ?? row.sku),
    skuName: text(row.sku_name ?? row.product_name ?? row.name),
    scanSource: text(row.scan_source ?? row.product_code, "-"),
    available: num(row.available_qty ?? row.qty_available),
    planned,
    scanned,
    issued: normalizeStatus(row.document_status) === "POSTED" ? planned : 0,
    subsetNew: 0,
    validation: scanned <= planned ? "VALID" : "INVALID",
    validationMessage: undefined,
    selected: false,
  };
}

function mutationHeaders(ifMatch: number, idempotencyKey?: string) {
  const version = requirePositiveNumber(ifMatch, "If-Match");
  return {
    headers: {
      "If-Match": String(version),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
  };
}

function assertReadOnlyScanResponse(row: RawRecord): void {
  if (row.stock_effect !== undefined && row.stock_effect !== "NONE") {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "Outbound scan must have stock_effect=NONE",
    );
  }
  if (row.movement_created !== undefined && row.movement_created !== false) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_RESPONSE",
      "Outbound scan must not create stock movement",
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
    return (
      num(line.qty_planned ?? line.quantity) >
      num(line.scanned_qty ?? line.qty_scanned)
    );
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
      `Multiple outbound lines match scanned code ${code}; select the exact line in the canonical outbound UI`,
    );
  }
  return candidates[0];
}

function assertFullyScannedBeforeAtomicPost(detail: RawRecord): void {
  const lines = rawLines(detail);
  if (lines.length === 0) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_LINES",
      "Outbound document must contain lines before Post Issue",
    );
  }
  if (
    lines.some(
      (line) =>
        num(line.qty_planned ?? line.quantity) !==
        num(line.scanned_qty ?? line.qty_scanned),
    )
  ) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_FULL_SCAN",
      "Post Issue is whole-document; every line must be scanned exactly to planned quantity",
    );
  }
}

function normalizeIssueEvidence(row: RawRecord, meta: ApiMeta): IssueEvidence {
  const issueId = requireNonEmptyString(
    row.document_id ?? row.id ?? row.stock_document_id,
    "document_id",
    "WMS_FE_MISSING_ISSUE_EVIDENCE",
  );
  const rawMovements = row.movement_ids ?? row.movements ?? [];
  const movementRows: unknown[] = Array.isArray(rawMovements)
    ? rawMovements
    : typeof rawMovements === "object" &&
        rawMovements !== null &&
        Array.isArray((rawMovements as { data?: unknown[] }).data)
      ? (rawMovements as { data: unknown[] }).data
      : [];
  const movementRefs = movementRows
    .map((movement) =>
      typeof movement === "string"
        ? movement
        : text(
            (movement as RawRecord)?.id ??
              (movement as RawRecord)?.stock_movement_id ??
              (movement as RawRecord)?.movement_id,
          ),
    )
    .filter(Boolean);
  if (movementRefs.length === 0) {
    throw new WmsContractError(
      "WMS_FE_MISSING_ISSUE_EVIDENCE",
      "Post Issue response must include committed movement_ids",
    );
  }
  return {
    issueId,
    movementRef: movementRefs[0],
    movementRefs,
    requestId: requireNonEmptyString(
      meta.request_id ?? row.request_id,
      "request_id",
      "WMS_FE_MISSING_ISSUE_EVIDENCE",
    ),
    traceSource: "stock_document.movements",
    version: row.version === undefined ? undefined : num(row.version),
  };
}

export async function fetchOutboundDocuments(
  params: ListParams = {},
): Promise<OutboundDocument[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.OUTBOUND_DOCUMENTS,
    {
      params: {
        page: params.page,
        per_page: params.per_page ?? 100,
        status: params.status || undefined,
        keyword: params.search || undefined,
      },
    },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeDocument,
  );
}

export async function fetchOutboundDocument(
  id: string,
): Promise<OutboundDocument> {
  return normalizeDocument(
    await http.get<RawRecord>(endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, id)),
  );
}

export async function fetchOutboundLines(
  documentId: string,
): Promise<OutboundLine[]> {
  const detail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, documentId),
  );
  return rawLines(detail).map((line) => normalizeLine(line, documentId));
}

export async function createOutboundDocument<TPayload extends RawRecord>(
  payload: TPayload,
): Promise<OutboundDocument> {
  assertWmsActionPermission(
    [WMS_PERMISSION_CATALOG.OUTBOUND_CREATE],
    "create outbound document",
  );
  return normalizeDocument(
    await http.post<RawRecord>(API_ENDPOINTS.OUTBOUND_DOCUMENTS, payload),
  );
}

export async function updateOutboundDocument<TPayload extends RawRecord>(
  id: string,
  payload: TPayload,
  ifMatch: number,
): Promise<OutboundDocument> {
  assertWmsActionPermission(
    [WMS_PERMISSION_CATALOG.OUTBOUND_CREATE],
    "update outbound document",
  );
  return normalizeDocument(
    await http.patch<RawRecord>(
      endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, id),
      payload,
      mutationHeaders(ifMatch),
    ),
  );
}

export async function cancelOutboundDocument(
  id: string,
  reason: string,
  ifMatch: number,
): Promise<OutboundDocument> {
  assertWmsActionPermission(
    [WMS_PERMISSION_CATALOG.OUTBOUND_CANCEL],
    "cancel outbound document",
  );
  return normalizeDocument(
    await http.post<RawRecord>(
      endpoint(API_ENDPOINTS.OUTBOUND_CANCEL, id),
      { reason: requireNonEmptyString(reason, "reason") },
      mutationHeaders(ifMatch),
    ),
  );
}

export async function scanOutboundDocument(
  id: string,
  codes: string[],
  options: ScanOptions = {},
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
  const detail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, id),
  );
  const warehouseId = requireNonEmptyString(
    detail.src_warehouse_id ?? detail.warehouse_id,
    "src_warehouse_id",
  );
  const lines = rawLines(detail);
  let currentVersion = requirePositiveNumber(
    options.ifMatch ?? detail.version,
    "If-Match",
  );
  const quantity = options.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity !== 1) {
    throw new WmsContractError(
      "WMS_FE_INVALID_SCAN_QUANTITY",
      "PRODUCT outbound scan is item-level and quantity must equal 1",
    );
  }

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
      {
        line_id: lineId,
        quantity: 1,
        code_value: code,
        ...(classification.item_id ? { item_id: classification.item_id } : {}),
        ...(options.printerConfigId
          ? { printer_config_id: options.printerConfigId }
          : {}),
      },
      mutationHeaders(currentVersion),
    );
    assertReadOnlyScanResponse(response);
    currentVersion = requirePositiveNumber(response.version, "scan.version");
    results.push({
      code_value: code,
      status: "VALID",
      sku: text(line.sku_code ?? line.product_code ?? line.sku) || undefined,
      line_id: lineId,
      message: text(response.message) || undefined,
      version: currentVersion,
    });
    const index = lines.indexOf(line);
    if (index >= 0) {
      lines[index] = {
        ...line,
        scanned_qty: num(line.scanned_qty ?? line.qty_scanned) + 1,
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
  const idempotencyKey = requireIdempotencyKeyHeader(request.idempotencyKey)[
    "Idempotency-Key"
  ];
  const ifMatch = requirePositiveNumber(request.ifMatch, "If-Match");
  const detail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_DOCUMENT, documentId),
  );
  assertFullyScannedBeforeAtomicPost(detail);
  const currentVersion = requirePositiveNumber(detail.version, "document.version");
  if (currentVersion !== ifMatch) {
    throw new WmsContractError(
      "WMS_FE_VERSION_CONFLICT",
      `Outbound version changed from ${ifMatch} to ${currentVersion}`,
    );
  }
  const result = await http.postWithMeta<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_POST_ISSUE, documentId),
    undefined,
    mutationHeaders(ifMatch, idempotencyKey),
  );
  return normalizeIssueEvidence(result.data, result.meta);
}

/** Obsolete state transitions are deliberately fail-closed. */
export async function submitOutboundDocument(): Promise<OutboundDocument> {
  throw new WmsContractError(
    "WMS_FE_ROUTE_NOT_REGISTERED",
    "POST /outbound-documents/:id/submit is not registered by BE m1",
  );
}
export async function approveOutboundDocument(): Promise<OutboundDocument> {
  throw new WmsContractError(
    "WMS_FE_ROUTE_NOT_REGISTERED",
    "POST /outbound-documents/:id/approve is not registered by BE m1",
  );
}
export async function rejectOutboundDocument(): Promise<OutboundDocument> {
  throw new WmsContractError(
    "WMS_FE_ROUTE_NOT_REGISTERED",
    "POST /outbound-documents/:id/reject is not registered by BE m1",
  );
}
export async function closeOutboundRemainder(): Promise<OutboundDocument> {
  throw new WmsContractError(
    "WMS_FE_ROUTE_NOT_REGISTERED",
    "Outbound is full-post only; close-remainder does not exist",
  );
}

export async function reverseOutboundDocument(
  id: string,
  payload: RawRecord,
  idempotencyKey: string,
  ifMatch: number,
): Promise<RawRecord> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.POST_REVERSAL,
    "reverse outbound document",
  );
  const key = requireIdempotencyKeyHeader(idempotencyKey)["Idempotency-Key"];
  return http.post<RawRecord>(
    endpoint(API_ENDPOINTS.OUTBOUND_REVERSE, id),
    payload,
    mutationHeaders(ifMatch, key),
  );
}
