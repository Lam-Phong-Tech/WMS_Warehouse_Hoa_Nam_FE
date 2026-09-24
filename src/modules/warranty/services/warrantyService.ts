import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import { requireNonEmptyString, WmsContractError } from "@/shared/api/wms-contract";
import {
  nullableApiNumber,
  optionalApiState,
  requiredApiIdentity,
  requiredApiNumber,
  requiredApiRows,
  requiredApiState,
  requiredApiVersion,
} from "@/shared/api/api-read-values";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { maskWarrantyAddress, maskWarrantyName, maskWarrantyPhone } from "../constants";
import type {
  CreateWarrantyCaseRequest,
  UpdateWarrantyCaseRequest,
  WarrantyAttachment,
  WarrantyAttachmentType,
  WarrantyCase,
  WarrantyCasePage,
  WarrantyCaseStatus,
  WarrantyEvent,
  WarrantyListParams,
} from "../types";

type RawRecord = Record<string, unknown>;

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return requiredApiRows<T>(value, "warranty.rows");
}
function clean(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(
    ([, value]) => value !== "" && value !== undefined && value !== null,
  ));
}
function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}
function numberOrUndefined(value: unknown): number | undefined {
  return nullableApiNumber(value) ?? undefined;
}
function endpoint(template: string, key: string, value: string | number): string {
  return template.replace(key, String(value));
}
export function makeWarrantyIdempotencyKey(operation: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `fe:${operation}:${uuid}`;
}

/** Only documented aliases are translated; missing/unknown state is not RECEIVED. */
function canonicalStatus(value: unknown): WarrantyCaseStatus {
  const status = text(value).toUpperCase();
  switch (status) {
    case "OPEN": return "RECEIVED";
    case "PROCESSING": return "CHECKING";
    case "WAITING_PARTS": return "REPAIRING";
    case "READY": return "COMPLETED";
    case "RETURNED_TO_CUSTOMER":
    case "CLOSED": return "RETURNED";
    default:
      return requiredApiState(status, [
        "RECEIVED", "CHECKING", "REPAIRING", "COMPLETED", "RETURNED", "CANCELLED",
      ] as const, "warranty.status");
  }
}

/** §13.8 / WWHN-247: keep the existing permission-based, idempotent PII masking. */
function resolveWarrantyPii(row: RawRecord): {
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  pii_masked: boolean;
} {
  const authState = useAuthStore.getState();
  const canViewPii = hasAnyWmsPermission(
    authState.permissionCodes, [P.WARRANTY_PII_VIEW], authState.isSuperAdmin,
  );
  const full = canViewPii && row.pii_masked !== true;
  const name = text(row.customer_name ?? row.customer).trim();
  const phone = text(row.customer_phone).trim();
  const address = text(row.customer_address).trim();
  return {
    customer_name: full ? name : maskWarrantyName(name),
    customer_phone: (full ? phone : maskWarrantyPhone(phone)) || undefined,
    customer_address: (full ? address : maskWarrantyAddress(address)) || undefined,
    pii_masked: !full,
  };
}

