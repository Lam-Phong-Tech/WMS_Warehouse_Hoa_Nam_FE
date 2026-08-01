import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  requireArray,
  requireNonEmptyString,
  requirePositiveNumber,
} from "@/shared/api/wms-contract";
import type {
  ReversalDocument,
  ReversalLine,
  ReversibleMovement,
  ReversibleMovementLine,
  ReversalLookupParams,
  CreateReversalRequest,
  CreateReversalResponse,
} from "../types";

type RawRecord = Record<string, unknown>;

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

function num(value: unknown): number {
  return Number(value ?? 0);
}

function normalizeReversalDocument(row: RawRecord): ReversalDocument {
  return {
    id: text(row.id),
    reversal_code: text(row.reversal_code ?? row.code ?? row.doc_no),
    reversal_type:
      (text(row.reversal_type) as ReversalDocument["reversal_type"]) ||
      "MANUAL_ADJUSTMENT",
    status: (text(row.status) as ReversalDocument["status"]) || "DRAFT",
    reference_document_type: text(row.reference_document_type ?? row.ref_type),
    reference_document_code: text(row.reference_document_code ?? row.ref_code),
    reference_document_id: text(row.reference_document_id ?? row.ref_id),
    warehouse_id: num(row.warehouse_id),
    warehouse_name: text(row.warehouse_name ?? row.warehouse, "-"),
    total_lines: num(row.total_lines ?? row.line_count ?? 0),
    total_qty: num(row.total_qty ?? row.qty_total ?? 0),
    reason: text(row.reason ?? row.notes, "-"),
    reversed_at: text(row.reversed_at) || undefined,
    created_at: text(row.created_at),
    created_by: text(row.created_by_name ?? row.created_by, "-"),
    approved_by: text(row.approved_by_name ?? row.approved_by) || undefined,
    notes: text(row.notes) || undefined,
  };
}

function normalizeReversalLine(row: RawRecord): ReversalLine {
  return {
    id: text(row.id),
    reversal_id: text(row.reversal_id ?? row.reversal_document_id),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    original_qty: num(row.original_qty ?? row.qty_original),
    reversal_qty: num(row.reversal_qty ?? row.qty_reversal ?? row.quantity),
    remaining_qty: num(row.remaining_qty ?? row.qty_remaining),
    status: (text(row.status) as ReversalLine["status"]) || "PENDING",
    error_message: text(row.error_message) || undefined,
  };
}

function normalizeReversibleLine(row: RawRecord): ReversibleMovementLine {
  const reversibleQty = num(
    row.reversible_qty ?? row.qty_reversible ?? row.remaining_qty,
  );
  const guard = text(row.dependency_guard ?? row.guard_reason) || undefined;
  return {
    id: text(row.id ?? row.line_id),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    original_qty: num(row.original_qty ?? row.qty_original ?? row.quantity),
    reversed_qty: num(row.reversed_qty ?? row.qty_reversed),
    reversible_qty: reversibleQty,
    remaining_qty: num(row.remaining_qty ?? reversibleQty),
    uom: text(row.uom) || undefined,
    dependency_guard: guard,
    can_reverse: Boolean(row.can_reverse ?? (!guard && reversibleQty > 0)),
  };
}

function normalizeReversibleMovement(row: RawRecord): ReversibleMovement {
  const rawLines = Array.isArray(row.lines) ? (row.lines as RawRecord[]) : [];
  const lines = rawLines.map(normalizeReversibleLine);
  const guard = text(row.dependency_guard ?? row.guard_reason) || undefined;
  return {
    id: text(row.id ?? row.movement_id),
    movement_code: text(row.movement_code ?? row.code ?? row.doc_no),
    movement_type: text(row.movement_type ?? row.type),
    source_document_type: text(
      row.source_document_type ?? row.reference_document_type ?? row.ref_type,
    ),
    source_document_id: text(
      row.source_document_id ?? row.reference_document_id ?? row.ref_id,
    ),
    source_document_code: text(
      row.source_document_code ?? row.reference_document_code ?? row.ref_code,
    ),
    warehouse_id: num(row.warehouse_id),
    warehouse_name: text(row.warehouse_name ?? row.warehouse, "-"),
    posted_at: text(row.posted_at ?? row.created_at),
    posted_by: text(row.posted_by_name ?? row.posted_by) || undefined,
    version: text(row.version ?? row.etag ?? row._etag) || undefined,
    dependency_guard: guard,
    can_reverse: Boolean(
      row.can_reverse ?? (!guard && lines.some((line) => line.can_reverse)),
    ),
    lines,
  };
}

/**
 * GET /reversal-documents
 * Fetch reversal documents with optional filters.
 */
export async function fetchReversalDocuments(
  params: Record<string, unknown> = {},
): Promise<ReversalDocument[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.REVERSAL_DOCUMENTS,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeReversalDocument,
  );
}

/**
 * GET /reversal-documents/:id
 * Fetch a single reversal document by ID.
 */
export async function fetchReversalDocument(
  id: string | number,
): Promise<ReversalDocument> {
  return http.get<ReversalDocument>(
    API_ENDPOINTS.REVERSAL_DOCUMENT.replace(":id", String(id)),
  );
}

/**
 * GET /reversal-documents/:id/lines
 * Fetch reversal document lines.
 */
export async function fetchReversalLines(
  reversalId: string | number,
  params: Record<string, unknown> = {},
): Promise<ReversalLine[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    `${API_ENDPOINTS.REVERSAL_DOCUMENT.replace(":id", String(reversalId))}/lines`,
    { params: clean(params) },
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
 * POST /reversal-documents
 * Create a new reversal document.
 * Requires idempotency key to prevent duplicate reversal creation.
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
  }));
  return http.post<CreateReversalResponse>(
    API_ENDPOINTS.REVERSAL_CREATE,
    {
      reversal_type: request.reversal_type,
      reference_document_id: requireNonEmptyString(
        request.reference_document_id,
        "reference_document_id",
      ),
      reference_document_type: requireNonEmptyString(
        request.reference_document_type,
        "reference_document_type",
      ),
      reason: requireNonEmptyString(request.reason, "reason"),
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
