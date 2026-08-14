import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import {
  requireIdempotencyKeyHeader,
  requireNonEmptyString,
  requirePositiveNumber,
  WmsContractError,
} from "@/shared/api/wms-contract";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";

type RawRecord = Record<string, unknown>;

export type ComponentIssueStatus =
  | "DRAFT"
  | "SCANNING"
  | "POSTED"
  | "CANCELLED";

export type ComponentIssueItem = {
  id: string;
  item_id?: string;
  container_id?: string;
  quantity: number;
  status: "ACTIVE" | "REMOVED" | "POSTED";
};

export type ComponentIssueLine = {
  id: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  required_qty: number;
  scanned_qty: number;
  note?: string;
  items: ComponentIssueItem[];
};

export type ComponentIssueListParams = {
  warranty_case_id?: string;
  status?: ComponentIssueStatus | string;
  keyword?: string;
  page?: number;
  per_page?: number;
};

export type ComponentIssuePage = {
  data: ComponentIssueDocument[];
  meta?: Record<string, unknown>;
};

export type ComponentIssueDocument = {
  id: string;
  component_issue_no: string;
  warehouse_id: string;
  warranty_case_id: string;
  document_date: string;
  purpose: "WARRANTY";
  status: ComponentIssueStatus;
  note?: string;
  cancel_reason?: string;
  posted_at?: string;
  version: number;
  lines: ComponentIssueLine[];
};

export type ComponentIssueCreateRequest = {
  warehouse_id: string;
  warranty_case_id: string;
  document_date: string;
  note?: string;
  lines: Array<{ sku_id: string; required_qty: number; note?: string }>;
};

function endpoint(template: string, id: string): string {
  return template.replace(":id", id);
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value)
    ? value
    : Array.isArray(value.data)
      ? value.data
      : [];
}

function normalizeItem(row: RawRecord): ComponentIssueItem {
  return {
    id: text(row.id),
    item_id: text(row.item_id) || undefined,
    container_id: text(row.container_id) || undefined,
    quantity: num(row.quantity),
    status: text(row.status, "ACTIVE") as ComponentIssueItem["status"],
  };
}

function normalizeLine(row: RawRecord): ComponentIssueLine {
  return {
    id: text(row.id),
    sku_id: text(row.sku_id),
    sku_code: text(row.sku_code),
    sku_name: text(row.sku_name, "-"),
    required_qty: num(row.required_qty),
    scanned_qty: num(row.scanned_qty),
    note: text(row.note) || undefined,
    items: rowsOf(
      (row.items ?? []) as RawRecord[] | { data?: RawRecord[] },
    ).map(normalizeItem),
  };
}

function normalizeDocument(row: RawRecord): ComponentIssueDocument {
  const document = (
    row.document && typeof row.document === "object" ? row.document : row
  ) as RawRecord;
  const rawLines = rowsOf(
    (row.lines ?? document.lines ?? []) as RawRecord[] | { data?: RawRecord[] },
  );
  return {
    id: text(document.id),
    component_issue_no: text(document.component_issue_no),
    warehouse_id: text(document.warehouse_id),
    warranty_case_id: text(document.warranty_case_id),
    document_date: text(document.document_date),
    purpose: "WARRANTY",
    status: text(document.status, "DRAFT") as ComponentIssueStatus,
    note: text(document.note) || undefined,
    cancel_reason: text(document.cancel_reason) || undefined,
    posted_at: text(document.posted_at) || undefined,
    version: num(document.version) || 1,
    lines: rawLines.map(normalizeLine),
  };
}

function assertNeutral(row: RawRecord, action: string): void {
  if (row.stock_effect !== undefined && row.stock_effect !== "NONE") {
    throw new WmsContractError(
      "WMS_FE_INVALID_COMPONENT_ISSUE_RESPONSE",
      `${action} must be stock-neutral before Post`,
    );
  }
  if (row.movement_created !== undefined && row.movement_created !== false) {
    throw new WmsContractError(
      "WMS_FE_INVALID_COMPONENT_ISSUE_RESPONSE",
      `${action} must not create stock movement`,
    );
  }
}

function mutationConfig(ifMatch: number, idempotencyKey?: string) {
  const version = requirePositiveNumber(ifMatch, "If-Match");
  return {
    headers: {
      "If-Match": String(version),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
  };
}

export async function fetchComponentIssueDocuments(
  params: ComponentIssueListParams = {},
): Promise<ComponentIssuePage> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.WARRANTY_COMPONENT_ISSUE,
    "view component issues",
  );
  const cleaned = Object.fromEntries(
    Object.entries({
      warranty_case_id: params.warranty_case_id,
      status: params.status,
      keyword: params.keyword,
      page: params.page,
      per_page: params.per_page ?? 15,
    }).filter(([, value]) => value !== undefined && value !== ""),
  );
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.COMPONENT_ISSUE_DOCUMENTS,
    { params: cleaned },
  );
  return {
    data: rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
      normalizeDocument,
    ),
    meta: result.meta as Record<string, unknown> | undefined,
  };
}