function normalizeWarrantyCase(row: RawRecord): WarrantyCase {
  const temporaryCode = text(row.temporary_item_code ?? row.temp_item_code) || undefined;
  const missingReason = text(row.missing_code_reason ?? row.temp_only_reason) || undefined;
  const identificationType = requiredApiState(
    row.identification_type ?? row.identification_status,
    ["IDENTIFIED", "TEMP_ONLY"] as const,
    "warranty.identification_status",
  );
  const status = canonicalStatus(row.status);
  const caseDescription = text(row.description ?? row.notes) || undefined;
  const pii = resolveWarrantyPii(row);
  // GĐ1-REQ-010: preserve the documented date alias, not unrelated timestamps.
  const estimatedCompletionDate =
    text(row.estimated_completion_date ?? row.expected_completion_date) || undefined;
  return {
    id: requiredApiIdentity(row.warranty_case_id ?? row.id, "warranty_case_id"),
    case_code: text(row.case_code ?? row.warranty_case_code ?? row.warranty_case_no ?? row.code ?? row.doc_no),
    sku: text(row.sku ?? row.sku_code ?? row.product_sku),
    sku_name: text(row.sku_name ?? row.product_name),
    item_code: text(row.item_code ?? row.serial_number) || undefined,
    item_id: text(row.item_id) || undefined,
    physical_code: text(row.physical_code) || undefined,
    temporary_item_code: temporaryCode,
    identification_type: identificationType,
    sales_trace_status: text(row.sales_trace_status) || undefined,
    serial_number: text(row.serial_number ?? row.serial) || undefined,
    customer_name: pii.customer_name,
    customer_phone: pii.customer_phone,
    customer_address: pii.customer_address,
    pii_masked: pii.pii_masked,
    purchase_date: text(row.purchase_date) || undefined,
    masked_customer_name: text(row.masked_customer_name) || undefined,
    masked_customer_phone: text(row.masked_customer_phone) || undefined,
    agency_name: text(row.agency_name ?? row.agency) || undefined,
    defect: text(row.defect_name ?? row.defect ?? row.defect_description),
    defect_code: text(row.defect_code),
    defect_id: text(row.defect_id) || undefined,
    defect_ids: Array.isArray(row.defect_ids) ? row.defect_ids.map((id) => text(id)).filter(Boolean) : undefined,
    defects: Array.isArray(row.defects) ? row.defects as WarrantyCase["defects"] : undefined,
    reported_defect: text(row.reported_defect ?? row.description) || undefined,
    confirmed_defect: text(row.confirmed_defect) || undefined,
    accessories_received: text(row.accessories_received) || undefined,
    received_condition: text(row.received_condition ?? row.condition_status) || undefined,
    condition_status: text(row.condition_status) || undefined,
    cancel_reason: text(row.cancel_reason) || undefined,
    status,
    priority: optionalApiState(row.priority, ["LOW", "MEDIUM", "HIGH", "URGENT"] as const, "warranty.priority"),
    missing_code_reason: missingReason,
    manual_product_description: text(row.manual_product_description ?? row.product_description) || undefined,
    item_status: text(row.item_status) || undefined,
    warehouse_name: text(row.warehouse_name ?? row.scope_name) || undefined,
    received_at: text(row.received_at ?? row.created_at),
    expected_return_at: text(row.expected_return_at) || undefined,
    expected_completion_date: estimatedCompletionDate,
    estimated_completion_date: estimatedCompletionDate,
    completed_at: text(row.completed_at) || undefined,
    returned_at: text(row.returned_at ?? (status === "RETURNED" ? row.closed_at : undefined)) || undefined,
    case_age_days: numberOrUndefined(row.case_age_days ?? row.age_days),
    created_at: text(row.created_at),
    created_by: text(row.created_by_name, "-"),
    notes: caseDescription,
    // Read-only records may lack a version; writes validate/refetch instead of inventing one.
    version: numberOrUndefined(row.version),
  };
}

function normalizeWarrantyEvent(row: RawRecord): WarrantyEvent {
  return {
    id: requiredApiIdentity(row.warranty_event_id ?? row.id, "warranty_event_id"),
    case_id: text(row.warranty_case_id ?? row.case_id),
    event_type: requiredApiState(row.event_type, [
      "RECEIVE", "CHECK", "REPAIR", "COMPLETE", "RETURN", "CANCEL", "NOTE", "TEMP_ONLY",
      "RECEIVED", "STATUS_CHANGE", "NOTE_ADDED", "PARTS_ORDERED", "PARTS_RECEIVED",
      "TEMP_RESOLUTION", "CUSTOMER_CONTACTED", "RETURNED",
    ] as const, "warranty.event_type"),
    from_status: row.from_status ? canonicalStatus(row.from_status) : undefined,
    // A note without a transition must not claim that the case was received again.
    to_status: row.to_status == null && row.status == null
      ? undefined : canonicalStatus(row.to_status ?? row.status),
    description: text(row.description ?? row.note ?? row.message, "-"),
    performed_by: text(row.performed_by_name, "-"),
    performed_at: text(row.performed_at ?? row.event_at ?? row.created_at),
  };
}

