import { useStockReconcileSnapshot } from "@/modules/reports/stock-reconcile/stock-reconcile-api";
import { DashIcon } from "../components/DashIcon";
import { fmt } from "./overview-data";
import { useT } from "@/shared/i18n/useT";
import { buildDashboardThresholds } from "./dashboard-threshold-model";
import { ROUTES } from "@/shared/constants/routes";
import "./dashboard-system-views.css";

const stockReportRoute = `${ROUTES.REPORTS_STOCK_RECONCILE}?screen=RPT-02`;

export function SnapshotThresholdSummary({
  onNavigate,
}: {
  onNavigate: (route: string) => void;
}) {
  const t = useT();
  const source = useStockReconcileSnapshot({ asOf: "" });
  const { configured, unconfigured, below, above } = buildDashboardThresholds(
    source.snapshot.rows,
    source.thresholds,
  );
  const hasCompleteSnapshot =
    Boolean(source.snapshot.as_of) && source.thresholds.size > 0;

  return (
    <article className="snapshot-card snapshot-stock snapshot-thresholds">
      <header>
        <div>
          <h2>{t("dashboard.snapshot.thresholdSummaryTitle")}</h2>
          <p className="snapshot-threshold-note">
            {t("dashboardSnapshot.thresholdNote")}
          </p>
        </div>
        <button type="button" onClick={() => onNavigate(stockReportRoute)}>
          {t("common.viewDetail")} <DashIcon name="arrow-right" />
        </button>
      </header>
      {source.error && hasCompleteSnapshot ? (
        <div className="snapshot-partial-alert" role="status">
          {t("dashboardSnapshot.thresholdStale")}{" "}
          <button type="button" onClick={() => void source.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : null}
      {source.loading ? (
        <div className="snapshot-threshold-state" role="status">
          {t("dashboardSnapshot.thresholdLoading")}
        </div>
      ) : source.error && !hasCompleteSnapshot ? (
        <div className="snapshot-threshold-state" role="alert">
          {t("dashboardSnapshot.thresholdFailed")}{" "}
          <button type="button" onClick={() => void source.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <>
          <div className="snapshot-threshold-totals">
            <div>
              <strong>{fmt(configured)}</strong>
              <span>{t("dashboardSnapshot.configuredSkus")}</span>
            </div>
            <div>
              <strong>{fmt(unconfigured)}</strong>
              <span>{t("dashboardSnapshot.unconfiguredSkus")}</span>
            </div>
          </div>
          <div className="snapshot-threshold-alerts">
            <button type="button" onClick={() => onNavigate(stockReportRoute)}>
              <span>{t("dashboardSnapshot.belowThreshold")}</span>
              <strong>{fmt(below)}</strong>
            </button>
            <button type="button" onClick={() => onNavigate(stockReportRoute)}>
              <span>{t("dashboardSnapshot.aboveThreshold")}</span>
              <strong>{fmt(above)}</strong>
            </button>
          </div>
        </>
      )}
    </article>
  );
}
