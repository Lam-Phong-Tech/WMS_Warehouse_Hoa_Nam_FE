/**
 * Hàng "Theo dõi chuyên biệt" của demo: Hồ sơ bảo hành cần theo dõi · Top 5 SKU
 * xuất · Chất lượng dữ liệu.
 */
import { DashIcon } from "../components/DashIcon";
import type { DashboardIconName } from "../components/DashIcon";
import { useT } from "@/shared/i18n/useT";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt, type TopSkuRow } from "./overview-data";

export interface WarrantyInsight {
  active: number;
  overdue: number;
  oldestDays: number;
}

export interface SignalRow {
  id: string;
  name: string;
  value: string;
  icon: DashboardIconName;
}

function InsightShell({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`card insight-card ${className}`}>{children}</article>
  );
}

export function OverviewInsights({
  warranty,
  showWarranty = true,
  topSkus,
  signals,
  periodLabel,
  loading,
  failed,
  failedCopy,
  forbidden,
  onNavigate,
}: {
  warranty: WarrantyInsight;
  /**
   * false = người dùng KHÔNG có quyền bảo hành (`warranty.view`): bỏ hẳn thẻ
   * "Hồ sơ bảo hành cần theo dõi" khỏi hàng, không hiện dạng rỗng/403. Thẻ này
   * dẫn thẳng sang /warranty — vai không vào được màn đó thì thẻ chỉ là ngõ cụt.
   * Hai thẻ còn lại giãn ra 6/12 cột nhờ modifier `insight-grid--two`.
   */
  showWarranty?: boolean;
  topSkus: TopSkuRow[];
  signals: SignalRow[];
  periodLabel: string;
  loading: boolean;
  failed: boolean;
  /** Câu giải thích khi `failed` — trang tính một lần theo nguyên nhân thật. */
  failedCopy: string;
  forbidden: boolean;
  onNavigate: (route: string) => void;
}) {
  const t = useT();
  const gridClass = showWarranty
    ? "insight-grid"
    : "insight-grid insight-grid--two";
  const blocked = loading || failed || forbidden;
  const blockedBox = loading ? (
    <OverviewStateBox
      kind="loading"
      title={t("dashboard.insight.loadingTitle")}
      copy={t("dashboard.insight.loadingCopy")}
    />
  ) : forbidden ? (
    <OverviewStateBox
      kind="forbidden"
      title={t("dashboard.insight.forbiddenTitle")}
      copy={t("dashboard.insight.forbiddenCopy")}
    />
  ) : (
    <OverviewStateBox
      kind="unavailable"
      title={t("dashboard.insight.failedTitle")}
      copy={failedCopy}
    />
  );

  if (blocked) {
    return (
      <div className={gridClass}>
        {showWarranty ? (
          <InsightShell className="insight-card-warranty">
            {blockedBox}
          </InsightShell>
        ) : null}
        <InsightShell className="insight-card-ranking">
          {blockedBox}
        </InsightShell>
        <InsightShell className="insight-card-quality">
          {blockedBox}
        </InsightShell>
      </div>
    );
  }

  const maxIssue = topSkus.reduce((max, row) => Math.max(max, row.value), 0);

  return (
    <div className={gridClass}>
      {showWarranty ? (
        <InsightShell className="insight-card-warranty">
          <header className="card-head insight-card-head">
            <div className="insight-heading">
              <span className="insight-icon" aria-hidden="true">
                <DashIcon name="briefcase-medical" />
              </span>
              <div>
                <span className="eyebrow">
                  {t("dashboard.insight.warrantyEyebrow")}
                </span>
                <h2>{t("dashboard.insight.warrantyTitle")}</h2>
                <span className="card-subtitle">
                  {t("dashboard.insight.warrantySubtitle")}
                </span>
              </div>
            </div>
            <span
              className={`chip ${warranty.overdue > 3 ? "chip-error" : "chip-warning"}`}
            >
              {t("dashboard.insight.warrantyChip", {
                count: fmt(warranty.overdue),
              })}
            </span>
          </header>
          <div className="insight-body">
            <div className="metric-pair">
              <div className="metric-box">
                <span>{t("dashboard.insight.active")}</span>
                <strong>{fmt(warranty.active)}</strong>
                <small>{t("dashboard.insight.activeNote")}</small>
              </div>
              <div className="metric-box metric-box-alert">
                <span>{t("dashboard.insight.overdue")}</span>
                <strong>{fmt(warranty.overdue)}</strong>
                <small>{t("dashboard.insight.overdueNote")}</small>
              </div>
            </div>
            <div className="insight-highlight">
              <span className="insight-highlight-icon" aria-hidden="true">
                <DashIcon name="file-clock" />
              </span>
              <div>
                <span>{t("dashboard.insight.oldest")}</span>
                <strong>
                  {t("dashboard.insight.oldestValue", {
                    days: fmt(warranty.oldestDays),
                  })}
                </strong>
              </div>
            </div>
            <button
              className="text-button insight-action"
              type="button"
              onClick={() => onNavigate("/warranty")}
            >
              <span>{t("dashboard.insight.warrantyAction")}</span>
              <DashIcon name="arrow-right" />
            </button>
          </div>
        </InsightShell>
      ) : null}

      <InsightShell className="insight-card-ranking">
        <header
          className="card-head insight-card-head"
          data-kpi-id="DASH-KPI-18"
        >
          <div className="insight-heading">
            <span className="insight-icon" aria-hidden="true">
              <DashIcon name="package-minus" />
            </span>
            <div>
              <span className="eyebrow">
                {t("dashboard.insight.rankEyebrow")}
              </span>
              <h2>{t("dashboard.insight.rankTitle")}</h2>
              <span className="card-subtitle">
                {t("dashboard.insight.rankSubtitle")}
              </span>
            </div>
          </div>
          <span className="chip chip-info">{periodLabel}</span>
        </header>
        <div className="insight-body">
          {topSkus.length === 0 ? (
            <OverviewStateBox
              kind="empty"
              title={t("dashboard.insight.rankEmptyTitle")}
              copy={t("dashboard.insight.rankEmptyCopy")}
            />
          ) : (
            <>
              <ol className="rank-list">
                {topSkus.map((row, index) => (
                  <li className="rank-row" data-rank={index + 1} key={row.code}>
                    <span
                      className="rank-number"
                      aria-label={t("dashboard.insight.rankAria", {
                        rank: index + 1,
                      })}
                    >
                      {index + 1}
                    </span>
                    <div className="rank-copy">
                      <strong title={`${row.code} · ${row.name}`}>
                        {row.code}
                      </strong>
                      <div className="mini-bar" aria-hidden="true">
                        <span
                          style={
                            {
                              "--bar-width": `${maxIssue > 0 ? Math.round((row.value / maxIssue) * 100) : 0}%`,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                    </div>
                    <strong className="rank-value">{fmt(row.value)}</strong>
                  </li>
                ))}
              </ol>
              <details className="chart-table insight-table">
                <summary>
                  <span>{t("dashboard.insight.rankTableSummary")}</span>
                  <DashIcon name="arrow-right" />
                </summary>
                <table>
                  <thead>
                    <tr>
                      <th>{t("dashboard.insight.colRank")}</th>
                      <th>{t("dashboard.insight.colSku")}</th>
                      <th>{t("dashboard.insight.colQuantity")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSkus.map((row, index) => (
                      <tr key={row.code}>
                        <td>{index + 1}</td>
                        <td>{row.code}</td>
                        <td>{fmt(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </div>
      </InsightShell>

      <InsightShell className="insight-card-quality">
        <header className="card-head insight-card-head">
          <div className="insight-heading">
            <span className="insight-icon" aria-hidden="true">
              <DashIcon name="settings-2" />
            </span>
            <div>
              <span className="eyebrow">
                {t("dashboard.insight.qualityEyebrow")}
              </span>
              <h2>{t("dashboard.insight.qualityTitle")}</h2>
              <span className="card-subtitle">
                {t("dashboard.insight.qualitySubtitle")}
              </span>
            </div>
          </div>
          <span className="chip chip-neutral">
            {t("dashboard.insight.qualityChip")}
          </span>
        </header>
        <div className="insight-body">
          <div className="signal-list">
            {signals.map((signal) => (
              <div
                className="signal-row"
                data-kpi-id={signal.id}
                key={signal.id}
              >
                <span className="signal-icon" aria-hidden="true">
                  <DashIcon name={signal.icon} />
                </span>
                <span>{signal.name}</span>
                <strong>{signal.value}</strong>
              </div>
            ))}
          </div>
          <button
            className="text-button insight-action"
            type="button"
            onClick={() => onNavigate("/reports/import-quality")}
          >
            <span>{t("dashboard.insight.qualityAction")}</span>
            <DashIcon name="arrow-right" />
          </button>
        </div>
      </InsightShell>
    </div>
  );
}
