import { useWarehouseDirectory } from "@/shared/data/reference-queries";
import { useAuthStore } from "@/shared/store/auth.store";
import { VuexyDemoIcon } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { resolveReportWarehouse } from "./report-warehouse";
import "./report-warehouse-card.css";

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
