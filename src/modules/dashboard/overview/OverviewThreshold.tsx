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
          <span className="eyebrow">NGƯỠNG TỒN</span>
          <h2>Cảnh báo tồn và dữ liệu</h2>
          <span className="card-subtitle">
            Chỉ áp dụng SKU có định mức hợp lệ
          </span>
        </div>
      </div>
      <span className="chip chip-warning">Cần chú ý</span>
    </header>
  );

  if (loading)
    return (
      <article className="card threshold-card">
        {header}
        <OverviewStateBox
          kind="loading"
          title="Đang tải định mức"
          copy="Kiểm tra cấu hình ngưỡng theo SKU."
        />
      </article>
    );
  if (forbidden)
    return (
      <article className="card threshold-card">
        {header}
        <OverviewStateBox
          kind="forbidden"
          title="Không có quyền xem cảnh báo"
          copy="Không hiển thị số liệu nhạy cảm."
        />
      </article>
    );
  if (failed || belowMin === null || aboveMax === null)
    return (
      <article className="card threshold-card">
        {header}
        <OverviewStateBox
          kind="unavailable"
          title="Nguồn định mức chưa sẵn sàng"
          copy="Giữ nguyên các widget độc lập; không thay 0 cho dữ liệu lỗi."
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
          title="Không có SKU lệch định mức"
          copy="SKU chưa đặt min/max không được gắn nhãn thiếu tồn."
        />
      </article>
    );

  const rows = [
    { id: "DASH-KPI-19", name: "Tồn dưới định mức", value: belowMin },
    { id: "DASH-KPI-20", name: "Tồn vượt định mức", value: aboveMax },
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
              aria-label={`${row.name}: ${fmt(row.value)} SKU`}
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
