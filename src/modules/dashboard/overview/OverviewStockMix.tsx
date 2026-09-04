/**
 * "Tồn theo loại hàng" — donut Sản phẩm / Linh kiện dựng từ ảnh chụp
 * `stock_structure` của `/reports/dashboard-overview`.
 *
 * Thẻ này thay biểu đồ đường "Xu hướng tồn cuối ngày" ở ô thứ hai của lưới
 * phân tích. Ba điều kiện phải giữ nguyên nếu sau này sửa, vì cả ba cùng phục
 * vụ một yêu cầu: chữ và số của thẻ này phải BẰNG thẻ "Luồng nhập – xuất" nằm
 * cạnh.
 *
 *  1. Hai thẻ cùng span 6 (xem `.analysis-grid` trong dashboard-overview.css)
 *     nên khung vẽ rộng bằng nhau.
 *  2. viewBox trùng `OverviewFlowChart` (580×250).
 *  3. Cấu trúc thân thẻ trùng `OverviewFlowChart`: `.chart-legend` rồi tới
 *     `.chart-plot`. `.chart-svg` cao 100% và `preserveAspectRatio` mặc định
 *     (`meet`) nên hệ số phóng phụ thuộc CHIỀU CAO khung vẽ; thiếu hàng chú
 *     giải là khung vẽ cao hơn thẻ bên cạnh và chữ lại to hơn hẳn — đúng lỗi
 *     đã báo, chỉ đổi chiều.
 *
 * Donut là biểu đồ "phần của tổng thể" nên KHÔNG lọc theo bộ lọc loại hàng của
 * trang: lọc còn một loại thì chỉ còn một miếng chiếm 100%, mất hết ý nghĩa so
 * sánh. Thẻ luôn vẽ đủ hai loại và nói rõ điều đó ở phụ đề.
 */
import { DashIcon } from "../components/DashIcon";
import { useT } from "@/shared/i18n/useT";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt, type StockMixRow } from "./overview-data";

/** Khớp `OverviewFlowChart` — xem ghi chú (2) ở đầu tệp. */
const W = 580;
const H = 250;

const CX = W / 2;
const CY = H / 2;
const R_OUTER = 96;
const R_INNER = 62;
/** Bán kính đặt nhãn tỷ trọng bên ngoài vành. */
const R_LABEL = R_OUTER + 20;

const TAU = Math.PI * 2;

