import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";

type RawRecord = Record<string, unknown>;

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value) ? value : Array.isArray(value.data) ? value.data : [];
}

function clean(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== undefined),
  );
}

export async function fetchStocktakeSessions(
  params: Record<string, unknown> = {},
): Promise<RawRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.STOCKTAKE_SESSIONS,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] });
}

export async function fetchInventorySnapshots(
  params: Record<string, unknown> = {},
): Promise<RawRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.INVENTORY_SNAPSHOTS,
    { params: clean(params) },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] });
}
