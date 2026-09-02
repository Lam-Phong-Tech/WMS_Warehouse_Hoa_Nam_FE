/**
 * "Cảnh báo tồn và dữ liệu" — hai thanh định mức của demo.
 *
 * Số lấy từ `/reports/dashboard-quick` (`below_min_stock_count` /
 * `above_max_stock_count`, tính trên min_stock/max_stock đã đặt ở SKU master).
 * SKU chưa cấu hình định mức KHÔNG bị đếm vào bất kỳ cảnh báo nào — nên khi cả
 * hai bằng 0 thì hiển thị trạng thái "chưa cấu hình / không có cảnh báo" thay vì
 * vẽ hai thanh rỗng.
 */
import { DashIcon } from "../components/DashIcon";
import { useT } from "@/shared/i18n/useT";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt } from "./overview-data";

export function OverviewThreshold({
  belowMin,
  aboveMax,
  loading,
  failed,
  forbidden,
}: {
  belowMin: number | null;
  aboveMax: number | null;
  loading: boolean;
  failed: boolean;
  forbidden: boolean;
}) {
  const t = useT();
  const header = (
    <header
      className="card-head chart-card-head threshold-card-head"
      data-trace="DASH-WIDGET-04"
    >
      <div className="chart-heading">
        <span className="chart-icon chart-icon-warning" aria-hidden="true">
          <DashIcon name="settings-2" />
        </span>
        <div>
          <span className="eyebrow">{t("dashboard.threshold.eyebrow")}</span>
          <h2>{t("dashboard.threshold.title")}</h2>
          <span className="card-subtitle">
            {t("dashboard.threshold.subtitle")}
          </span>
        </div>
      </div>
      <span className="chip chip-warning">{t("dashboard.threshold.chip")}</span>
    </header>
  );

  if (loading)
    return (
      <article className="card threshold-card">
        {header}
        <OverviewStateBox
          kind="loading"
          title={t("dashboard.threshold.loadingTitle")}
          copy={t("dashboard.threshold.loadingCopy")}
        />
      </article>
    );
  if (forbidden)
    return (
      <article className="card threshold-card">
        {header}
        <OverviewStateBox
          kind="forbidden"
          title={t("dashboard.threshold.forbiddenTitle")}
          copy={t("dashboard.threshold.forbiddenCopy")}
        />
      </article>
    );
  if (failed || belowMin === null || aboveMax === null)
    return (
      <article className="card threshold-card">
        {header}
        <OverviewStateBox
          kind="unavailable"
          title={t("dashboard.threshold.failedTitle")}
          copy={t("dashboard.threshold.failedCopy")}
        />
      </article>
    );

  const total = belowMin + aboveMax;
  if (total === 0)
    return (
      <article className="card threshold-card">
        {header}
        <OverviewStateBox
          kind="empty"
          title={t("dashboard.threshold.emptyTitle")}
          copy={t("dashboard.threshold.emptyCopy")}
        />
      </article>
    );

  const rows = [
    {
      id: "DASH-KPI-19",
      name: t("dashboard.threshold.belowMin"),
      value: belowMin,
    },
    {
      id: "DASH-KPI-20",
      name: t("dashboard.threshold.aboveMax"),
      value: aboveMax,
    },
  ];

  return (
    <article className="card threshold-card" id="threshold-card">
      {header}
      <div className="threshold-list">
        {rows.map((row) => (
          <div className="threshold-row" data-kpi-id={row.id} key={row.id}>
            <div>
              <span>{row.name}</span>
            </div>
            <div
              className="meter"
              role="img"
              aria-label={t("dashboard.threshold.meterAria", {
                name: row.name,
                value: fmt(row.value),
              })}
            >
              <span
                style={
                  {
                    "--meter-width": `${Math.round((row.value / total) * 100)}%`,
                  } as React.CSSProperties
                }
              />
            </div>
            <span className="threshold-value">{fmt(row.value)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