function polar(radius: number, angle: number): [number, number] {
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

/** Cung donut giữa hai góc (radian, 0 = 3 giờ). Không dùng cho cung tròn đủ. */
function arcPath(start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = polar(R_OUTER, start);
  const [x2, y2] = polar(R_OUTER, end);
  const [x3, y3] = polar(R_INNER, end);
  const [x4, y4] = polar(R_INNER, start);
  return [
    `M${x1.toFixed(2)},${y1.toFixed(2)}`,
    `A${R_OUTER},${R_OUTER} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`,
    `L${x3.toFixed(2)},${y3.toFixed(2)}`,
    `A${R_INNER},${R_INNER} 0 ${large} 0 ${x4.toFixed(2)},${y4.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function OverviewStockMix({
  rows,
  loading,
  failed,
  forbidden,
}: {
  rows: StockMixRow[];
  loading: boolean;
  failed: boolean;
  forbidden: boolean;
}) {
  const t = useT();
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const hasData = !loading && !failed && !forbidden && total > 0;

  const header = (
    <header className="card-head chart-card-head" data-trace="DASH-CHART-02">
      <div className="chart-heading">
        <span className="chart-icon chart-icon-success" aria-hidden="true">
          <DashIcon name="chart-column-big" />
        </span>
        <div>
          <span className="eyebrow">{t("dashboard.stockMix.eyebrow")}</span>
          <h2>{t("dashboard.stockMix.title")}</h2>
          <span className="card-subtitle">
            {t("dashboard.stockMix.subtitle")}
          </span>
        </div>
      </div>
      {hasData ? (
        <div className="chart-head-meta">
          <span className="chip chip-success">
            {t("dashboard.stockMix.chipSnapshot")}
          </span>
          <span className="chart-current">
            <strong>{fmt(total)}</strong>
            <small>{t("dashboard.stockMix.totalUnit")}</small>
          </span>
        </div>
      ) : (
        <span className="chart-unit">{t("dashboard.stockMix.unit")}</span>
      )}
    </header>
  );

  if (loading)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="loading"
          title={t("dashboard.stockMix.loadingTitle")}
          copy={t("dashboard.stockMix.loadingCopy")}
        />
      </article>
    );
  if (forbidden)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="forbidden"
          title={t("dashboard.stockMix.forbiddenTitle")}
          copy={t("dashboard.stockMix.forbiddenCopy")}
        />
      </article>
    );
  if (failed)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="unavailable"
          title={t("dashboard.stockMix.failedTitle")}
          copy={t("dashboard.stockMix.failedCopy")}
        />
      </article>
    );
  // Tổng 0 là "chưa có gì để chia" — vành trắng không nói được điều gì.
  if (total === 0)
    return (
      <article className="card chart-card">
        {header}
        <OverviewStateBox
          kind="empty"
          title={t("dashboard.stockMix.emptyTitle")}
          copy={t("dashboard.stockMix.emptyCopy")}
        />
      </article>
    );

  const drawable = rows.filter((row) => row.value > 0);
  // Một loại chiếm trọn: cung 0→2π suy biến (điểm đầu trùng điểm cuối) nên vẽ
  // vành bằng một đường tròn có stroke dày thay vì <path>.
  const isFullRing = drawable.length === 1;

  /*
   * Vòng `for` thay vì `map` + biến cộng dồn bên ngoài: mỗi lát bắt đầu ở chỗ
   * lát trước kết thúc, mà gán lại biến ngoài từ trong callback là thứ React
   * Compiler (react-hooks/immutability) chặn — cùng lý do đã ghi ở
   * shared/components/charts/WaterfallChart.tsx.
   */
  const slices: Array<{
    row: (typeof drawable)[number];
    start: number;
    end: number;
    mid: number;
  }> = [];
  let cursor = -Math.PI / 2;
  for (const row of drawable) {
    const start = cursor;
    const end = start + (row.value / total) * TAU;
    cursor = end;
    slices.push({ row, start, end, mid: (start + end) / 2 });
  }

  return (
    <article className="card chart-card" id="stock-mix-card">
      {header}
      <div className="chart-wrap">
        {/* Hàng chú giải: xem ghi chú (3) ở đầu tệp — không chỉ để đọc màu, nó
            còn giữ cho khung vẽ cao đúng bằng thẻ biểu đồ luồng bên cạnh. */}
        <div className="chart-legend">
          {rows.map((row) => (
            <span className="legend-button legend-static" key={row.key}>
              <span
                className={`legend-dot legend-mix-${row.key.toLowerCase()}`}
              />
              {row.label}
              <strong className="legend-figure">{fmt(row.value)}</strong>
              <small>{row.pct}%</small>
            </span>
          ))}
        </div>
        <div className="chart-plot">
          <svg
            className="chart-svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-labelledby="stock-mix-title stock-mix-desc"
          >
            <title id="stock-mix-title">
              {t("dashboard.stockMix.svgTitle")}
            </title>
            <desc id="stock-mix-desc">
              {t("dashboard.stockMix.svgDesc", {
                total: fmt(total),
                detail: rows
                  .map((row) => `${row.label} ${fmt(row.value)} (${row.pct}%)`)
                  .join(", "),
              })}
            </desc>

            {isFullRing ? (
              <circle
                className={`mix-slice mix-slice-${drawable[0].key.toLowerCase()}`}
                cx={CX}
                cy={CY}
                r={(R_OUTER + R_INNER) / 2}
                style={{ fill: "none", strokeWidth: R_OUTER - R_INNER }}
              />
            ) : (
              slices.map(({ row, start, end }) => (
                <path
                  key={row.key}
                  className={`mix-slice mix-slice-${row.key.toLowerCase()}`}
                  d={arcPath(start, end)}
                />
              ))
            )}

            <text className="mix-center-value" x={CX} y={CY + 4}>
              {fmt(total)}
            </text>
            <text className="mix-center-unit" x={CX} y={CY + 26}>
              {t("dashboard.stockMix.totalUnit")}
            </text>

            {/* Tỷ trọng đặt ngoài vành, ở giữa cung — miếng nhỏ vẫn đọc được số
                mà không cần đường dẫn nhãn. Bỏ qua miếng dưới 6% để hai nhãn
                không đè lên nhau. */}
            {slices
              .filter(({ row }) => row.pct >= 6)
              .map(({ row, mid }) => {
                const [x, y] = polar(R_LABEL, mid);
                return (
                  <text
                    key={row.key}
                    className="mix-slice-pct"
                    x={x}
                    y={y + 4}
                    textAnchor={
                      Math.abs(Math.cos(mid)) < 0.25
                        ? "middle"
                        : Math.cos(mid) > 0
                          ? "start"
                          : "end"
                    }
                  >
                    {row.pct}%
                  </text>
                );
              })}
          </svg>
        </div>
      </div>
      <details className="chart-table">
        <summary>{t("dashboard.stockMix.tableSummary")}</summary>
        <table>
          <thead>
            <tr>
              <th>{t("dashboard.stockMix.colType")}</th>
              <th>{t("dashboard.stockMix.colQuantity")}</th>
              <th>{t("dashboard.stockMix.colShare")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
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
