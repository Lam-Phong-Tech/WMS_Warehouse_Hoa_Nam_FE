import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  requireArray,
  requireNonEmptyString,
  requirePositiveNumber,
} from "@/shared/api/wms-contract";
import type { ApiMeta } from "@/shared/types/api-response";
import type {
  ReversalCancelRequest,
  ReversalConfirmRequest,
  ReversalDocument,
  ReversalLine,
  ReversalPostRequest,
  ReversibleItemCandidate,
  ReversibleMovement,
  ReversibleMovementLine,
  ReversalLookupParams,
  CreateReversalRequest,
  CreateReversalResponse,
} from "../types";

type RawRecord = Record<string, unknown>;

export type PagedResult<T> = { rows: T[]; meta: ApiMeta };

function rowsOf<T>(value: T[] | { data?: T[]; rows?: T[] }): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.rows)) return value.rows;
  return [];
}

function clean(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== undefined,
    ),
  );
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function optionalText(value: unknown): string | undefined {
  const resolved = text(value);
  return resolved === "" ? undefined : resolved;
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

/**
 * BR-REV-02: mọi lifecycle op của Reversal bắt buộc If-Match theo version hiện hành;
 * thiếu header thì BE trả 428 PRECONDITION_REQUIRED.
 */
function ifMatch(version: number): Record<string, string> {
  return { "If-Match": String(version) };
}

function normalizeReversalDocument(row: RawRecord): ReversalDocument {
  return {
    id: text(row.id),
    reversal_code: text(row.reversal_code ?? row.reversal_no ?? row.id),
    status: (text(row.status) as ReversalDocument["status"]) || "DRAFT",
    physical_return_status: optionalText(
      row.physical_return_status,
    ) as ReversalDocument["physical_return_status"],
    condition_status: optionalText(
      row.condition_status,
    ) as ReversalDocument["condition_status"],
    reference_document_type: text(row.reference_document_type),
    reference_document_code: text(
      row.reference_document_code ?? row.reference_document_id,
    ),
    reference_document_id: text(row.reference_document_id),
    correction_chain_id: optionalText(row.correction_chain_id),
    warehouse_id: text(row.warehouse_id),
    warehouse_name: text(row.warehouse_name, "-"),
    total_lines: num(row.total_lines),
    total_qty: num(row.total_qty),
    reason_code: optionalText(row.reason_code),
    reason: text(row.reason ?? row.reason_text, "-"),
    reversed_at: optionalText(row.reversed_at ?? row.posted_at),
    created_at: text(row.created_at),
    created_by: text(row.created_by_name ?? row.created_by, "-"),
    posted_by: optionalText(row.posted_by),
    cancelled_at: optionalText(row.cancelled_at),
    cancel_reason: optionalText(row.cancel_reason),
    version: num(row.version),
  };
}

function normalizeReversalLine(row: RawRecord): ReversalLine {
  return {
    id: text(row.id),
    reversal_id: text(row.reversal_id ?? row.reversal_document_id),
    line_no: num(row.line_no),
    original_movement_id: text(row.original_movement_id),
    original_movement_code: optionalText(row.original_movement_code),
    sku: text(row.sku ?? row.sku_code),
    sku_name: text(row.sku_name, "-"),
    uom: optionalText(row.uom),
    item_id: optionalText(row.item_id),
    item_code: optionalText(row.item_code),
    serial_number: optionalText(row.serial_number),
    original_qty: num(row.original_qty),
    reversal_qty: num(row.reversal_qty),
    reversed_qty: num(row.reversed_qty),
    remaining_qty: num(row.remaining_qty),
    return_condition: optionalText(
      row.return_condition,
    ) as ReversalLine["return_condition"],
    stock_status: optionalText(
      row.stock_status,
    ) as ReversalLine["stock_status"],
    posted_movement_id: optionalText(row.posted_movement_id),
    status: (text(row.status) as ReversalLine["status"]) || "DRAFT",
    reason: optionalText(row.reason),
  };
}

function normalizeItemCandidate(row: RawRecord): ReversibleItemCandidate {
  return {
    item_id: text(row.item_id),
    sku_id: text(row.sku_id),
    item_code: optionalText(row.item_code),
    serial_number: optionalText(row.serial_number),
    item_status: text(row.item_status),
  };
}

function normalizeReversibleLine(row: RawRecord): ReversibleMovementLine {
  const reversibleQty = num(row.reversible_qty ?? row.remaining_qty);
  const guard = optionalText(row.dependency_guard ?? row.guard_reason);
  return {
    id: text(row.id),
    sku: text(row.sku ?? row.sku_code),
    sku_name: text(row.sku_name, "-"),
    original_qty: num(row.original_qty ?? row.quantity),
    reversed_qty: num(row.reversed_qty),
    reversible_qty: reversibleQty,
    remaining_qty: num(row.remaining_qty ?? reversibleQty),
    uom: optionalText(row.uom),
    dependency_guard: guard,
    can_reverse: Boolean(row.can_reverse ?? (!guard && reversibleQty > 0)),
    is_serial_tracked: Boolean(row.is_serial_tracked),
    // item_scoped mới là cờ quyết định reverse theo Item (PRODUCT || serial). BE
    // cũ chưa có field này thì fallback về is_serial_tracked để không vỡ.
    item_scoped:
      row.item_scoped !== undefined
        ? Boolean(row.item_scoped)
        : Boolean(row.is_serial_tracked),
    items: Array.isArray(row.items)
      ? (row.items as RawRecord[]).map(normalizeItemCandidate)
      : [],
  };
}

function normalizeReversibleMovement(row: RawRecord): ReversibleMovement {
  const rawLines = Array.isArray(row.lines) ? (row.lines as RawRecord[]) : [];
  const lines = rawLines.map(normalizeReversibleLine);
  const guard = optionalText(row.dependency_guard ?? row.guard_reason);
  return {
    id: text(row.id),
    movement_code: text(row.movement_code),
    movement_type: text(row.movement_type),
    source_document_type: text(row.source_document_type),
    source_document_id: text(row.source_document_id),
    source_document_code: text(row.source_document_code),
    warehouse_id: text(row.warehouse_id),
    warehouse_name: text(row.warehouse_name, "-"),
    posted_at: text(row.posted_at),
    posted_by: optionalText(row.posted_by),
    version: optionalText(row.version),
    dependency_guard: guard,
    can_reverse: Boolean(
      row.can_reverse ?? (!guard && lines.some((line) => line.can_reverse)),
    ),
    lines,
  };
}

/** GET /reversal-documents */
export async function fetchReversalDocuments(
  params: Record<string, unknown> = {},
): Promise<PagedResult<ReversalDocument>> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.REVERSAL_DOCUMENTS,
    { params: clean(params) },
  );
  return {
    rows: rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
      normalizeReversalDocument,
    ),
    meta: result.meta,
  };
}

