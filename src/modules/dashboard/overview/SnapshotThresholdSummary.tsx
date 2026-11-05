import { useStockReconcileSnapshot } from "@/modules/reports/stock-reconcile/stock-reconcile-api";
import { DashIcon } from "../components/DashIcon";
import { fmt } from "./overview-data";
import { useT } from "@/shared/i18n/useT";
import { buildDashboardThresholds } from "./dashboard-threshold-model";
import "./dashboard-system-views.css";

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
            Chỉ SKU có min hoặc max mới được đánh giá.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("/dashboard?screen=MAP-01&view=thresholds")}
        >
          Xem chi tiết <DashIcon name="arrow-right" />
        </button>
      </header>
      {source.error && hasCompleteSnapshot ? (
        <div className="snapshot-partial-alert" role="status">
          Định mức có thể đã cũ.{" "}
          <button type="button" onClick={() => void source.refetch()}>
            Thử lại
          </button>
        </div>
      ) : null}
      {source.loading ? (
        <div className="snapshot-threshold-state" role="status">
          Đang tải định mức…
        </div>
      ) : source.error && !hasCompleteSnapshot ? (
        <div className="snapshot-threshold-state" role="alert">
          Không tải được định mức.{" "}
          <button type="button" onClick={() => void source.refetch()}>
            Thử lại
          </button>
        </div>
      ) : (
        <>
          <div className="snapshot-threshold-totals">
            <div>
              <strong>{fmt(configured)}</strong>
              <span>SKU đã cấu hình</span>
            </div>
            <div>
              <strong>{fmt(unconfigured)}</strong>
              <span>SKU chưa cấu hình</span>
            </div>
          </div>
          <div className="snapshot-threshold-alerts">
            <button
              type="button"
              onClick={() =>
                onNavigate("/dashboard?screen=MAP-01&view=thresholds")
              }
            >
              <span>Dưới định mức</span>
              <strong>{fmt(below)}</strong>
            </button>
            <button
              type="button"
              onClick={() =>
                onNavigate("/dashboard?screen=MAP-01&view=thresholds")
              }
            >
              <span>Vượt định mức</span>
              <strong>{fmt(above)}</strong>
            </button>
          </div>
        </>
      )}
    </article>
  );
}
