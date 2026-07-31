import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type {
  WarrantyCase,
  WarrantyEvent,
  CreateWarrantyCaseRequest,
  UpdateWarrantyStatusRequest,
} from "../types";

type RawRecord = Record<string, unknown>;

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value) ? value : Array.isArray(value.data) ? value.data : [];
}

function clean(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== undefined),
  );
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function normalizeWarrantyCase(row: RawRecord): WarrantyCase {
  return {
    id: text(row.id),
    case_code: text(row.case_code ?? row.code ?? row.doc_no),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    serial_number: text(row.serial_number) || undefined,
    customer_name: text(row.customer_name ?? row.customer, "-"),
    customer_phone: text(row.customer_phone) || undefined,
    agency_name: text(row.agency_name ?? row.agency) || undefined,
    defect: text(row.defect ?? row.defect_description, "-"),
    defect_code: text(row.defect_code),
    status: (text(row.status) as WarrantyCase["status"]) || "OPEN",
    priority: (text(row.priority, "MEDIUM") as WarrantyCase["priority"]),
    temp_only_reason: text(row.temp_only_reason) || undefined,
    received_at: text(row.received_at ?? row.created_at),
    expected_return_at: text(row.expected_return_at) || undefined,
    returned_at: text(row.returned_at) || undefined,
    created_at: text(row.created_at),
    created_by: text(row.created_by_name ?? row.created_by, "-"),
    notes: text(row.notes) || undefined,
  };
}

function normalizeWarrantyEvent(row: RawRecord): WarrantyEvent {
  return {
    id: text(row.id),
    case_id: text(row.case_id ?? row.warranty_case_id),
    event_type: (text(row.event_type) as WarrantyEvent["event_type"]) || "STATUS_CHANGE",
    from_status: (text(row.from_status) as WarrantyCase["status"]) || undefined,
    to_status: (text(row.to_status ?? row.status) as WarrantyCase["status"]),
    description: text(row.description ?? row.message, "-"),
    performed_by: text(row.performed_by_name ?? row.performed_by, "-"),
    performed_at: text(row.performed_at ?? row.created_at),
  };
}

/**
 * GET /warranty/cases
 * Fetch warranty cases with optional filters.
 */
export async function fetchWarrantyCases(
  params: Record<string, unknown> = {},
): Promise<WarrantyCase[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.WARRANTY_CASES,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(normalizeWarrantyCase);
}

/**
 * GET /warranty/cases/:caseId/events
 * Fetch warranty case events.
 */
export async function fetchWarrantyCaseEvents(
  caseId: string | number,
  params: Record<string, unknown> = {},
): Promise<WarrantyEvent[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.WARRANTY_CASE_EVENTS.replace(":caseId", String(caseId)),
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(normalizeWarrantyEvent);
}

/**
 * POST /warranty/cases
 * Create a new warranty case.
 */
export async function createWarrantyCase(
  payload: CreateWarrantyCaseRequest,
): Promise<WarrantyCase> {
  return http.post<WarrantyCase>(API_ENDPOINTS.WARRANTY_CASES, payload);
}

/**
 * PATCH /warranty/cases/:id/status
 * Update warranty case status.
 * Supports idempotency key to prevent duplicate status transitions.
 */
export async function updateWarrantyCaseStatus(
  caseId: string | number,
  request: UpdateWarrantyStatusRequest,
): Promise<WarrantyCase> {
  return http.patch<WarrantyCase>(
    API_ENDPOINTS.WARRANTY_UPDATE_STATUS.replace(":id", String(caseId)),
    { status: request.status, reason: request.reason },
    {
      headers: {
        ...(request.idempotency_key ? { "Idempotency-Key": request.idempotency_key } : {}),
      },
    },
  );
}

/**
 * GET /warranty/cases/:id
 * Fetch a single warranty case by ID.
 */
export async function fetchWarrantyCase(
  caseId: string | number,
): Promise<WarrantyCase> {
  return http.get<WarrantyCase>(
    API_ENDPOINTS.WARRANTY_CASE.replace(":id", String(caseId)),
  );
}