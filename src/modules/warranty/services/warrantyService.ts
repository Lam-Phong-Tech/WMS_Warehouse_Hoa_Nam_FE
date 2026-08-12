import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import {
  requireNonEmptyString,
  requirePositiveNumber,
  WmsContractError,
} from "@/shared/api/wms-contract";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import type {
  CreateWarrantyCaseRequest,
  UpdateWarrantyStatusRequest,
  WarrantyCase,
  WarrantyCaseStatus,
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
      ([, value]) => value !== "" && value !== undefined && value !== null,
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

function endpoint(template: string, key: string, value: string | number): string {
  return template.replace(key, String(value));
}

function canonicalStatus(value: unknown): WarrantyCaseStatus {
  const status = text(value).toUpperCase();
  switch (status) {
    case "OPEN":
      return "RECEIVED";
    case "PROCESSING":
      return "CHECKING";
    case "WAITING_PARTS":
      return "REPAIRING";
    case "READY":
      return "COMPLETED";
    case "RETURNED_TO_CUSTOMER":
    case "CLOSED":
      return "RETURNED";
    case "RECEIVED":
    case "CHECKING":
    case "REPAIRING":
    case "COMPLETED":
    case "RETURNED":
    case "CANCELLED":
      return status;
    default:
      return "RECEIVED";
  }
}

function normalizeWarrantyCase(row: RawRecord): WarrantyCase {
  const temporaryCode =
    text(row.temporary_item_code ?? row.temp_item_code) || undefined;
  const missingReason =
    text(row.missing_code_reason ?? row.temp_only_reason) || undefined;
  const identificationType =
    text(row.identification_type ?? row.identification_status) === "TEMP_ONLY" ||
    Boolean(temporaryCode) ||
    Boolean(missingReason)
      ? "TEMP_ONLY"
      : "IDENTIFIED";
  const status = canonicalStatus(row.status);
  const caseDescription = text(row.description ?? row.notes) || undefined;

  return {
    id: text(row.warranty_case_id ?? row.id),
    case_code: text(
      row.case_code ??
        row.warranty_case_code ??
        row.warranty_case_no ??
        row.code ??
        row.doc_no,
    ),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name, "-"),
    item_code: text(row.item_code ?? row.serial_number) || undefined,
    item_id: text(row.item_id) || undefined,
    physical_code: text(row.physical_code) || undefined,
    temporary_item_code: temporaryCode,
    identification_type: identificationType,
    serial_number: text(row.serial_number ?? row.serial) || undefined,
    customer_name: text(row.customer_name ?? row.customer, "-"),
    customer_phone: text(row.customer_phone) || undefined,
    masked_customer_name: text(row.masked_customer_name) || undefined,
    masked_customer_phone: text(row.masked_customer_phone) || undefined,
    agency_name: text(row.agency_name ?? row.agency) || undefined,
    defect: text(row.defect_name ?? row.defect ?? row.defect_description, "-"),
    defect_code: text(row.defect_code),
    defect_id: text(row.defect_id) || undefined,
    status,
    priority: text(row.priority, "MEDIUM") as WarrantyCase["priority"],
    missing_code_reason: missingReason,
    manual_product_description:
      text(row.manual_product_description ?? row.product_description) ||
      undefined,
    item_status: text(row.item_status) || undefined,
    warehouse_name: text(row.warehouse_name ?? row.scope_name) || undefined,
    received_at: text(row.received_at ?? row.created_at),
    expected_return_at: text(row.expected_return_at) || undefined,
    returned_at:
      text(row.returned_at ?? (status === "RETURNED" ? row.closed_at : undefined)) ||
      undefined,
    case_age_days: numberOrUndefined(row.case_age_days ?? row.age_days),
    created_at: text(row.created_at),
    created_by: text(row.created_by_name ?? row.created_by, "-"),
    notes: caseDescription,
    version: numberOrUndefined(row.version) ?? 1,
  };
}

function normalizeWarrantyEvent(row: RawRecord): WarrantyEvent {
  return {
    id: text(row.warranty_event_id ?? row.id),
    case_id: text(row.warranty_case_id ?? row.case_id),
    event_type:
      (text(row.event_type) as WarrantyEvent["event_type"]) || "STATUS_CHANGE",
    from_status: row.from_status ? canonicalStatus(row.from_status) : undefined,
    to_status: canonicalStatus(row.to_status ?? row.status),
    description: text(row.description ?? row.note ?? row.message, "-"),
    performed_by: text(
      row.performed_by_name ?? row.performed_by ?? row.created_by,
      "-",
    ),
    performed_at: text(row.performed_at ?? row.event_at ?? row.created_at),
  };
}

