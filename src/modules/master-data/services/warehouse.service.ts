import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { WmsContractError } from "@/shared/api/wms-contract";

type RawRecord = Record<string, unknown>;

export const CANONICAL_WAREHOUSE_CODE = "KHO-TONG-HN";

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

function warehouseCode(row: RawRecord) {
  return String(row.code ?? row.warehouse_code ?? "")
    .trim()
    .toUpperCase();
}

function warehouseStatus(row: RawRecord) {
  return String(row.status ?? "")
    .trim()
    .toUpperCase();
}

/**
 * The MVP operates exactly one active warehouse: KHO-TONG-HN.
 * Any ACTIVE-warehouse selector must fail closed if API data drifts from that baseline.
 */
export function assertCanonicalActiveWarehouse(rows: RawRecord[]): RawRecord[] {
  const matches = rows.filter(
    (row) =>
      warehouseCode(row) === CANONICAL_WAREHOUSE_CODE &&
      warehouseStatus(row) === "ACTIVE",
  );

  if (matches.length !== 1) {
    throw new WmsContractError(
      "WMS_FE_CANONICAL_WAREHOUSE_INVALID",
      `Expected exactly one ACTIVE warehouse with code ${CANONICAL_WAREHOUSE_CODE}, received ${matches.length}`,
    );
  }

  return matches;
}

export async function fetchWarehouses(
  params: Record<string, unknown> = {},
): Promise<RawRecord[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.WAREHOUSES,
    { params: clean(params) },
  );
  const rows = rowsOf(result.data as RawRecord[] | { data?: RawRecord[] });

  if (
    String(params.status ?? "")
      .trim()
      .toUpperCase() === "ACTIVE"
  ) {
    return assertCanonicalActiveWarehouse(rows);
  }

  return rows;
}

export async function fetchWarehouse(id: string | number): Promise<RawRecord> {
  return http.get<RawRecord>(`${API_ENDPOINTS.WAREHOUSES}/${id}`);
}

export async function updateWarehouse(
  id: string | number,
  payload: RawRecord,
): Promise<RawRecord> {
  return http.patch<RawRecord>(`${API_ENDPOINTS.WAREHOUSES}/${id}`, payload);
}
