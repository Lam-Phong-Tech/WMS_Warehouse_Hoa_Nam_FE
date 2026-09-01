/**
 * Hàng "Theo dõi chuyên biệt" của demo: Hồ sơ bảo hành cần theo dõi · Top 5 SKU
 * xuất · Chất lượng dữ liệu.
 */
import { DashIcon } from "../components/DashIcon";
import type { DashboardIconName } from "../components/DashIcon";
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
  return <article className={`card insight-card ${className}`}>{children}</article>;
}

export function OverviewInsights({
  warranty,
  topSkus,
  signals,
  periodLabel,
  loading,
  failed,
  forbidden,
  onNavigate,
}: {
  warranty: WarrantyInsight;
  topSkus: TopSkuRow[];
  signals: SignalRow[];
  periodLabel: string;
  loading: boolean;
  failed: boolean;
  forbidden: boolean;
  onNavigate: (route: string) => void;
}) {
  const blocked = loading || failed || forbidden;
  const blockedBox = loading ? (
    <OverviewStateBox
      kind="loading"
      title="Đang tải widget"
      copy="Widget dưới fold tải khi đi vào viewport."
    />
  ) : forbidden ? (
    <OverviewStateBox
      kind="forbidden"
      title="Không có quyền xem"
      copy="Widget này cần quyền report.view."
    />
  ) : (
    <OverviewStateBox
      kind="unavailable"
      title="Không thể tải widget"
      copy="Nguồn đọc không phản hồi; dùng Làm mới để thử lại."
    />
  );

  if (blocked) {
    return (
      <div className="insight-grid">
        <InsightShell className="insight-card-warranty">
          {blockedBox}
        </InsightShell>
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
    <div className="insight-grid">
      <InsightShell className="insight-card-warranty">
        <header className="card-head insight-card-head">
          <div className="insight-heading">
            <span className="insight-icon" aria-hidden="true">
              <DashIcon name="briefcase-medical" />
            </span>
            <div>
              <span className="eyebrow">BẢO HÀNH</span>
              <h2>Hồ sơ cần theo dõi</h2>
              <span className="card-subtitle">
                Tình trạng xử lý hồ sơ bảo hành đang mở
              </span>
            </div>
          </div>
          <span
            className={`chip ${warranty.overdue > 3 ? "chip-error" : "chip-warning"}`}
          >
            {fmt(warranty.overdue)} quá hạn
          </span>
        </header>
        <div className="insight-body">
          <div className="metric-pair">
            <div className="metric-box">
              <span>Đang xử lý</span>
              <strong>{fmt(warranty.active)}</strong>
              <small>hồ sơ đang mở</small>
            </div>
            <div className="metric-box metric-box-alert">
              <span>Quá hạn xử lý</span>
              <strong>{fmt(warranty.overdue)}</strong>
              <small>hồ sơ quá hạn SLA</small>
            </div>
          </div>
          <div className="insight-highlight">
            <span className="insight-highlight-icon" aria-hidden="true">
              <DashIcon name="file-clock" />
            </span>
            <div>
              <span>Tuổi hồ sơ cao nhất</span>
              <strong>{fmt(warranty.oldestDays)} ngày</strong>
            </div>
          </div>
          <button
            className="text-button insight-action"
            type="button"
            onClick={() => onNavigate("/warranty")}
          >
            <span>Xem hồ sơ bảo hành</span>
            <DashIcon name="arrow-right" />
          </button>
        </div>
      </InsightShell>

      <InsightShell className="insight-card-ranking">
        <header className="card-head insight-card-head" data-kpi-id="DASH-KPI-18">
          <div className="insight-heading">
            <span className="insight-icon" aria-hidden="true">
              <DashIcon name="package-minus" />
            </span>
            <div>
              <span className="eyebrow">LUÂN CHUYỂN HÀNG</span>
              <h2>Top 5 SKU xuất</h2>
              <span className="card-subtitle">
                Xếp theo tổng lượng xuất sản phẩm giảm dần
              </span>
            </div>
          </div>
          <span className="chip chip-info">{periodLabel}</span>
        </header>
        <div className="insight-body">
          {topSkus.length === 0 ? (
            <OverviewStateBox
              kind="empty"
              title="Chưa có SKU nào xuất kho"
              copy="Không có phát sinh xuất trong kỳ đang xem."
            />
          ) : (
            <>
              <ol className="rank-list">
                {topSkus.map((row, index) => (
                  <li className="rank-row" data-rank={index + 1} key={row.code}>
                    <span className="rank-number" aria-label={`Hạng ${index + 1}`}>
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
                  <span>Xem bảng xếp hạng</span>
                  <DashIcon name="arrow-right" />
                </summary>
                <table>
                  <thead>
                    <tr>
                      <th>Hạng</th>
                      <th>SKU</th>
                      <th>Số lượng</th>
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
              <span className="eyebrow">KIỂM SOÁT DỮ LIỆU</span>
              <h2>Chất lượng dữ liệu</h2>
              <span className="card-subtitle">
                Các tín hiệu cần kiểm tra để dữ liệu luôn đầy đủ
              </span>
            </div>
          </div>
          <span className="chip chip-neutral">Theo dõi</span>
        </header>
        <div className="insight-body">
          <div className="signal-list">
            {signals.map((signal) => (
              <div className="signal-row" data-kpi-id={signal.id} key={signal.id}>
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
            <span>Xem báo cáo ngoại lệ</span>
            <DashIcon name="arrow-right" />
          </button>
        </div>
      </InsightShell>
    </div>
  );
}
