import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";

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
function endpoint(template: string, id: string) { return template.replace(":id", id); }
export async function fetchPutawayTasks(params: Record<string, unknown> = {}): Promise<PutawayTask[]> {
  return http.get<PutawayTask[]>(API_ENDPOINTS.PUTAWAY_TASKS, { params });
}
export async function fetchPutawayHistory(params: Record<string, unknown> = {}): Promise<PutawayHistory[]> {
  return http.get<PutawayHistory[]>(API_ENDPOINTS.PUTAWAY_HISTORY, { params });
}
export async function fetchPutawayTrays(): Promise<TrayOption[]> {
  const result = await http.getPage<TrayOption[]>(API_ENDPOINTS.CONTAINERS, {
    params: { container_type: "TRAY", per_page: 200 },
  });
  return result.data.filter((tray) => !["CLOSED", "ISSUED"].includes(String(tray.status).toUpperCase()));
}
export function createPutawayTask(payload: { box_container_id: string; to_tray_id: string; location_hint?: string | null; note?: string | null }) {
  return http.post<PutawayEvent>(API_ENDPOINTS.PUTAWAY_TASKS, payload);
}
export function confirmPutawayTask(id: string, version: number) {
  return http.post<PutawayEvent>(endpoint(API_ENDPOINTS.PUTAWAY_CONFIRM, id), undefined, { headers: { "If-Match": String(version) } });
}
export function cancelPutawayTask(id: string, version: number) {
  return http.post<PutawayEvent>(endpoint(API_ENDPOINTS.PUTAWAY_CANCEL, id), undefined, { headers: { "If-Match": String(version) } });
}
