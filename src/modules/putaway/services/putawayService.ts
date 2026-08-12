import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { http } from "@/shared/api/http";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import { WmsContractError } from "@/shared/api/wms-contract";

export interface PutawayTask {
  id: string;
  box_container_id: string;
  box_code: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  quantity: number;
  receipt_id?: string | null;
  receipt_code?: string | null;
  warehouse_id?: string | null;
  status: "RECEIVED_PENDING_PUTAWAY" | "STORED";
  location_hint?: string | null;
  container_version: number;
  draft_id?: string | null;
  draft_version?: number | null;
  to_tray_id?: string | null;
  to_tray_code?: string | null;
}
export interface PutawayHistory {
  id: string;
  box_code: string;
  old_tray_code?: string | null;
  new_tray_code?: string | null;
  actor_name?: string | null;
  created_at: string;
  location_hint?: string | null;
  stock_effect: "NONE";
  movement_created: false;
}
export interface TrayOption {
  container_id: string;
  container_code: string;
  container_type?: string;
  status: string;
  zone_code?: string | null;
  location_hint?: string | null;
  version: number;
}
export interface PutawayEvent {
  id: string;
  box_container_id: string;
  to_tray_id: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  version: number;
  stock_effect: "NONE";
  movement_created: false;
}

function endpoint(template: string, id: string) {
  return template.replace(":id", id);
}

function normalized(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function isPutawayTrayUsable(tray: TrayOption): boolean {
  const type = normalized(tray.container_type);
  const status = normalized(tray.status);
  return (type === "" || type === "TRAY") && !["CLOSED", "ISSUED"].includes(status);
}

/**
 * Resolve a physical TRAY scan fail-closed. A scan is accepted only when it
 * maps to exactly one usable TRAY returned by the current API dataset.
 */
export function resolvePutawayTrayByScanCode(
  trays: TrayOption[],
  rawCode: string,
): TrayOption {
  const code = normalized(rawCode);
  if (!code) {
    throw new WmsContractError(
      "WMS_FE_PUTAWAY_TRAY_SCAN_REQUIRED",
      "Vui lòng scan hoặc nhập mã Barcode/QR của TRAY.",
    );
  }

  const matches = trays.filter(
    (tray) => isPutawayTrayUsable(tray) && normalized(tray.container_code) === code,
  );

  if (matches.length === 0) {
    throw new WmsContractError(
      "WMS_FE_PUTAWAY_TRAY_NOT_FOUND",
      `Không tìm thấy TRAY khả dụng cho mã ${code}.`,
    );
  }
  if (matches.length !== 1) {
    throw new WmsContractError(
      "WMS_FE_PUTAWAY_TRAY_AMBIGUOUS",
      `Mã ${code} khớp nhiều TRAY; từ chối thao tác để tránh xếp sai vị trí.`,
    );
  }

  return matches[0];
}

function assertStockNeutral<T extends { stock_effect?: unknown; movement_created?: unknown }>(
  result: T,
  operation: string,
): T {
  if (result.stock_effect !== "NONE" || result.movement_created !== false) {
    throw new WmsContractError(
      "WMS_FE_PUTAWAY_STOCK_EFFECT_VIOLATION",
      `${operation} must be stock-neutral and must not create inventory movement`,
    );
  }
  return result;
}

export async function fetchPutawayTasks(
  params: Record<string, unknown> = {},
): Promise<PutawayTask[]> {
  return http.get<PutawayTask[]>(API_ENDPOINTS.PUTAWAY_TASKS, { params });
}

export async function fetchPutawayHistory(
  params: Record<string, unknown> = {},
): Promise<PutawayHistory[]> {
  const rows = await http.get<PutawayHistory[]>(API_ENDPOINTS.PUTAWAY_HISTORY, { params });
  rows.forEach((row) => assertStockNeutral(row, "Putaway history"));
  return rows;
}

export async function fetchPutawayTrays(): Promise<TrayOption[]> {
  const result = await http.getPage<TrayOption[]>(API_ENDPOINTS.CONTAINERS, {
    params: { container_type: "TRAY", per_page: 200 },
  });
  return result.data.filter(isPutawayTrayUsable);
}

export async function createPutawayTask(payload: {
  box_container_id: string;
  to_tray_id: string;
  location_hint?: string | null;
  note?: string | null;
}): Promise<PutawayEvent> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.PUTAWAY_CONTAINER,
    "create putaway draft",
  );
  const result = await http.post<PutawayEvent>(API_ENDPOINTS.PUTAWAY_TASKS, payload);
  return assertStockNeutral(result, "Create Putaway DRAFT");
}

export async function confirmPutawayTask(id: string, version: number): Promise<PutawayEvent> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.PUTAWAY_CONTAINER,
    "confirm putaway",
  );
  const result = await http.post<PutawayEvent>(
    endpoint(API_ENDPOINTS.PUTAWAY_CONFIRM, id),
    undefined,
    { headers: { "If-Match": String(version) } },
  );
  return assertStockNeutral(result, "Confirm Putaway");
}

export async function cancelPutawayTask(id: string, version: number): Promise<PutawayEvent> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.PUTAWAY_CONTAINER,
    "cancel putaway draft",
  );
  const result = await http.post<PutawayEvent>(
    endpoint(API_ENDPOINTS.PUTAWAY_CANCEL, id),
    undefined,
    { headers: { "If-Match": String(version) } },
  );
  return assertStockNeutral(result, "Cancel Putaway DRAFT");
}