function assertStockNeutral(row: RawRecord, action: string): void {
  if (row.stock_effect !== undefined && row.stock_effect !== "NONE") {
    throw new WmsContractError(
      "WMS_FE_INVALID_WARRANTY_RESPONSE",
      `${action} must have stock_effect=NONE`,
    );
  }
  if (row.movement_created !== undefined && row.movement_created !== false) {
    throw new WmsContractError(
      "WMS_FE_INVALID_WARRANTY_RESPONSE",
      `${action} must not create stock movement`,
    );
  }
}

function assertWarrantyAccess(action: string): void {
  assertWmsActionPermission([P.WARRANTY_MANAGE], action);
}

export async function fetchWarrantyCases(
  params: Record<string, unknown> = {},
): Promise<WarrantyCase[]> {
  assertWarrantyAccess("view warranty cases");
  const mappedParams = {
    page: params.page,
    per_page: params.per_page ?? 100,
    status: params.status ? canonicalStatus(params.status) : undefined,
    keyword: params.search ?? params.keyword,
  };
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.WARRANTY_CASES,
    { params: clean(mappedParams) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeWarrantyCase,
  );
}

export async function fetchWarrantyCase(
  caseId: string | number,
): Promise<WarrantyCase> {
  assertWarrantyAccess("view warranty case detail");
  const normalizedCaseId = requireNonEmptyString(String(caseId), "caseId");
  const row = await http.get<RawRecord>(
    endpoint(API_ENDPOINTS.WARRANTY_CASE, ":id", normalizedCaseId),
  );
  return normalizeWarrantyCase(row);
}

export async function fetchWarrantyCaseEvents(
  caseId: string | number,
  params: Record<string, unknown> = {},
): Promise<WarrantyEvent[]> {
  assertWarrantyAccess("view warranty events");
  const normalizedCaseId = requireNonEmptyString(String(caseId), "caseId");
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    endpoint(
      API_ENDPOINTS.WARRANTY_CASE_EVENTS,
      ":caseId",
      normalizedCaseId,
    ),
    { params: clean({ ...params, per_page: params.per_page ?? 100 }) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    normalizeWarrantyEvent,
  );
}

export async function createWarrantyCase(
  payload: CreateWarrantyCaseRequest,
): Promise<WarrantyCase> {
  assertWarrantyAccess("create warranty case");
  const description = requireNonEmptyString(
    payload.defect_description || payload.notes,
    "defect_description",
  );
  const body: Record<string, unknown> = {
    customer_name: requireNonEmptyString(payload.customer_name, "customer_name"),
    customer_phone: requireNonEmptyString(payload.customer_phone, "customer_phone"),
    defect_code: payload.defect_code || undefined,
    description,
  };

  if (payload.identification_type === "IDENTIFIED") {
    body.item_code = requireNonEmptyString(payload.item_code, "item_code");
  } else {
    body.missing_code_reason = requireNonEmptyString(
      payload.missing_code_reason,
      "missing_code_reason",
    );
    body.manual_product_description = requireNonEmptyString(
      payload.manual_product_description,
      "manual_product_description",
    );
  }

  const row = await http.post<RawRecord>(
    API_ENDPOINTS.WARRANTY_CASES,
    clean(body),
  );
  assertStockNeutral(row, "Warranty case creation");
  return normalizeWarrantyCase(row);
}

export async function updateWarrantyCaseStatus(
  caseId: string | number,
  request: UpdateWarrantyStatusRequest,
): Promise<WarrantyCase> {
  assertWarrantyAccess("update warranty case");
  const normalizedCaseId = requireNonEmptyString(String(caseId), "caseId");
  const status = canonicalStatus(
    requireNonEmptyString(request.status, "status"),
  );
  const current = request.ifMatch
    ? undefined
    : await fetchWarrantyCase(normalizedCaseId);
  const ifMatch = requirePositiveNumber(
    request.ifMatch ?? current?.version,
    "If-Match",
  );
  const row = await http.patch<RawRecord>(
    endpoint(API_ENDPOINTS.WARRANTY_CASE, ":id", normalizedCaseId),
    clean({
      status,
      description: request.reason,
    }),
    { headers: { "If-Match": String(ifMatch) } },
  );
  assertStockNeutral(row, "Warranty status update");
  return normalizeWarrantyCase(row);
}
