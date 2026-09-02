/**
 * "Xu hướng tồn cuối ngày" — đường actual của demo. Trục dọc bám dữ liệu thật
 * (demo cố định 26.800..28.800) và chỉ vẽ những ngày ĐÃ CHỐT do BE trả.
 */
import { DashIcon } from "../components/DashIcon";
import { useT } from "@/shared/i18n/useT";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt, type TrendRow } from "./overview-data";

const W = 580;
const H = 220;
const PAD = 34;

export function OverviewTrendChart({
  rows,
  loading,
  failed,
  forbidden,
}: {
  rows: TrendRow[];
  loading: boolean;
  failed: boolean;
  forbidden: boolean;
}) {
  const t = useT();
  const hasData = !loading && !failed && !forbidden && rows.length > 0;
  const last = rows.at(-1);

  const header = (
    <header className="card-head chart-card-head" data-trace="DASH-CHART-02">
      <div className="chart-heading">
        <span className="chart-icon chart-icon-success" aria-hidden="true">
          <DashIcon name="chart-column-big" />
        </span>
        <div>
          <span className="eyebrow">{t("dashboard.trend.eyebrow")}</span>
          <h2>{t("dashboard.trend.title")}</h2>
          <span className="card-subtitle">{t("dashboard.trend.subtitle")}</span>
        </div>
      </div>
      {hasData && last ? (
        <div className="chart-head-meta">
          <span className="chip chip-success">
            {t("dashboard.trend.chipActual")}
          </span>
          <span className="chart-current">
            <strong>{fmt(last.closing)}</strong>
            <small>{t("dashboard.trend.closingUnit")}</small>
          </span>
        </div>
      ) : (
        <span className="chart-unit">{t("dashboard.trend.unit")}</span>
      )}
    </header>
  );

  if (loading)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="loading"
          title={t("dashboard.trend.loadingTitle")}
          copy={t("dashboard.trend.loadingCopy")}
        />
      </article>
    );
  if (forbidden)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="forbidden"
          title={t("dashboard.trend.forbiddenTitle")}
          copy={t("dashboard.trend.forbiddenCopy")}
        />
      </article>
    );
  if (failed)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="unavailable"
          title={t("dashboard.trend.failedTitle")}
          copy={t("dashboard.trend.failedCopy")}
        />
      </article>
    );
  if (rows.length === 0)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="empty"
          title={t("dashboard.trend.emptyTitle")}
          copy={t("dashboard.trend.emptyCopy")}
        />
      </article>
    );

  const values = rows.map((row) => row.closing);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Đường phẳng (min = max) vẫn phải nằm giữa khung thay vì dính đáy.
  const padding = rawMax === rawMin ? Math.max(Math.abs(rawMax) * 0.1, 1) : 0;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const step = rows.length > 1 ? (W - PAD * 2) / (rows.length - 1) : 0;
  const xAt = (index: number) => PAD + index * step;
  const yAt = (value: number) =>
    H - PAD - ((value - min) / Math.max(max - min, 1)) * (H - PAD * 2);

  const path = rows
    .map(
      (row, index) =>
        `${index ? "L" : "M"}${xAt(index).toFixed(1)},${yAt(row.closing).toFixed(1)}`,
    )
    .join(" ");

  return (
    <article className="card chart-card" id="trend-card">
      {header}
      <div className="chart-wrap">
        <div className="chart-plot">
          <svg
            className="chart-svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-labelledby="trend-svg-title trend-svg-desc"
          >
            <title id="trend-svg-title">{t("dashboard.trend.svgTitle")}</title>
            <desc id="trend-svg-desc">
              {t("dashboard.trend.svgDesc", {
                days: rows.length,
                value: fmt(rows[rows.length - 1].closing),
              })}
            </desc>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0"
                  style={{ stopColor: "var(--wms-primary)", stopOpacity: 0.28 }}
                />
                <stop
                  offset="1"
                  style={{ stopColor: "var(--wms-primary)", stopOpacity: 0 }}
                />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((ratio) => {
              const y = H - PAD - ratio * (H - PAD * 2);
              return (
                <g key={ratio}>
                  <line
                    className="grid-line"
                    x1={PAD}
                    x2={W - PAD}
                    y1={y}
                    y2={y}
                  />
                  <text className="axis-text" x="1" y={y + 3}>
                    {fmt(Math.round(min + (max - min) * ratio))}
                  </text>
                </g>
              );
            })}
            <path
              d={`${path} L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`}
              fill="url(#trend-fill)"
            />
            <path
              d={path}
              style={{ fill: "none", stroke: "var(--wms-primary)" }}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {rows.map((row, index) => (
              <text
                key={row.date}
                className="axis-text"
                x={xAt(index)}
                y={H - 6}
                textAnchor="middle"
              >
                {row.label}
              </text>
            ))}
          </svg>
        </div>
      </div>
      <details className="chart-table">
        <summary>{t("dashboard.trend.tableSummary")}</summary>
        <table>
          <thead>
            <tr>
              <th>{t("dashboard.trend.colDate")}</th>
              <th>{t("dashboard.trend.colClosing")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td>{row.label}</td>
                <td>{fmt(row.closing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  );
}
