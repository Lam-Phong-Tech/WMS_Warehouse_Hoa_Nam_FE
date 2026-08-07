import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import {
  requireNonEmptyString,
  WmsContractError,
} from "@/shared/api/wms-contract";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import type {
  CreateWarrantyCaseRequest,
  UpdateWarrantyStatusRequest,
  WarrantyCase,
  WarrantyEvent,
} from "../types";

type RawRecord = Record<string, unknown>;

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value)
    ? value
    : Array.isArray(value.data)
      ? value.data
      : [];
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

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeWarrantyCase(row: RawRecord): WarrantyCase {
  const temporaryCode =
    text(row.temporary_item_code ?? row.temp_item_code) || undefined;
  const missingReason =
    text(row.missing_code_reason ?? row.temp_only_reason) || undefined;
  const identificationType =
    text(row.identification_type ?? row.identification_status) === "TEMP_ONLY" ||
    temporaryCode ||
    missingReason
      ? "TEMP_ONLY"
      : "IDENTIFIED";

  return {
    id: text(row.warranty_case_id ?? row.id),
    case_code: text(
      row.case_code ?? row.warranty_case_no ?? row.code ?? row.doc_no,
    ),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    item_code: text(row.item_code ?? row.item_id) || undefined,
    physical_code: text(row.physical_code) || undefined,
    temporary_item_code: temporaryCode,
    identification_type: identificationType,
    serial_number: text(row.serial_number ?? row.serial) || undefined,
    customer_name: text(row.customer_name ?? row.customer, "-"),
    customer_phone: text(row.customer_phone) || undefined,
    masked_customer_name: text(row.masked_customer_name) || undefined,
    masked_customer_phone: text(row.masked_customer_phone) || undefined,
    agency_name: text(row.agency_name ?? row.agency) || undefined,
    defect: text(row.defect ?? row.defect_description, "-"),
    defect_code: text(row.defect_code),
    status: (text(row.status) as WarrantyCase["status"]) || "OPEN",
    priority: text(row.priority, "MEDIUM") as WarrantyCase["priority"],
    missing_code_reason: missingReason,
    manual_product_description:
      text(row.manual_product_description ?? row.product_description) ||
      undefined,
    item_status: text(row.item_status) || undefined,
    warehouse_name: text(row.warehouse_name ?? row.scope_name) || undefined,
    received_at: text(row.received_at ?? row.created_at),
    expected_return_at: text(row.expected_return_at) || undefined,
    returned_at: text(row.returned_at) || undefined,
    case_age_days: numberOrUndefined(row.case_age_days ?? row.age_days),
    created_at: text(row.created_at),
    created_by: text(row.created_by_name ?? row.created_by, "-"),
    notes: text(row.notes) || undefined,
  };
}

function normalizeWarrantyEvent(row: RawRecord): WarrantyEvent {
  return {
    id: text(row.warranty_event_id ?? row.id),
    case_id: text(row.warranty_case_id ?? row.case_id),
    event_type:
      (text(row.event_type) as WarrantyEvent["event_type"]) || "STATUS_CHANGE",
    from_status:
      (text(row.from_status) as WarrantyCase["status"]) || undefined,
    to_status: text(row.to_status ?? row.status) as WarrantyCase["status"],
    description: text(row.description ?? row.note ?? row.message, "-"),
    performed_by: text(
      row.performed_by_name ?? row.performed_by ?? row.created_by,
      "-",
    ),
    performed_at: text(row.performed_at ?? row.event_at ?? row.created_at),
  };
}

function unsupportedMutation(action: string): never {
  throw new WmsContractError(
    "WMS_FE_CONTRACT_NOT_APPROVED",
    `${action} is blocked because exact BE v1.7 exposes no matching mutation route. WWHN-180 must reconcile and independently approve the canonical warranty contract before FE sends this request.`,
  );
}

export async function fetchWarrantyCases(
  params: Record<string, unknown> = {},
): Promise<WarrantyCase[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.WARRANTY_CASES,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeWarrantyCase,
  );
}

export async function fetchWarrantyCaseEvents(
  caseId: string | number,
  params: Record<string, unknown> = {},
): Promise<WarrantyEvent[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.WARRANTY_CASE_EVENTS.replace(":caseId", String(caseId)),
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeWarrantyEvent,
  );
}

/**
 * Exact BE v1.7 has no POST /warranty/cases create route. TEMP_ONLY is a
 * transition of an existing warranty case and has a different request schema.
 * Do not send the legacy create payload to a read-only endpoint.
 */
export async function createWarrantyCase(
  payload: CreateWarrantyCaseRequest,
): Promise<WarrantyCase> {
  if (payload.identification_type === "IDENTIFIED") {
    requireNonEmptyString(payload.item_code, "item_code");
  } else {
    assertWmsActionPermission(
      WMS_ACTION_PERMISSIONS.WARRANTY_TEMP_ONLY,
      "create TEMP_ONLY warranty case",
    );
    requireNonEmptyString(payload.missing_code_reason, "missing_code_reason");
    requireNonEmptyString(
      payload.manual_product_description,
      "manual_product_description",
    );
  }
  return unsupportedMutation("Warranty case creation");
}

/** Exact BE v1.7 exposes no generic PATCH status route. */
export async function updateWarrantyCaseStatus(
  caseId: string | number,
  request: UpdateWarrantyStatusRequest,
): Promise<WarrantyCase> {
  requireNonEmptyString(String(caseId), "caseId");
  requireNonEmptyString(request.status, "status");
  requireNonEmptyString(
    request.idempotency_key,
    "idempotency_key",
    "WMS_FE_IDEMPOTENCY_KEY_REQUIRED",
  );
  return unsupportedMutation("Warranty status update");
}

/**
 * Exact BE v1.7 exposes a paginated list plus events, but no GET detail route.
 * Read pages until the selected primary key is found instead of calling the
 * legacy /warranty/cases/:id path and generating a false 404 in QA evidence.
 */
export async function fetchWarrantyCase(
  caseId: string | number,
): Promise<WarrantyCase> {
  const normalizedCaseId = requireNonEmptyString(String(caseId), "caseId");
  let page = 1;
  let lastPage = 1;

  do {
    const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
      API_ENDPOINTS.WARRANTY_CASES,
      { params: { page, per_page: 100 } },
    );
    const row = rowsOf(
      result.data as RawRecord[] | { data?: RawRecord[] },
    ).find(
      (candidate) =>
        text(candidate.warranty_case_id ?? candidate.id) === normalizedCaseId,
    );
    if (row) return normalizeWarrantyCase(row);
    lastPage = Math.max(1, Number(result.meta.last_page ?? 1));
    page += 1;
  } while (page <= lastPage);

  throw new WmsContractError(
    "WMS_WARRANTY_CASE_NOT_FOUND",
    `Warranty case ${normalizedCaseId} was not found in the exact v1.7 list source`,
  );
}
