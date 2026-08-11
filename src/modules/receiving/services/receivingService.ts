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
  CreateInboundPayload,
  InboundDetail,
  InboundDocument,
  InboundLine,
  InboundScanResult,
  PostReceiptRequest,
  ReceiptEvidence,
  UpdateInboundPayload,
} from "../types";

type ListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
};

type ScanOptions = {
  lineId?: string;
  ifMatch?: number;
  includeCodeValue?: boolean;
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
  if (status === "POSTED" || status === "RECEIVED") return "POSTED";
  if (status === "CANCELLED" || status === "REJECTED") return "CANCELLED";
  if (status === "SCANNING" || status === "APPROVED" || status === "PENDING") {
    return "SCANNING";
  }
  return "DRAFT";
}

function normalizeDocument(row: RawRecord): InboundDocument {
  const lines = rawLines(row);
  const expected = lines.length
    ? lines.reduce(
        (sum, line) => sum + num(line.qty_planned ?? line.qty_expected ?? line.quantity),
        0,
      )
    : num(row.qty_expected ?? row.qty_planned ?? row.total_qty);
  const status = normalizeStatus(row.status);
  const posted = status === "POSTED" ? expected : 0;
  return {
    id: text(row.id ?? row.stock_document_id),
    code: text(row.doc_no ?? row.code ?? row.document_no),
    source: text(row.source_name ?? row.supplier_name ?? row.source ?? row.note, "-"),
    date: text(row.doc_date ?? row.date ?? row.created_at),
    warehouseId: text(row.dst_warehouse_id ?? row.warehouse_id),
    expected,
    posted,
    remaining: Math.max(expected - posted, 0),
    status,
    createdBy: text(row.created_by_name ?? row.created_by ?? row.creator_name, "-"),
    updatedAt: text(row.updated_at) || undefined,
    version: num(row.version ?? row.lock_version ?? 1),
    sourceReference: text(row.source_reference) || undefined,
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
    lines: rawLines(row).map((line) => normalizeLine(line, document.id, document.status)),
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

function findSingleLineForProduct(
  lines: RawRecord[],
  productId: string,
  code: string,
): RawRecord {
  const candidates = lines.filter((line) => {
    if (text(line.product_id ?? line.sku_id) !== productId) return false;
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
      `Multiple inbound lines match ${code}; choose a document line before scanning`,
    );
  }
  return candidates[0];
}

function findLineById(lines: RawRecord[], lineId: string): RawRecord {
  const line = lines.find(
    (candidate) => text(candidate.id ?? candidate.stock_document_line_id) === lineId,
  );
  if (!line) {
    throw new WmsContractError(
      "WMS_FE_SCAN_LINE_NOT_FOUND",
      "Selected inbound line is no longer present in the document",
    );
  }
  return line;
}

function assertFullyScanned(detail: InboundDetail): void {
  if (detail.lines.length === 0) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_LINES",
      "Inbound document must contain at least one line before Post Receipt",
    );
  }
  if (detail.lines.some((line) => line.scanned !== line.expected)) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_FULL_SCAN",
      "Every inbound line must be scanned exactly to planned quantity before atomic Post Receipt",
    );
  }
}

function normalizeReceiptEvidence(row: RawRecord, meta: ApiMeta): ReceiptEvidence {
  const receiptId = requireNonEmptyString(
    row.document_id ?? row.id ?? row.stock_document_id,
    "document_id",
    "WMS_FE_MISSING_RECEIPT_EVIDENCE",
  );
  const movementRefs = rowsOf(
    (row.movement_ids ?? row.movements ?? []) as string[] | RawRecord[] | { data?: string[] },
  )
    .map((movement) =>
      typeof movement === "string"
        ? movement
        : text(
            (movement as RawRecord).id ??
              (movement as RawRecord).stock_movement_id ??
              (movement as RawRecord).movement_id ??
              (movement as RawRecord).movement_no,
          ),
    )
    .filter(Boolean);
  if (movementRefs.length === 0) {
    throw new WmsContractError(
      "WMS_FE_MISSING_RECEIPT_EVIDENCE",
      "Post Receipt response must include committed movement_ids",
    );
  }
  return {
    receiptId,
    movementRef: movementRefs[0],
    movementRefs,
    requestId: requireNonEmptyString(
      meta.request_id ?? row.request_id,
      "request_id",
      "WMS_FE_MISSING_RECEIPT_EVIDENCE",
    ),
    traceSource: "stock_document.movements",
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
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `fe:${operation}:${uuid}`;
}

export async function fetchInboundDocuments(
  params: ListParams = {},
): Promise<InboundDocument[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.INBOUND_DOCUMENTS,
    {
      params: {
        page: params.page,
        per_page: params.per_page ?? 100,
        status: params.status || undefined,
      },
    },
  );
  const rows = rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeDocument,
  );
  const keyword = params.search?.trim().toLowerCase();
  if (!keyword) return rows;
  return rows.filter((row) =>
    [row.code, row.source, row.sourceReference]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)),
  );
}

