import { CANONICAL_WAREHOUSE_CODE } from "@/modules/master-data/services/warehouse.service";

type WarehouseState = "active" | "inactive" | "unknown";
type WarehouseRow = Record<string, unknown>;
const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";

/** Match the current warehouse by identity, never by array order or display name. */
export function resolveReportWarehouse(
  rows: readonly WarehouseRow[],
  context: {
    warehouse_id?: number | string | null;
    warehouse_name?: string | null;
  } | null,
  verified: boolean,
) {
  const id = text(context?.warehouse_id);
  const matches = rows.filter((row) =>
    id
      ? text(row.warehouse_id ?? row.id) === id
      : text(row.warehouse_code ?? row.code).toUpperCase() ===
        CANONICAL_WAREHOUSE_CODE,
  );
  const row = matches.length === 1 ? matches[0] : undefined;
  const name =
    text(row?.warehouse_name ?? row?.name) ||
    text(context?.warehouse_name) ||
    "—";
  const status = verified && row ? text(row.status).toUpperCase() : "";
  const state: WarehouseState =
    status === "ACTIVE"
      ? "active"
      : status === "INACTIVE"
        ? "inactive"
        : "unknown";
  return { name, state };
}
