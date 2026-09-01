/**
 * "Luồng nhập – xuất" — area chart 4 chuỗi của demo, kèm legend bật/tắt chuỗi,
 * vùng hover theo ngày và bảng dữ liệu thay thế cho người dùng trợ năng.
 *
 * Khác demo một điểm DUY NHẤT về số học: demo cố định trục 0..1400 còn ở đây
 * trần trục tính từ dữ liệu thật (làm tròn lên) vì lượng nhập/xuất thật không
 * có trần biết trước.
 */
import { useState } from "react";
import { DashIcon } from "../components/DashIcon";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt, type FlowRow } from "./overview-data";

const W = 580;
const H = 250;
const PAD = 38;

type SeriesKey = "inbound" | "product" | "component" | "reversal";

/**
 * Màu ĐƯỜNG lấy đúng bảng demo; màu CHẤM legend/tooltip là bản nhạt hơn.
 *
 * Đọc qua CSS variable (không hard-code hex trong TSX — guard ui:tokens) và đặt
 * bằng `style` chứ không phải presentation attribute, vì `var()` chỉ được phân
 * giải khi giá trị đi qua CSS.
 */
const SERIES: Array<{
  key: SeriesKey;
  label: string;
  line: string;
  dot: string;
}> = [
  {
    key: "inbound",
    label: "Nhập",
    line: "var(--wms-success)",
    dot: "var(--wms-success)",
  },
  {
    key: "product",
    label: "Xuất SP",
    line: "var(--wms-error)",
    dot: "var(--hnd-legend-product)",
  },
  {
    key: "component",
    label: "Xuất LK",
    line: "var(--wms-warning)",
    dot: "var(--hnd-legend-component)",
  },
  {
    key: "reversal",
    label: "Hoàn tác",
    line: "var(--wms-primary)",
    dot: "var(--hnd-legend-reversal)",
  },
];

