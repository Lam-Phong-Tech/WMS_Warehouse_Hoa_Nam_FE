import { useWarehouseDirectory } from "@/shared/data/reference-queries";
import { useAuthStore } from "@/shared/store/auth.store";
import { CANONICAL_WAREHOUSE_CODE } from "@/modules/master-data/services/warehouse.service";
import { VuexyDemoIcon } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import "./report-warehouse-card.css";

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

/** The inbound report's compact, read-only warehouse card, shared by all reports. */
export function ReportWarehouseCard() {
  const t = useT();
  const context = useAuthStore((state) => state.currentContext);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  // Existing shared query: changing reports reuses the warehouse directory cache.
  const directory = useWarehouseDirectory({ enabled: authenticated });
  const { name, state } = resolveReportWarehouse(
    authenticated && Array.isArray(directory.data) ? directory.data : [],
    context,
    authenticated && !directory.isError && !directory.isPlaceholderData,
  );
  const label = t(
    state === "active"
      ? "dashboard.snapshot.warehouseActive"
      : state === "inactive"
        ? "putaway.queue.warehouseInactive"
        : "inbound.list.statusUnknown",
  );
  return (
    <div
      className="hn-report-warehouse"
      data-report-warehouse
      data-state={state}
      role="group"
      aria-label={t("updatedUi.text_19c608bfa103")}
    >
      <span className="hn-report-warehouse__icon" aria-hidden="true">
        <VuexyDemoIcon name="warehouse" />
      </span>
      <span className="hn-report-warehouse__copy">
        <strong className="hn-report-warehouse__name" title={name}>
          {name}
        </strong>
        <small className="hn-report-warehouse__status" title={label}>
          <i className="hn-report-warehouse__dot" aria-hidden="true" />
          <span>{label}</span>
        </small>
      </span>
    </div>
  );
}