/** GET /reversal-documents/:id */
export async function fetchReversalDocument(
  id: string,
): Promise<ReversalDocument> {
  const raw = await http.get<RawRecord>(
    API_ENDPOINTS.REVERSAL_DOCUMENT.replace(":id", id),
  );
  return normalizeReversalDocument(raw);
}

/** GET /reversal-documents/:id/lines */
export async function fetchReversalLines(
  reversalId: string,
): Promise<ReversalLine[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.REVERSAL_DOCUMENT_LINES.replace(":id", reversalId),
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeReversalLine,
  );
}

export async function fetchReversibleMovements(
  params: ReversalLookupParams = {},
): Promise<ReversibleMovement[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.REVERSAL_MOVEMENT_LOOKUP,
    { params: clean(params as Record<string, unknown>) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeReversibleMovement,
  );
}

/**
 * POST /reversal-documents — BR-REV-02/12: bắt buộc Idempotency-Key và If-Match theo
 * version chứng từ gốc. FE không tự suy version: thiếu thì để BE trả 428.
 */
export async function createReversalDocument(
  request: CreateReversalRequest,
): Promise<CreateReversalResponse> {
  const lines = requireArray(request.lines, "lines").map((line, index) => ({
    sku: requireNonEmptyString(line.sku, `lines.${index}.sku`),
    reversal_qty: requirePositiveNumber(
      line.reversal_qty,
      `lines.${index}.reversal_qty`,
    ),
    ...(line.reason ? { reason: line.reason } : {}),
    // BR-REV: SKU serial-tracked bắt buộc item_id + quantity=1, nếu thiếu BE
    // trả 422 REVERSAL_ITEM_REQUIRED.
    ...(line.item_id ? { item_id: line.item_id } : {}),
  }));
  return http.post<CreateReversalResponse>(
    API_ENDPOINTS.REVERSAL_CREATE,
    {
      reference_document_id: requireNonEmptyString(
        request.reference_document_id,
        "reference_document_id",
      ),
      reference_document_type: requireNonEmptyString(
        request.reference_document_type,
        "reference_document_type",
      ),
      reason: requireNonEmptyString(request.reason, "reason"),
      ...(request.return_condition
        ? { return_condition: request.return_condition }
        : {}),
      ...(request.physical_return_confirmed !== undefined
        ? { physical_return_confirmed: request.physical_return_confirmed }
        : {}),
      lines,
    },
    {
      headers: {
        "Idempotency-Key": requireNonEmptyString(
          request.idempotency_key,
          "idempotency_key",
          "WMS_FE_IDEMPOTENCY_KEY_REQUIRED",
        ),
        ...(request.reference_version
          ? { "If-Match": request.reference_version }
          : {}),
      },
    },
  );
}

/**
 * POST /reversal-documents/:id/confirm — SRS §6 bước CONFIRMED.
 * Xác nhận hàng vật lý đã quay lại kho (BR-REV-06); stock-neutral.
 */
export async function confirmReversalDocument(
  request: ReversalConfirmRequest,
): Promise<RawRecord> {
  return http.post<RawRecord>(
    API_ENDPOINTS.REVERSAL_CONFIRM.replace(":id", request.id),
    request.return_condition
      ? { return_condition: request.return_condition }
      : {},
    { headers: ifMatch(request.version) },
  );
}

/**
 * POST /reversal-documents/:id/post — SRS §6 bước POSTED.
 * Điểm duy nhất sinh movement đối ứng; BR-REV-12 bắt buộc Idempotency-Key.
 */
export async function postReversalDocument(
  request: ReversalPostRequest,
): Promise<RawRecord> {
  return http.post<RawRecord>(
    API_ENDPOINTS.REVERSAL_POST.replace(":id", request.id),
    {},
    {
      headers: {
        ...ifMatch(request.version),
        "Idempotency-Key": requireNonEmptyString(
          request.idempotency_key,
          "idempotency_key",
          "WMS_FE_IDEMPOTENCY_KEY_REQUIRED",
        ),
      },
    },
  );
}

/**
 * POST /reversal-documents/:id/cancel — SRS §6 bước CANCELLED.
 * BR-REV-08: chỉ huỷ được DRAFT, POSTED là append-only.
 */
export async function cancelReversalDocument(
  request: ReversalCancelRequest,
): Promise<RawRecord> {
  return http.post<RawRecord>(
    API_ENDPOINTS.REVERSAL_CANCEL.replace(":id", request.id),
    { reason: requireNonEmptyString(request.reason, "reason") },
    { headers: ifMatch(request.version) },
  );
}