function normalizeAttachment(row: RawRecord): WarrantyAttachment {
  return {
    id: requiredApiIdentity(row.id, "attachment_id"),
    warranty_case_id: text(row.warranty_case_id),
    file_name: text(row.file_name, "-"),
    content_type: text(row.content_type ?? row.mime_type),
    file_size_bytes: requiredApiNumber(row.file_size_bytes ?? row.file_size, "attachment.file_size_bytes"),
    checksum: text(row.checksum) || undefined,
    attachment_type: requiredApiState(row.attachment_type, ["INTAKE", "DIAGNOSTIC", "RETURN", "OTHER"] as const, "attachment.attachment_type"),
    media_kind: requiredApiState(row.media_kind, ["IMAGE", "VIDEO"] as const, "attachment.media_kind"),
    duration_seconds: nullableApiNumber(row.duration_seconds),
    status: requiredApiState(row.status, ["ACTIVE", "DELETED", "QUARANTINED"] as const, "attachment.status"),
    uploaded_at: text(row.uploaded_at ?? row.created_at) || undefined,
    uploaded_by: text(row.uploaded_by_name) || undefined,
  };
}

function assertStockNeutral(row: RawRecord, action: string): void {
  if (row.stock_effect !== undefined && row.stock_effect !== "NONE") {
    throw new WmsContractError("WMS_FE_INVALID_WARRANTY_RESPONSE", `${action} must have stock_effect=NONE`);
  }
  if (row.movement_created !== undefined && row.movement_created !== false) {
    throw new WmsContractError("WMS_FE_INVALID_WARRANTY_RESPONSE", `${action} must not create stock movement`);
  }
}
function assertWarrantyRead(action: string): void {
  assertWmsActionPermission([P.WARRANTY_VIEW, P.WARRANTY_MANAGE], action);
}
function assertWarrantyWrite(action: string): void {
  assertWmsActionPermission([P.WARRANTY_MANAGE], action);
}

