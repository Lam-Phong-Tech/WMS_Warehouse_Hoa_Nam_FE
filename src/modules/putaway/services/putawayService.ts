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
  /** BE gắn cờ này khi response là replay của một lần đã commit (DEC-PTW-RETRY-001). */
  replayed?: boolean;
  /** Chỉ xuất hiện khi request rơi vào 409 nhưng phục hồi được — xem recoverPutawayConflict. */
  recovery?: PutawayRecovery;
}

export type PutawayRecoveryOutcome =
  | "ALREADY_APPLIED_BY_CALLER"
  | "ALREADY_APPLIED_BY_OTHER"
  | "FINALIZED_DIFFERENT_OUTCOME";

/**
 * WWHN-193 · DEC-PTW-RETRY-001 — ngữ nghĩa phục hồi BE trả kèm 409 STATE_CONFLICT khi
 * request không mang Idempotency-Key.
 */
export interface PutawayRecovery {
  contract: string;
  outcome: PutawayRecoveryOutcome;
  applied_by_caller: boolean;
  safe_to_treat_as_success: boolean;
  next_action: "RELOAD_AND_CONTINUE" | "RELOAD_AND_REVIEW";
}

function endpoint(template: string, id: string) {
  return template.replace(":id", id);
}

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function isPutawayTrayUsable(tray: TrayOption): boolean {
  const type = normalized(tray.container_type);
  const status = normalized(tray.status);
  return (
    (type === "" || type === "TRAY") && !["CLOSED", "ISSUED"].includes(status)
  );
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
    (tray) =>
      isPutawayTrayUsable(tray) && normalized(tray.container_code) === code,
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

function assertStockNeutral<
  T extends { stock_effect?: unknown; movement_created?: unknown },
>(result: T, operation: string): T {
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
  const rows = await http.get<PutawayHistory[]>(API_ENDPOINTS.PUTAWAY_HISTORY, {
    params,
  });
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
  const result = await http.post<PutawayEvent>(
    API_ENDPOINTS.PUTAWAY_TASKS,
    payload,
  );
  return assertStockNeutral(result, "Create Putaway DRAFT");
}

/**
 * WWHN-193 · DEC-PTW-RETRY-001 — khoá idempotency suy diễn (deterministic), không random.
 *
 * Khoá phải GIỐNG NHAU giữa các lần gửi lại của cùng một thao tác logic thì BE mới replay
 * được kết quả cũ sau khi client mất response (timeout/đóng tab/proxy cắt). Vì thế khoá
 * bám vào (operation, id, version đang cầm trên màn hình) chứ không phải một uuid mới mỗi
 * lần bấm: cùng version = cùng ý định = cùng khoá; version đổi nghĩa là thao tác khác.
 */
export function putawayIdempotencyKey(
  operation: "confirm" | "cancel",
  id: string,
  version: number,
): string {
  return `ptw-${operation}-${id}-v${version}`;
}

/**
 * Đọc khối recovery từ body lỗi, chấp nhận cả hai hình dạng envelope BE đang dùng
 * (`error.details` lồng và `errors` phẳng) và cả hai nguồn lỗi của tầng http
 * (`ApiEnvelopeError.data` và `AxiosError.response.data`).
 */
function readRecovery(
  error: unknown,
): { recovery: PutawayRecovery; details: Record<string, unknown> } | null {
  if (typeof error !== "object" || error === null) return null;

  const container = error as Record<string, unknown>;
  const response = container.response as Record<string, unknown> | undefined;
  const body = (container.data ?? response?.data) as
    | Record<string, unknown>
    | undefined;
  if (!body) return null;

  const errorNode = body.error as Record<string, unknown> | undefined;
  const code =
    (body.error_code as string | undefined) ??
    (errorNode?.code as string | undefined);
  if (code !== "STATE_CONFLICT") return null;

  const details =
    (errorNode?.details as Record<string, unknown> | undefined) ??
    (body.errors as Record<string, unknown> | undefined);
  const recovery = details?.recovery as PutawayRecovery | undefined;
  if (!recovery || typeof recovery.outcome !== "string") return null;

  return { recovery, details: details ?? {} };
}

/**
 * Biến 409 "phục hồi được" thành kết quả thành công đã-được-đánh-dấu.
 *
 * Chỉ nhận khi BE khẳng định `safe_to_treat_as_success` — tức tác vụ NÀY đã đạt đúng trạng
 * thái mà thao tác hướng tới. `FINALIZED_DIFFERENT_OUTCOME` (ví dụ bấm Hủy trên một task đã
 * CONFIRMED) vẫn ném lỗi để người dùng đọc lại tình hình, đúng `next_action`.
 */
function recoverPutawayConflict(
  error: unknown,
  id: string,
  operation: "confirm" | "cancel",
): PutawayEvent {
  const parsed = readRecovery(error);
  if (!parsed?.recovery.safe_to_treat_as_success) {
    throw error;
  }
  const { recovery, details } = parsed;

  return {
    id,
    box_container_id: String(details?.box_container_id ?? ""),
    to_tray_id: String(details?.to_tray_id ?? ""),
    status: (operation === "confirm" ? "CONFIRMED" : "CANCELLED") as
      | "CONFIRMED"
      | "CANCELLED",
    version: Number(details?.current_version ?? 0),
    stock_effect: "NONE",
    movement_created: false,
    replayed: true,
    recovery,
  };
}

export async function confirmPutawayTask(
  id: string,
  version: number,
): Promise<PutawayEvent> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.PUTAWAY_CONTAINER,
    "confirm putaway",
  );
  try {
    const result = await http.post<PutawayEvent>(
      endpoint(API_ENDPOINTS.PUTAWAY_CONFIRM, id),
      undefined,
      {
        headers: {
          "If-Match": String(version),
          "Idempotency-Key": putawayIdempotencyKey("confirm", id, version),
        },
      },
    );
    return assertStockNeutral(result, "Confirm Putaway");
  } catch (error) {
    return recoverPutawayConflict(error, id, "confirm");
  }
}

export async function cancelPutawayTask(
  id: string,
  version: number,
): Promise<PutawayEvent> {
  assertWmsActionPermission(
    WMS_ACTION_PERMISSIONS.PUTAWAY_CONTAINER,
    "cancel putaway draft",
  );
  try {
    const result = await http.post<PutawayEvent>(
      endpoint(API_ENDPOINTS.PUTAWAY_CANCEL, id),
      undefined,
      {
        headers: {
          "If-Match": String(version),
          "Idempotency-Key": putawayIdempotencyKey("cancel", id, version),
        },
      },
    );
    return assertStockNeutral(result, "Cancel Putaway DRAFT");
  } catch (error) {
    return recoverPutawayConflict(error, id, "cancel");
  }
}
