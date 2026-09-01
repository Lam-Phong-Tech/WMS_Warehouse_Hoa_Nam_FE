/**
 * "Cơ cấu tồn theo trạng thái" — thanh phân đoạn + danh sách của demo.
 *
 * Bốn trạng thái là bộ THẬT của ERD (AVAILABLE / QUARANTINE / NON_SELLABLE /
 * DEFECTIVE); demo dùng bộ minh hoạ IN_PROCESS / UNCLASSIFIED nhưng giữ nguyên
 * thứ tự và bảng màu 4 ô.
 */
import { DashIcon } from "../components/DashIcon";
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
  const header = (
    <header className="card-head chart-card-head" data-trace="DASH-CHART-03">
      <div className="chart-heading">
        <span className="chart-icon" aria-hidden="true">
          <DashIcon name="layout-dashboard" />
        </span>
        <div>
          <span className="eyebrow">CƠ CẤU TỒN</span>
          <h2>Cơ cấu tồn theo trạng thái</h2>
          <span className="card-subtitle">
            Theo trạng thái hàng tại thời điểm chốt
          </span>
        </div>
      </div>
      <span className="chart-unit">Đơn vị: cái</span>
    </header>
  );

  if (loading)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="loading"
          title="Đang tải cơ cấu"
          copy="Tổng hợp theo nhóm hàng."
        />
      </article>
    );
  if (forbidden)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="forbidden"
          title="Không có quyền xem cơ cấu"
          copy="Không hiển thị phần trăm suy diễn."
        />
      </article>
    );
  if (failed)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="unavailable"
          title="Không thể tải cơ cấu"
          copy="Nguồn stock-status không phản hồi."
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
          title="Không có tồn khả dụng"
          copy="Không tạo biểu đồ khi tổng mẫu bằng 0."
        />
      </article>
    );

  return (
    <article className="card chart-card" id="composition-card">
      {header}
      <div className="composition-layout">
        <div className="composition-overview">
          <div className="composition-total-panel">
            <span className="eyebrow">TỔNG TỒN TẠI CHỐT</span>
            <strong>{fmt(total)}</strong>
            <span>Đơn vị: cái · đã phân bổ theo trạng thái</span>
          </div>
          <div className="composition-distribution">
            <div
              className="composition-segmented"
              role="img"
              aria-label={`Cơ cấu tồn theo trạng thái, tổng ${fmt(total)} cái`}
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
              <span>100% tổng tồn</span>
              <span>{rows.length} trạng thái</span>
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
        <summary>Xem số liệu chi tiết</summary>
        <table>
          <thead>
            <tr>
              <th>Trạng thái</th>
              <th>Số lượng</th>
              <th>Tỷ trọng</th>
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
