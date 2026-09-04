/**
 * "Luồng nhập – xuất" — area chart 4 chuỗi của demo, kèm legend bật/tắt chuỗi,
 * vùng hover theo ngày và bảng dữ liệu thay thế cho người dùng trợ năng.
 *
 * Khác demo một điểm DUY NHẤT về số học: demo cố định trục 0..1400 còn ở đây
 * trần trục tính từ dữ liệu thật (làm tròn lên) vì lượng nhập/xuất thật không
 * có trần biết trước.
 *
 * Khác thứ hai, về TRÌNH BÀY: demo chỉ có 7 mốc cứng nên vẽ đủ 7 nhãn là vừa
 * khung. Ở đây người dùng chọn được kỳ dài (30 / 90 / 365 ngày) và nếu vẫn vẽ
 * một nhãn cho mỗi ngày thì trục X biến thành vệt chữ chồng nhau. Mật độ nhãn
 * do `fitAxisDensity` quyết theo bề rộng khung vẽ.
 */
import { useState } from "react";
import { DashIcon } from "../components/DashIcon";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt, type FlowRow } from "./overview-data";
import {
  fitAxisDensity,
  longestLabelChars,
} from "@/shared/components/charts/axis-density";

const W = 580;
const H = 250;
const PAD = 38;
/** Cỡ chữ nhãn trục — khớp `.hn-dash .axis-text` trong CSS của bản port. */
const AXIS_FONT_SIZE = 10;

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
  labelKey: MessageKey;
  line: string;
  dot: string;
}> = [
  {
    key: "inbound",
    labelKey: "dashboard.flow.inbound",
    line: "var(--wms-success)",
    dot: "var(--wms-success)",
  },
  {
    key: "product",
    labelKey: "dashboard.flow.issueProduct",
    line: "var(--wms-error)",
    dot: "var(--hnd-legend-product)",
  },
  {
    key: "component",
    labelKey: "dashboard.flow.issueComponent",
    line: "var(--wms-warning)",
    dot: "var(--hnd-legend-component)",
  },
  {
    key: "reversal",
    labelKey: "dashboard.flow.reversal",
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
  const t = useT();

  const header = (
    <header className="card-head chart-card-head" data-trace="DASH-CHART-01">
      <div className="chart-heading">
        <span className="chart-icon" aria-hidden="true">
          <DashIcon name="chart-column-big" />
        </span>
        <div>
          <span className="eyebrow">{t("dashboard.flow.eyebrow")}</span>
          <h2>{t("dashboard.flow.title")}</h2>
          <span className="card-subtitle">{t("dashboard.flow.subtitle")}</span>
        </div>
      </div>
      <span className="chart-unit">{t("dashboard.flow.unit")}</span>
    </header>
  );

  if (loading)
    return (
      <article className="card chart-card flow-card">
        {header}
        <OverviewStateBox
          kind="loading"
          title={t("dashboard.flow.loadingTitle")}
          copy={t("dashboard.flow.loadingCopy")}
        />
      </article>
    );
  if (forbidden)
    return (
      <article className="card chart-card flow-card">
        {header}
        <OverviewStateBox
          kind="forbidden"
          title={t("dashboard.flow.forbiddenTitle")}
          copy={t("dashboard.flow.forbiddenCopy")}
        />
      </article>
    );
  if (failed)
    return (
      <article className="card chart-card flow-card">
        {header}
        <OverviewStateBox
          kind="unavailable"
          title={t("dashboard.flow.failedTitle")}
          copy={t("dashboard.flow.failedCopy")}
        />
      </article>
    );
  if (rows.length === 0)
    return (
      <article className="card chart-card flow-card">
        {header}
        <OverviewStateBox
          kind="empty"
          title={t("dashboard.flow.emptyTitle")}
          copy={t("dashboard.flow.emptyCopy")}
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

  // Chỉ thưa NHÃN — mọi điểm dữ liệu vẫn được vẽ, và bảng "dữ liệu thay thế"
  // ngay dưới biểu đồ vẫn liệt kê đủ từng ngày.
  const density = fitAxisDensity({
    count: rows.length,
    plotWidth: W - PAD * 2,
    labelChars: longestLabelChars(rows.map((row) => row.label)),
    fontSize: AXIS_FONT_SIZE,
  });

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
              {t(series.labelKey)}
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
            <title id="flow-svg-title">{t("dashboard.flow.svgTitle")}</title>
            <desc id="flow-svg-desc">{t("dashboard.flow.svgDesc")}</desc>
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
            {rows.map((row, index) =>
              density.showLabel(index) ? (
                <text
                  key={`label-${row.date}`}
                  className="axis-text"
                  x={xAt(index)}
                  y={H - 6}
                  textAnchor="middle"
                >
                  {row.label}
                </text>
              ) : null,
            )}
            {hover !== null ? (
              <FlowTooltip
                index={hover}
                rows={rows}
                visible={visible}
                xAt={xAt}
                yAt={yAt}
                t={t}
              />
            ) : null}
          </svg>
        </div>
      </div>
      <details className="chart-table">
        <summary>{t("dashboard.flow.tableSummary")}</summary>
        <table>
          <thead>
            <tr>
              <th>{t("dashboard.flow.colDate")}</th>
              <th>{t("dashboard.flow.inbound")}</th>
              <th>{t("dashboard.flow.issueProduct")}</th>
              <th>{t("dashboard.flow.issueComponent")}</th>
              <th>{t("dashboard.flow.reversal")}</th>
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

/** Nhận `t` từ component cha: tooltip vẽ trong SVG nên không dựng hook riêng. */
function FlowTooltip({
  index,
  rows,
  visible,
  xAt,
  yAt,
  t,
}: {
  index: number;
  rows: FlowRow[];
  visible: Set<SeriesKey>;
  xAt: (index: number) => number;
  yAt: (value: number) => number;
  t: TranslateFn;
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
        {t("dashboard.flow.tooltipDate", { label: rows[index].label })}
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
              {t(series.labelKey)}
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
