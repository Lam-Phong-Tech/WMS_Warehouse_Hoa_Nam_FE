/**
 * RPT-01 · hai biểu đồ SVG của mockup 8.1, dựng lại ĐÚNG hình học đã xuất trong
 * `8.1.WMS_Hoa_Nam_Bao_Cao_Xuat_Nhap_Ton.html`:
 *
 *  · khung `viewBox="0 0 640 228"`, vùng vẽ từ x=38 tới x=626 và y=20 (đỉnh)
 *    tới y=196 (đáy);
 *  · 4 đường lưới ngang chia đều, nhãn trục Y đặt tại x=31 (`text-anchor=end`)
 *    lệch xuống 3px, giá trị = `max × (3 − i) / 3`;
 *  · nhãn trục X tại y=219 (`text-anchor=middle`);
 *  · đường: `stroke-width` 2.6 (luồng) / 3 (tồn cuối), mỗi điểm một `circle`
 *    r=3.5 nền trắng viền màu chuỗi dày 2.5;
 *  · nhãn giá trị ở điểm CUỐI: luồng đặt trên điểm (`cy − 8`), tồn cuối đặt
 *    dưới (`cy + 10`) — đúng như bản xuất;
 *  · toạ độ làm tròn 1 chữ số thập phân, y hệt chuỗi trong file mockup.
 *
 * KHÁC MOCKUP Ở ĐÂU (và vì sao):
 *  · Mockup khai `<linearGradient id="flow-fill">` nhưng KHÔNG tham chiếu nó
 *    (biểu đồ luồng chỉ có đường, không có vùng tô). Không chép def chết đó.
 *  · Bốn nút chú giải của mockup có `aria-pressed` nhưng không nút nào gắn xử
 *    lý — đó là nút chết. Ở đây chúng bật/tắt chuỗi thật; trục Y tính lại theo
 *    các chuỗi ĐANG hiện nên biểu đồ luôn lấp đầy khung.
 *  · Mockup chỉ có 7 mốc cứng nên vẽ đủ 7 nhãn là vừa khung. Dữ liệu thật cho
 *    chọn kỳ tuỳ ý (30 / 90 / 365 ngày) và ở các kỳ đó việc vẽ đủ nhãn biến
 *    trục X thành một vệt chữ chồng nhau, chấm điểm dính thành dải đặc. Nên
 *    mật độ nhãn/chấm ở đây do `fitAxisDensity` quyết theo bề rộng khung —
 *    xem `@/shared/components/charts/axis-density`.
 */
import type { CSSProperties } from "react";
import { fmt } from "@/modules/reports/operations/report-format";
import {
  fitAxisDensity,
  longestLabelChars,
} from "@/shared/components/charts/axis-density";

/** Khung vẽ — số đo lấy nguyên từ bản xuất của mockup. */
const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 228;
const PLOT_LEFT = 38;
const PLOT_RIGHT = 626;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 196;
/** Số đường lưới ngang của mockup (kể cả đường đáy). */
const GRID_STEPS = 3;
const AXIS_LABEL_X = 31;
const AXIS_LABEL_DY = 3;
const X_AXIS_LABEL_Y = 219;
const POINT_RADIUS = 3.5;
/** Cỡ chữ nhãn trục — khớp `.hn-rpt01 .chart-axis-label` trong CSS của bản port. */
const AXIS_FONT_SIZE = 10;
/** Khoảng cách dọc tối thiểu giữa hai nhãn giá trị cuối kỳ của hai chuỗi. */
/**
 * UAT TC_UI_16: 11 đơn vị viewBox ≈ 10,6px hiển thị — bằng đúng cỡ chữ 10px
 * nên hai nhãn kề nhau chạm mép ("2/0/0" dính chồng ở mép phải). 14 đơn vị
 * cho ~3,5px không khí giữa hai nhãn.
 */
const END_LABEL_MIN_GAP = 14;

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

const at = (value: number) => value.toFixed(1);

function xOf(index: number, count: number): number {
  if (count <= 1) return PLOT_LEFT;
  return PLOT_LEFT + ((PLOT_RIGHT - PLOT_LEFT) * index) / (count - 1);
}

function yOf(value: number, max: number): number {
  if (max <= 0) return PLOT_BOTTOM;
  const ratio = Math.min(Math.max(value / max, 0), 1);
  return PLOT_BOTTOM - ratio * (PLOT_BOTTOM - PLOT_TOP);
}