export async function fetchComponentIssueDocument(
  id: string,
): Promise<ComponentIssueDocument> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.WARRANTY_COMPONENT_ISSUE,
    "view component issue detail",
  );
  const row = await http.get<RawRecord>(
    endpoint(
      API_ENDPOINTS.COMPONENT_ISSUE_DOCUMENT,
      requireNonEmptyString(id, "id"),
    ),
  );
  return normalizeDocument(row);
}

export async function createComponentIssue(
  payload: ComponentIssueCreateRequest,
): Promise<ComponentIssueDocument> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.WARRANTY_COMPONENT_ISSUE,
    "create component issue",
  );
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    throw new WmsContractError(
      "WMS_FE_COMPONENT_LINES_REQUIRED",
      "Component Issue requires at least one line",
    );
  }
  const lines = payload.lines.map((line) => ({
    sku_id: requireNonEmptyString(line.sku_id, "sku_id"),
    required_qty: requirePositiveNumber(line.required_qty, "required_qty"),
    note: line.note?.trim() || undefined,
  }));
  const row = await http.post<RawRecord>(
    API_ENDPOINTS.COMPONENT_ISSUE_DOCUMENTS,
    {
      warehouse_id: requireNonEmptyString(payload.warehouse_id, "warehouse_id"),
      warranty_case_id: requireNonEmptyString(
        payload.warranty_case_id,
        "warranty_case_id",
      ),
      document_date: requireNonEmptyString(
        payload.document_date,
        "document_date",
      ),
      purpose: "WARRANTY",
      note: payload.note?.trim() || undefined,
      lines,
    },
  );
  assertNeutral(row, "Component Issue creation");
  return normalizeDocument(row);
}

export async function scanComponentIssue(input: {
  documentId: string;
  lineId: string;
  codeValue: string;
  quantity: number;
  ifMatch: number;
}): Promise<{
  version: number;
  scanned_qty: number;
  status: ComponentIssueStatus;
}> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.WARRANTY_COMPONENT_ISSUE,
    "scan component issue",
  );
  const row = await http.post<RawRecord>(
    endpoint(
      API_ENDPOINTS.COMPONENT_ISSUE_SCAN,
      requireNonEmptyString(input.documentId, "documentId"),
    ),
    {
      line_id: requireNonEmptyString(input.lineId, "lineId"),
      code_value: requireNonEmptyString(input.codeValue, "codeValue"),
      quantity: requirePositiveNumber(input.quantity, "quantity"),
    },
    mutationConfig(input.ifMatch),
  );
  assertNeutral(row, "Component Issue scan");
  return {
    version: requirePositiveNumber(row.version, "version"),
    scanned_qty: num(row.scanned_qty),
    status: text(row.status, "SCANNING") as ComponentIssueStatus,
  };
}

export async function cancelComponentIssue(input: {
  documentId: string;
  reason: string;
  ifMatch: number;
}): Promise<{ version: number; status: ComponentIssueStatus }> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.WARRANTY_COMPONENT_ISSUE,
    "cancel component issue",
  );
  const row = await http.post<RawRecord>(
    endpoint(
      API_ENDPOINTS.COMPONENT_ISSUE_CANCEL,
      requireNonEmptyString(input.documentId, "documentId"),
    ),
    { reason: requireNonEmptyString(input.reason, "reason") },
    mutationConfig(input.ifMatch),
  );
  assertNeutral(row, "Component Issue cancel");
  return {
    version: requirePositiveNumber(row.version, "version"),
    status: text(row.status, "CANCELLED") as ComponentIssueStatus,
  };
}

export async function postComponentIssue(input: {
  documentId: string;
  ifMatch: number;
  idempotencyKey: string;
}): Promise<{
  version: number;
  status: ComponentIssueStatus;
  movement_ids: string[];
}> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.WARRANTY_COMPONENT_ISSUE,
    "post component issue",
  );
  const key = requireIdempotencyKeyHeader(input.idempotencyKey)[
    "Idempotency-Key"
  ];
  const row = await http.post<RawRecord>(
    endpoint(
      API_ENDPOINTS.COMPONENT_ISSUE_POST,
      requireNonEmptyString(input.documentId, "documentId"),
    ),
    undefined,
    mutationConfig(input.ifMatch, key),
  );
  if (row.stock_effect !== undefined && row.stock_effect !== "DECREASE") {
    throw new WmsContractError(
      "WMS_FE_INVALID_COMPONENT_POST_RESPONSE",
      "Component Issue Post must decrease stock",
    );
  }
  const movements = rowsOf(
    (row.movement_ids ?? []) as string[] | { data?: string[] },
  ).map(String);
  if (movements.length === 0) {
    throw new WmsContractError(
      "WMS_FE_MISSING_COMPONENT_MOVEMENT",
      "Component Issue Post must return movement_ids",
    );
  }
  return {
    version: requirePositiveNumber(row.version, "version"),
    status: text(row.status, "POSTED") as ComponentIssueStatus,
    movement_ids: movements,
  };
}