export async function fetchInboundDetail(id: string): Promise<InboundDetail> {
  const detail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, id),
  );
  return normalizeDetail(detail);
}

export async function fetchInboundLines(documentId: string): Promise<InboundLine[]> {
  return (await fetchInboundDetail(documentId)).lines;
}

export async function fetchInboundDocument(id: string): Promise<InboundDocument> {
  return (await fetchInboundDetail(id)).document;
}

export async function createInboundDocument(
  payload: CreateInboundPayload,
): Promise<InboundDocument> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.CREATE_INBOUND,
    "create inbound document",
  );
  const result = await http.post<RawRecord>(API_ENDPOINTS.INBOUND_DOCUMENTS, payload, {
    headers: { "Idempotency-Key": makeIdempotencyKey("inbound-create") },
  });
  return normalizeDocument(result);
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
  const result = await http.patch<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, id),
    payload,
    mutationHeaders(ifMatch),
  );
  return normalizeDocument(result);
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
  const result = await http.post<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_CANCEL, id),
    { reason: requireNonEmptyString(reason, "reason") },
    mutationHeaders(ifMatch),
  );
  return normalizeDocument(result);
}

/**
 * Canonical scan endpoint requires a concrete line and If-Match. A caller may
 * supply lineId directly (preferred). The legacy fallback classifies the raw
 * code only when no line was selected.
 */
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
  const rawDetail = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_DOCUMENT, id),
  );
  const lines = rawLines(rawDetail);
  const warehouseId = requireNonEmptyString(
    rawDetail.dst_warehouse_id ?? rawDetail.warehouse_id,
    "dst_warehouse_id",
  );
  let currentVersion = options.ifMatch ?? num(rawDetail.version);
  const results: InboundScanResult[] = [];

  for (const code of normalizedCodes) {
    let line: RawRecord;
    let itemId: string | null = null;
    if (options.lineId) {
      line = findLineById(lines, options.lineId);
    } else {
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
      itemId = classification.item_id;
      line = findSingleLineForProduct(lines, productId, code);
    }

    const lineId = requireNonEmptyString(
      line.id ?? line.stock_document_line_id,
      "line_id",
    );
    const body: RawRecord = { line_id: lineId, qty: 1 };
    if (options.includeCodeValue !== false) {
      body.code_value = code;
    }
    if (itemId) body.item_id = itemId;

    const response = await http.post<RawRecord>(
      endpoint(API_ENDPOINTS.INBOUND_SCAN, id),
      body,
      mutationHeaders(currentVersion),
    );
    assertReadOnlyScanResponse(response);
    currentVersion = requirePositiveNumber(response.version, "scan.version");
    results.push({
      code_value: code,
      status: "VALID",
      sku: text(line.sku ?? line.sku_code ?? line.product_code) || undefined,
      line_id: lineId,
      message: text(response.message) || undefined,
      version: currentVersion,
    });

    const lineIndex = lines.indexOf(line);
    if (lineIndex >= 0) {
      lines[lineIndex] = {
        ...line,
        scanned_qty: num(line.scanned_qty ?? line.qty_scanned ?? 0) + 1,
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
  const idempotencyKey = requireIdempotencyKeyHeader(request.idempotencyKey)[
    "Idempotency-Key"
  ];
  const detail = await fetchInboundDetail(documentId);
  assertFullyScanned(detail);
  if (detail.document.version !== request.ifMatch) {
    throw new WmsContractError(
      "WMS_FE_VERSION_CONFLICT",
      `Inbound document changed from version ${request.ifMatch} to ${detail.document.version}; reload before posting`,
    );
  }
  const result = await http.postWithMeta<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_POST_RECEIPT, documentId),
    undefined,
    mutationHeaders(request.ifMatch, idempotencyKey),
  );
  return normalizeReceiptEvidence(result.data, result.meta);
}

/** These transition routes are not registered by the current BE m1 router. */
export async function submitInboundDocument(): Promise<InboundDocument> {
  throw new WmsContractError(
    "WMS_FE_ROUTE_NOT_REGISTERED",
    "POST /inbound-documents/:id/submit is not registered by BE m1",
  );
}

export async function approveInboundDocument(): Promise<InboundDocument> {
  throw new WmsContractError(
    "WMS_FE_ROUTE_NOT_REGISTERED",
    "POST /inbound-documents/:id/approve is not registered by BE m1",
  );
}

export async function rejectInboundDocument(): Promise<InboundDocument> {
  throw new WmsContractError(
    "WMS_FE_ROUTE_NOT_REGISTERED",
    "POST /inbound-documents/:id/reject is not registered by BE m1",
  );
}

export async function closeInboundRemainder(): Promise<InboundDocument> {
  throw new WmsContractError(
    "WMS_FE_ROUTE_NOT_REGISTERED",
    "POST /inbound-documents/:id/close-remainder is not registered; receipt is full-post only",
  );
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
    mutationHeaders(ifMatch, requireNonEmptyString(idempotencyKey, "Idempotency-Key")),
  );
}