function linePath(values: number[], max: number): string {
  return values
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${at(xOf(index, values.length))},${at(yOf(value, max))}`,
    )
    .join(" ");
}

/**
 * Vùng tô của biểu đồ tồn cuối: đi hết đường rồi kéo xuống đáy ở điểm cuối và
 * quay về đáy ở điểm đầu — đúng chuỗi `d` mà mockup xuất ra.
 */
function areaPath(values: number[], max: number): string {
  if (values.length === 0) return "";
  const last = xOf(values.length - 1, values.length);
  const first = xOf(0, values.length);
  return `${linePath(values, max)} L${at(last)},${PLOT_BOTTOM} L${at(first)},${PLOT_BOTTOM} Z`;
}

/**
 * Giãn các nhãn giá trị cuối kỳ ra khỏi nhau.
 *
 * Hai chuỗi có giá trị cuối gần bằng nhau (vd "5" và "0" khi cả hai đều thấp)
 * thì hai nhãn rơi vào cùng một chỗ và chồng chữ lên nhau. Xếp theo y rồi đẩy
 * dần xuống cho đủ khoảng cách tối thiểu, sau đó kéo cả cụm về trong khung.
 */
function spreadEndLabels(rawY: number[]): number[] {
  const order = rawY
    .map((y, index) => ({ y, index }))
    .sort((left, right) => left.y - right.y);
  const resolved = [...rawY];
  let previous = Number.NEGATIVE_INFINITY;
  for (const item of order) {
    const y = Math.max(item.y, previous + END_LABEL_MIN_GAP);
    resolved[item.index] = y;
    previous = y;
  }
  // Đẩy xuống có thể vượt đáy khung; kéo cả cụm lên lại đúng phần thừa.
  const overflow = Math.max(...resolved, PLOT_BOTTOM) - PLOT_BOTTOM;
  if (overflow <= 0) return resolved;
  return resolved.map((y) => Math.max(PLOT_TOP + AXIS_FONT_SIZE, y - overflow));
}

export type FlowChartProps = {
  /** Nhãn trục X — một nhãn cho mỗi điểm. */
  labels: string[];
  series: ChartSeries[];
  /** Tô vùng dưới đường (chỉ biểu đồ "Xu hướng tồn cuối ngày" của mockup). */
  filled?: boolean;
  /** id của `<linearGradient>` — phải duy nhất trong trang. */
  gradientId?: string;
  /** Nhãn giá trị điểm cuối: trên đường (luồng) hay dưới đường (tồn cuối). */
  labelBelow?: boolean;
  /** Bề dày nét vẽ: 2.6 ở biểu đồ luồng, 3 ở biểu đồ tồn cuối. */
  strokeWidth?: number;
  ariaLabel: string;
};

export function InventoryFlowChart({
  labels,
  series,
  filled = false,
  gradientId,
  labelBelow = false,
  strokeWidth = 2.6,
  ariaLabel,
}: FlowChartProps) {
  const count = labels.length;
  const max = series.reduce(
    (highest, item) =>
      item.values.reduce(
        (inner, value) => (value > inner ? value : inner),
        highest,
      ),
    0,
  );

  const density = fitAxisDensity({
    count,
    plotWidth: PLOT_RIGHT - PLOT_LEFT,
    labelChars: longestLabelChars(labels),
    fontSize: AXIS_FONT_SIZE,
    markerRadius: POINT_RADIUS,
  });

  // Vị trí nhãn giá trị cuối kỳ của TỪNG chuỗi, đã giãn để không đè nhau.
  const endLabelY = spreadEndLabels(
    series.map((item) => {
      const points = item.values.slice(0, count);
      if (points.length === 0) return PLOT_BOTTOM;
      const y = yOf(points[points.length - 1], max);
      return labelBelow ? y + 10 : y - 8;
    }),
  );

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label={ariaLabel}
    >
      {filled && gradientId !== undefined && series.length > 0 ? (
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0"
              style={{ stopColor: series[0].color, stopOpacity: 0.24 }}
            />
            <stop
              offset="1"
              style={{ stopColor: series[0].color, stopOpacity: 0.02 }}
            />
          </linearGradient>
        </defs>
      ) : null}

      {Array.from({ length: GRID_STEPS + 1 }, (_, index) => {
        const y = PLOT_TOP + ((PLOT_BOTTOM - PLOT_TOP) * index) / GRID_STEPS;
        const value = (max * (GRID_STEPS - index)) / GRID_STEPS;
        return (
          <g key={`grid-${index}`}>
            <line
              className="chart-grid-line"
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={at(y)}
              y2={at(y)}
            />
            <text
              className="chart-axis-label"
              x={AXIS_LABEL_X}
              y={at(y + AXIS_LABEL_DY)}
              textAnchor="end"
            >
              {fmt(value)}
            </text>
          </g>
        );
      })}

      {series.map((item, seriesIndex) => {
        const points = item.values.slice(0, count);
        if (points.length === 0) return null;
        const lastIndex = points.length - 1;
        const lastX = xOf(lastIndex, points.length);
        const lastY = yOf(points[lastIndex], max);
        return (
          <g
            key={item.key}
            style={{ "--series-color": item.color } as CSSProperties}
          >
            {filled && gradientId !== undefined ? (
              <path d={areaPath(points, max)} fill={`url(#${gradientId})`} />
            ) : null}
            <path
              className="chart-line"
              d={linePath(points, max)}
              strokeWidth={at(strokeWidth * density.strokeScale)}
            />
            {density.showMarkers ? (
              points.map((value, index) => (
                <circle
                  key={`${item.key}-${index}`}
                  className="chart-point"
                  cx={at(xOf(index, points.length))}
                  cy={at(yOf(value, max))}
                  r={at(density.markerRadius)}
                />
              ))
            ) : (
              /* Kỳ dài: chấm dính thành dải đặc che mất chính đường xu hướng —
               * chỉ giữ chấm ở điểm cuối để mắt bắt được mốc gần nhất. */
              <circle
                className="chart-point"
                cx={at(lastX)}
                cy={at(lastY)}
                r={at(POINT_RADIUS)}
              />
            )}
            {/* Neo `end`: nhãn ở điểm cuối nằm sát mép phải khung, neo mặc định
             * (`start`) làm số dài bị cắt cụt. */}
            <text
              className="chart-point-label"
              x={at(lastX)}
              y={at(endLabelY[seriesIndex] ?? lastY)}
              textAnchor="end"
            >
              {fmt(points[lastIndex])}
            </text>
          </g>
        );
      })}

      {labels.map((label, index) =>
        density.showLabel(index) ? (
          <text
            key={`axis-${label}-${index}`}
            className="chart-axis-label"
            x={at(xOf(index, count))}
            y={X_AXIS_LABEL_Y}
            textAnchor={
              index === 0 ? "start" : index === count - 1 ? "end" : "middle"
            }
          >
            {label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
