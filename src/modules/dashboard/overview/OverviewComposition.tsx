/**
 * "Cơ cấu tồn theo trạng thái" — thanh phân đoạn + danh sách của demo.
 *
 * Bốn trạng thái là bộ THẬT của ERD (AVAILABLE / QUARANTINE / NON_SELLABLE /
 * DEFECTIVE); demo dùng bộ minh hoạ IN_PROCESS / UNCLASSIFIED nhưng giữ nguyên
 * thứ tự và bảng màu 4 ô.
 */
import { DashIcon } from "../components/DashIcon";
import { useT } from "@/shared/i18n/useT";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt } from "./overview-data";

export interface CompositionRow {
  status: string;
  label: string;
  value: number;
  pct: number;
}

export function OverviewComposition({
  rows,
  loading,
  failed,
  forbidden,
}: {
  rows: CompositionRow[];
  loading: boolean;
  failed: boolean;
  forbidden: boolean;
}) {
  const t = useT();
  const header = (
    <header className="card-head chart-card-head" data-trace="DASH-CHART-03">
      <div className="chart-heading">
        <span className="chart-icon" aria-hidden="true">
          <DashIcon name="layout-dashboard" />
        </span>
        <div>
          <span className="eyebrow">{t("dashboard.composition.eyebrow")}</span>
          <h2>{t("dashboard.composition.title")}</h2>
          <span className="card-subtitle">
            {t("dashboard.composition.subtitle")}
          </span>
        </div>
      </div>
      <span className="chart-unit">{t("dashboard.composition.unit")}</span>
    </header>
  );

  if (loading)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="loading"
          title={t("dashboard.composition.loadingTitle")}
          copy={t("dashboard.composition.loadingCopy")}
        />
      </article>
    );
  if (forbidden)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="forbidden"
          title={t("dashboard.composition.forbiddenTitle")}
          copy={t("dashboard.composition.forbiddenCopy")}
        />
      </article>
    );
  if (failed)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="unavailable"
          title={t("dashboard.composition.failedTitle")}
          copy={t("dashboard.composition.failedCopy")}
        />
      </article>
    );

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (total <= 0)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="empty"
          title={t("dashboard.composition.emptyTitle")}
          copy={t("dashboard.composition.emptyCopy")}
        />
      </article>
    );

  return (
    <article className="card chart-card" id="composition-card">
      {header}
      <div className="composition-layout">
        <div className="composition-overview">
          <div className="composition-total-panel">
            <span className="eyebrow">
              {t("dashboard.composition.totalEyebrow")}
            </span>
            <strong>{fmt(total)}</strong>
            <span>{t("dashboard.composition.totalUnit")}</span>
          </div>
          <div className="composition-distribution">
            <div
              className="composition-segmented"
              role="img"
              aria-label={t("dashboard.composition.chartAria", {
                total: fmt(total),
              })}
            >
              {rows.map((row) => (
                <span
                  key={row.status}
                  className={`composition-segment composition-segment-${row.status.toLowerCase()}`}
                  style={
                    { "--segment-width": `${row.pct}%` } as React.CSSProperties
                  }
                  title={`${row.label}: ${fmt(row.value)} (${row.pct}%)`}
                />
              ))}
            </div>
            <div className="composition-distribution-meta">
              <span>{t("dashboard.composition.fullShare")}</span>
              <span>
                {t("dashboard.composition.statusCount", {
                  count: rows.length,
                })}
              </span>
            </div>
          </div>
        </div>
        <div className="composition-list">
          {rows.map((row) => (
            <div
              className="composition-row"
              data-status={row.status}
              key={row.status}
            >
              <i />
              <span>
                {row.label}{" "}
                <small className="composition-code">({row.status})</small>
              </span>
              <span className="composition-figure">
                <strong>{fmt(row.value)}</strong>
                <small>{row.pct}%</small>
              </span>
            </div>
          ))}
        </div>
      </div>
      <details className="chart-table">
        <summary>{t("dashboard.composition.tableSummary")}</summary>
        <table>
          <thead>
            <tr>
              <th>{t("dashboard.composition.colStatus")}</th>
              <th>{t("dashboard.composition.colQuantity")}</th>
              <th>{t("dashboard.composition.colShare")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.status}>
                <td>
                  {row.label}{" "}
                  <small className="composition-code">({row.status})</small>
                </td>
                <td>{fmt(row.value)}</td>
                <td>{row.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  );
}
