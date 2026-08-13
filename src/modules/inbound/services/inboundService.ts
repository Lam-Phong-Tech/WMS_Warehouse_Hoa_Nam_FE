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
type RawRecord = Record<string, unknown>;
type ScanOptions = {
  lineId?: string;
  ifMatch?: number;
  includeCodeValue?: boolean;
  quantity?: number;
  containerId?: string;
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
    source: text(
      row.source_name ?? row.supplier_name ?? row.source ?? row.note,
      "-",
    ),
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
function findSingleLineForProduct(
  lines: RawRecord[],
  productId: string,
  code: string,
): RawRecord {
  const candidates = lines.filter((line) => {
    if (text(line.product_id ?? line.sku_id) !== productId) return false;
    return (
      num(line.qty_planned ?? line.qty_expected ?? line.quantity) >
      num(line.scanned_qty ?? line.qty_scanned ?? 0)
    );
  });
  if (candidates.length === 0) {
    throw new WmsContractError(
      "WMS_FE_SCAN_LINE_NOT_FOUND",
      `No remaining inbound line matches ${code}`,
    );
  }
  if (candidates.length > 1) {
    throw new WmsContractError(
      "WMS_FE_SCAN_LINE_AMBIGUOUS",
      `Multiple inbound lines match ${code}; choose a line first`,
    );
  }
  return candidates[0];
}
function findLineById(lines: RawRecord[], lineId: string): RawRecord {
  const line = lines.find(
    (candidate) =>
      text(candidate.id ?? candidate.stock_document_line_id) === lineId,
  );
  if (!line) {
    throw new WmsContractError(
      "WMS_FE_SCAN_LINE_NOT_FOUND",
      "Selected inbound line no longer exists",
    );
  }
  return line;
}
function assertFullyScanned(detail: InboundDetail): void {
  if (detail.lines.length === 0) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_LINES",
      "Inbound document must contain lines",
    );
  }
  if (detail.lines.some((line) => line.scanned !== line.expected)) {
    throw new WmsContractError(
      "WMS_FE_POST_REQUIRES_FULL_SCAN",
      "Every inbound line must be fully scanned before Post Receipt",
    );
  }
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
  const raw = row.movement_ids ?? row.movements ?? [];
  const movementList: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === "object" &&
        raw !== null &&
        Array.isArray((raw as { data?: unknown[] }).data)
      ? (raw as { data: unknown[] }).data
      : [];
  const movementRefs = movementList
    .map((movement) =>
      typeof movement === "string"
        ? movement
        : text(
            (movement as RawRecord)?.id ??
              (movement as RawRecord)?.stock_movement_id ??
              (movement as RawRecord)?.movement_id ??
              (movement as RawRecord)?.movement_no,
          ),
    )
    .filter(Boolean);
  if (movementRefs.length === 0) {
    throw new WmsContractError(
      "WMS_FE_MISSING_RECEIPT_EVIDENCE",
      "Post Receipt response must include movement_ids",
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
    const planned = num(line.qty_planned ?? line.qty_expected ?? line.quantity);
    const alreadyScanned = num(line.scanned_qty ?? line.qty_scanned ?? 0);
    const quantity = options.quantity ?? 1;
    if (
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      alreadyScanned + quantity > planned
    ) {
      throw new WmsContractError(
        "WMS_FE_INVALID_SCAN_QUANTITY",
        "Scan quantity must be a positive integer within the remaining planned quantity",
      );
    }
    const body: RawRecord = { line_id: lineId, qty: quantity };
    if (options.includeCodeValue !== false) body.code_value = code;
    if (itemId) body.item_id = itemId;
    if (options.containerId) body.container_id = options.containerId;

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

    const index = lines.indexOf(line);
    if (index >= 0) {
      lines[index] = { ...line, scanned_qty: alreadyScanned + quantity };
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
      `Inbound version changed from ${request.ifMatch} to ${detail.document.version}`,
    );
  }
  const result = await http.postWithMeta<RawRecord>(
    endpoint(API_ENDPOINTS.INBOUND_POST_RECEIPT, documentId),
    undefined,
    mutationHeaders(request.ifMatch, idempotencyKey),
  );
  return normalizeReceiptEvidence(result.data, result.meta);
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