/** Trần trục "đẹp": 1 · 2 · 2,5 · 5 × 10^n ngay trên giá trị lớn nhất. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

export function OverviewFlowChart({
  rows,
  loading,
  failed,
  forbidden,
}: {
  rows: FlowRow[];
  loading: boolean;
  failed: boolean;
  forbidden: boolean;
}) {
  const [visible, setVisible] = useState<Set<SeriesKey>>(
    () => new Set<SeriesKey>(["inbound", "product", "component", "reversal"]),
  );
  const [hover, setHover] = useState<number | null>(null);

  const header = (
    <header className="card-head chart-card-head" data-trace="DASH-CHART-01">
      <div className="chart-heading">
        <span className="chart-icon" aria-hidden="true">
          <DashIcon name="chart-column-big" />
        </span>
        <div>
          <span className="eyebrow">LUỒNG THEO KỲ</span>
          <h2>Luồng nhập – xuất theo kỳ</h2>
          <span className="card-subtitle">
            Theo dõi lượng nhập, xuất và hoàn tác theo ngày
          </span>
        </div>
      </div>
      <span className="chart-unit">Đơn vị: cái</span>
    </header>
  );

  if (loading)
    return (
      <article className="card chart-card flow-card">
        {header}
        <OverviewStateBox
          kind="loading"
          title="Đang tải biểu đồ"
          copy="Nạp chuỗi ledger theo ngày."
        />
      </article>
    );
  if (forbidden)
    return (
      <article className="card chart-card flow-card">
        {header}
        <OverviewStateBox
          kind="forbidden"
          title="Không có quyền xem luồng"
          copy="Dữ liệu chuỗi thời gian đã được che."
        />
      </article>
    );
  if (failed)
    return (
      <article className="card chart-card flow-card">
        {header}
        <OverviewStateBox
          kind="unavailable"
          title="Không thể tải luồng"
          copy="Nguồn movement không phản hồi; không vẽ đường 0 giả."
        />
      </article>
    );
  if (rows.length === 0)
    return (
      <article className="card chart-card flow-card">
        {header}
        <OverviewStateBox
          kind="empty"
          title="Chưa có giao dịch"
          copy="Không có điểm dữ liệu trong kỳ đang xem."
        />
      </article>
    );

  const allValues = rows.flatMap((row) => [
    row.inbound,
    row.product,
    row.component,
    row.reversal,
  ]);
  const max = niceMax(Math.max(...allValues, 1));
  const min = Math.min(0, ...allValues);
  const step = rows.length > 1 ? (W - PAD * 2) / (rows.length - 1) : 0;
  const xAt = (index: number) => PAD + index * step;
  const yAt = (value: number) =>
    H - PAD - ((value - min) / Math.max(max - min, 1)) * (H - PAD * 2);

  const linePath = (key: SeriesKey) =>
    rows
      .map(
        (row, index) =>
          `${index ? "L" : "M"}${xAt(index).toFixed(1)},${yAt(row[key]).toFixed(1)}`,
      )
      .join(" ");

  return (
    <article className="card chart-card flow-card" id="flow-card">
      {header}
      <div className="chart-wrap">
        <div className="chart-legend">
          {SERIES.map((series) => (
            <button
              key={series.key}
              className="legend-button"
              type="button"
              aria-pressed={visible.has(series.key)}
              onClick={() =>
                setVisible((current) => {
                  const next = new Set(current);
                  if (next.has(series.key)) next.delete(series.key);
                  else next.add(series.key);
                  return next;
                })
              }
            >
              <span className={`legend-dot legend-${series.key}`} />
              {series.label}
            </button>
          ))}
        </div>
        <div className="chart-plot">
          <svg
            className="chart-svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-labelledby="flow-svg-title flow-svg-desc"
            onPointerLeave={() => setHover(null)}
          >
            <title id="flow-svg-title">Luồng nhập xuất theo kỳ</title>
            <desc id="flow-svg-desc">
              Area chart bốn chuỗi nhập, xuất sản phẩm, xuất linh kiện và hoàn
              tác. Di chuột vào từng ngày để xem số liệu chi tiết; có bảng dữ
              liệu thay thế phía dưới.
            </desc>
            <defs>
              {SERIES.map((series) => (
                <linearGradient
                  key={series.key}
                  id={`flow-fill-${series.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0"
                    style={{ stopColor: series.line, stopOpacity: 0.18 }}
                  />
                  <stop
                    offset="1"
                    style={{ stopColor: series.line, stopOpacity: 0 }}
                  />
                </linearGradient>
              ))}
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
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
                  <text className="axis-text" x="2" y={y + 3}>
                    {fmt(Math.round(min + (max - min) * ratio))}
                  </text>
                </g>
              );
            })}
            {SERIES.filter((series) => visible.has(series.key)).map(
              (series) => {
                const path = linePath(series.key);
                return (
                  <g key={series.key}>
                    <path
                      className={`flow-area flow-area-${series.key}`}
                      d={`${path} L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`}
                      fill={`url(#flow-fill-${series.key})`}
                    />
                    <path
                      d={path}
                      style={{ fill: "none", stroke: series.line }}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              },
            )}
            {rows.map((row, index) => {
              const x = xAt(index);
              const left = index === 0 ? PAD : x - step / 2;
              const right = index === rows.length - 1 ? W - PAD : x + step / 2;
              return (
                <rect
                  key={row.date}
                  className="chart-hover-zone"
                  x={left}
                  y={PAD}
                  width={Math.max(right - left, 1)}
                  height={H - PAD * 2}
                  onPointerEnter={() => setHover(index)}
                  onPointerMove={() => setHover(index)}
                />
              );
            })}
            {rows.map((row, index) => (
              <text
                key={`label-${row.date}`}
                className="axis-text"
                x={xAt(index)}
                y={H - 6}
                textAnchor="middle"
              >
                {row.label}
              </text>
            ))}
            {hover !== null ? (
              <FlowTooltip
                index={hover}
                rows={rows}
                visible={visible}
                xAt={xAt}
                yAt={yAt}
              />
            ) : null}
          </svg>
        </div>
      </div>
      <details className="chart-table">
        <summary>Xem bảng dữ liệu thay thế</summary>
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Nhập</th>
              <th>Xuất SP</th>
              <th>Xuất LK</th>
              <th>Hoàn tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td>{row.label}</td>
                <td>{fmt(row.inbound)}</td>
                <td>{fmt(row.product)}</td>
                <td>{fmt(row.component)}</td>
                <td>{fmt(row.reversal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  );
}

function FlowTooltip({
  index,
  rows,
  visible,
  xAt,
  yAt,
}: {
  index: number;
  rows: FlowRow[];
  visible: Set<SeriesKey>;
  xAt: (index: number) => number;
  yAt: (value: number) => number;
}) {
  const x = xAt(index);
  const shown = SERIES.filter((series) => visible.has(series.key));
  const boxWidth = 184;
  const boxHeight = 52 + shown.length * 19;
  const boxX = x + boxWidth + 18 > W - PAD ? x - boxWidth - 18 : x + 18;
  const boxY = 12;
  return (
    <g className="flow-tooltip" aria-hidden="true">
      <line
        className="flow-tooltip-line"
        x1={x.toFixed(1)}
        x2={x.toFixed(1)}
        y1={PAD}
        y2={H - PAD}
      />
      <rect
        className="flow-tooltip-panel"
        x={boxX.toFixed(1)}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx="9"
      />
      <text
        className="flow-tooltip-title"
        x={(boxX + 12).toFixed(1)}
        y={boxY + 20}
      >
        Ngày {rows[index].label}
      </text>
      {shown.map((series, rowIndex) => {
        const y = 44 + rowIndex * 19;
        const pointY = yAt(rows[index][series.key]);
        return (
          <g key={series.key}>
            <circle
              cx={x.toFixed(1)}
              cy={pointY.toFixed(1)}
              r="4"
              style={{ fill: series.dot, stroke: "var(--surface)" }}
              strokeWidth="2"
            />
            <circle
              cx={x.toFixed(1)}
              cy={pointY.toFixed(1)}
              r="7"
              style={{ fill: "none", stroke: series.dot, strokeOpacity: 0.28 }}
              strokeWidth="3"
            />
            <text
              className="flow-tooltip-label"
              x={(boxX + 12).toFixed(1)}
              y={y}
            >
              {series.label}
            </text>
            <text
              className="flow-tooltip-value"
              x={(boxX + boxWidth - 12).toFixed(1)}
              y={y}
            >
              {fmt(rows[index][series.key])}
            </text>
          </g>
        );
      })}
    </g>
  );
}