export async function fetchWarrantyCases(params: WarrantyListParams = {}): Promise<WarrantyCasePage> {
  assertWarrantyRead("view warranty cases");
  const mappedParams = {
    page: params.page,
    per_page: params.per_page ?? 10,
    status: params.status ? canonicalStatus(params.status) : undefined,
    identification_status: params.identification_status,
    defect_id: params.defect_id,
    defect_ids: params.defect_ids,
    keyword: params.search ?? params.keyword,
    sort_order: params.sort_order,
  };
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(API_ENDPOINTS.WARRANTY_CASES, { params: clean(mappedParams) });
  return {
    data: rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(normalizeWarrantyCase),
    meta: result.meta as Record<string, unknown> | undefined,
  };
}
export async function fetchWarrantyCase(caseId: string | number): Promise<WarrantyCase> {
  assertWarrantyRead("view warranty case detail");
  const id = requireNonEmptyString(String(caseId), "caseId");
  return normalizeWarrantyCase(await http.get<RawRecord>(endpoint(API_ENDPOINTS.WARRANTY_CASE, ":id", id)));
}
export async function fetchWarrantyCaseEvents(caseId: string | number, params: Record<string, unknown> = {}): Promise<WarrantyEvent[]> {
  assertWarrantyRead("view warranty events");
  const id = requireNonEmptyString(String(caseId), "caseId");
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    endpoint(API_ENDPOINTS.WARRANTY_CASE_EVENTS, ":caseId", id),
    { params: clean({ ...params, per_page: params.per_page ?? 100 }) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(normalizeWarrantyEvent);
}

export async function createWarrantyCase(payload: CreateWarrantyCaseRequest): Promise<WarrantyCase> {
  assertWarrantyWrite("create warranty case");
  const description = requireNonEmptyString(payload.defect_description || payload.reported_defect || payload.notes, "defect_description");
  const body: Record<string, unknown> = {
    customer_name: requireNonEmptyString(payload.customer_name, "customer_name"),
    customer_phone: requireNonEmptyString(payload.customer_phone, "customer_phone"),
    customer_address: payload.customer_address?.trim() || undefined,
    purchase_date: payload.purchase_date || undefined,
    defect_id: payload.defect_id || undefined,
    defect_ids: payload.defect_ids,
    defect_codes: payload.defect_codes,
    estimated_completion_date: payload.estimated_completion_date ?? payload.expected_completion_date,
    defect_code: payload.defect_code || undefined,
    description,
    reported_defect: payload.reported_defect?.trim() || description,
    accessories_received: payload.accessories_received?.trim() || undefined,
    received_condition: payload.received_condition?.trim() || undefined,
  };
  if (payload.identification_type === "IDENTIFIED") {
    body.item_code = requireNonEmptyString(payload.item_code, "item_code");
  } else {
    body.missing_code_reason = requireNonEmptyString(payload.missing_code_reason, "missing_code_reason");
    body.manual_product_description = requireNonEmptyString(payload.manual_product_description, "manual_product_description");
  }
  const row = await http.post<RawRecord>(API_ENDPOINTS.WARRANTY_CASES, clean(body), {
    headers: { "Idempotency-Key": makeWarrantyIdempotencyKey("warranty-create") },
  });
  assertStockNeutral(row, "Warranty case creation");
  return normalizeWarrantyCase(row);
}

export async function updateWarrantyCase(caseId: string | number, request: UpdateWarrantyCaseRequest): Promise<WarrantyCase> {
  assertWarrantyWrite("update warranty case");
  const id = requireNonEmptyString(String(caseId), "caseId");
  const status = request.status ? canonicalStatus(request.status) : undefined;
  const current = request.ifMatch === undefined ? await fetchWarrantyCase(id) : undefined;
  const ifMatch = requiredApiVersion(request.ifMatch ?? current?.version);
  // Annex C: preserve the status endpoint, concurrency and idempotency contract.
  const row = await http.post<RawRecord>(endpoint(API_ENDPOINTS.WARRANTY_CASE_STATUS, ":id", id), clean({
    status,
    note: request.reason,
    confirmed_defect: request.confirmed_defect,
    condition_status: request.condition_status,
    received_condition: request.received_condition,
    accessories_received: request.accessories_received,
    cancel_reason: request.cancel_reason,
    defect_id: request.defect_id,
    defect_ids: request.defect_ids,
    defect_codes: request.defect_codes,
    estimated_completion_date: request.estimated_completion_date ?? request.expected_completion_date,
    customer_name: request.customer_name,
    customer_phone: request.customer_phone,
    customer_address: request.customer_address,
    purchase_date: request.purchase_date,
  }), {
    headers: {
      "If-Match": String(ifMatch),
      "Idempotency-Key": request.idempotency_key ?? makeWarrantyIdempotencyKey(`warranty-update-${id}`),
    },
  });
  assertStockNeutral(row, "Warranty status update");
  return normalizeWarrantyCase(row);
}
/** @deprecated dùng updateWarrantyCase. */
export const updateWarrantyCaseStatus = updateWarrantyCase;

export async function fetchWarrantyAttachments(caseId: string | number): Promise<WarrantyAttachment[]> {
  assertWarrantyRead("view warranty attachments");
  const id = requireNonEmptyString(String(caseId), "caseId");
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    endpoint(API_ENDPOINTS.WARRANTY_CASE_ATTACHMENTS, ":caseId", id),
    { params: { per_page: 100 } },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(normalizeAttachment);
}
export async function uploadWarrantyAttachment(input: { caseId: string; file: File; attachmentType?: WarrantyAttachmentType }): Promise<WarrantyAttachment> {
  assertWarrantyWrite("upload warranty attachment");
  const id = requireNonEmptyString(input.caseId, "caseId");
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.attachmentType) formData.append("attachment_type", input.attachmentType);
  const row = await http.post<RawRecord>(endpoint(API_ENDPOINTS.WARRANTY_CASE_ATTACHMENTS, ":caseId", id), formData);
  assertStockNeutral(row, "Warranty attachment upload");
  return normalizeAttachment(row);
}
export async function downloadWarrantyAttachment(input: { attachmentId: string; fileName?: string }): Promise<void> {
  assertWarrantyRead("download warranty attachment");
  const id = requireNonEmptyString(input.attachmentId, "attachmentId");
  const blob = await http.downloadBlob(endpoint(API_ENDPOINTS.WARRANTY_ATTACHMENT_DOWNLOAD, ":id", id));
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = input.fileName || `warranty-attachment-${id}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally { URL.revokeObjectURL(url); }
}
export async function deleteWarrantyAttachment(attachmentId: string): Promise<void> {
  assertWarrantyWrite("delete warranty attachment");
  await http.delete(endpoint(API_ENDPOINTS.WARRANTY_ATTACHMENT, ":id", requireNonEmptyString(attachmentId, "attachmentId")));
}
