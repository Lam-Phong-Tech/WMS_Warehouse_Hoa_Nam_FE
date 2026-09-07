import { LazyApexChart as Chart } from "./LazyApexChart";
import type { ApexOptions } from "apexcharts";
import {
  useChartBaseOptions,
  chartPointEvents,
  CHART_COLORS,
} from "./chart-theme";
import { useT } from "@/shared/i18n/useT";

export type WaterfallPoint = {
  label: string;
  /**
   * Bậc trung gian: lượng CÓ DẤU cộng vào số dư đang chạy (nhập > 0, xuất < 0).
   * Cột mốc (`kind: "total"`): giá trị tuyệt đối, cột vẽ từ 0.
   */
  value: number;
  kind: "total" | "delta";
  /** Ghi chú hiện trong tooltip (vd công thức của bậc đó). */
  hint?: string;
};

export type WaterfallChartProps = {
  points: WaterfallPoint[];
  height?: number;
  valueFormatter?: (value: number) => string;
  /** Nhấn vào một bậc để mở danh sách movement/phiếu tạo ra số đó. */
  onSelect?: (point: WaterfallPoint, index: number) => void;
};

/**
 * Waterfall (cầu thang) — dùng cho phương trình cân đối một kỳ:
 * `Tồn đầu + Nhập − Xuất − Xuất linh kiện + Reversal = Tồn cuối`.
 *
 * Vẽ bằng `rangeBar` (mỗi cột là đoạn [from, to]) thay vì stack một series
 * "đệm" trong suốt: series đệm sẽ chiếm một mục trong chú giải và một dòng
 * trong tooltip mà người đọc không có cách nào hiểu được. rangeBar cho phép
 * đặt `fillColor` trên TỪNG điểm nên mỗi bậc tự mang màu ngữ nghĩa của nó
 * (mốc = xanh dương, tăng = xanh lá, giảm = cam) mà không cần tách series.
 */
export function WaterfallChart({
  points,
  height = 300,
  valueFormatter,
  onSelect,
}: WaterfallChartProps) {
  const t = useT();
  const format = (value: number) => valueFormatter?.(value) ?? String(value);

  // Vòng `for` thay vì `map` + biến cộng dồn bên ngoài: mỗi bậc phụ thuộc số dư
  // của bậc trước, và gán lại biến ngoài từ trong callback là thứ React Compiler
  // (react-hooks/immutability) chặn.
  const bars: Array<{
    x: string;
    y: [number, number];
    fillColor: string;
  }> = [];
  let running = 0;
  for (const point of points) {
    const from = point.kind === "total" ? 0 : running;
    const to = point.kind === "total" ? point.value : running + point.value;
    running = to;
    bars.push({
      x: point.label,
      y: [Math.min(from, to), Math.max(from, to)],
      fillColor:
        point.kind === "total"
          ? CHART_COLORS.primary
          : point.value >= 0
            ? CHART_COLORS.success
            : CHART_COLORS.warning,
    });
  }

  const baseChartOptions = useChartBaseOptions();

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: {
      ...baseChartOptions.chart,
      type: "rangeBar",
      // Chỉ CHÈN `events` khi thật sự có handler — đặt `events: undefined` sẽ
      // ghi đè object mặc định của ApexCharts và chart im lặng không mount.
      ...chartPointEvents(
        onSelect
          ? (ref) => {
              const point = points[ref.dataPointIndex];
              if (point) onSelect(point, ref.dataPointIndex);
            }
          : undefined,
      ),
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "52%",
        borderRadius: 4,
        rangeBarGroupRows: true,
      },
    },
    dataLabels: {
      enabled: true,
      // rangeBar trả [from, to]; nhãn phải là CON SỐ NGHIỆP VỤ của bậc đó
      // (delta có dấu, hoặc số dư với cột mốc), không phải chiều dài đoạn.
      formatter: (_value: string | number | number[], opts?: unknown) => {
        const index = (opts as { dataPointIndex?: number } | undefined)
          ?.dataPointIndex;
        const point = index === undefined ? undefined : points[index];
        if (!point) return "";
        return point.kind === "total"
          ? format(point.value)
          : `${point.value >= 0 ? "+" : "−"}${format(Math.abs(point.value))}`;
      },
      style: { fontSize: "12px", fontWeight: 700 },
    },
    xaxis: {
      labels: { style: { fontSize: "12px" }, hideOverlappingLabels: false },
    },
    yaxis: { labels: { formatter: (value: number) => format(value) } },
    legend: { show: false },
    tooltip: {
      ...baseChartOptions.tooltip,
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const point = points[dataPointIndex];
        if (!point) return "";
        const value =
          point.kind === "total"
            ? format(point.value)
            : `${point.value >= 0 ? "+" : "−"}${format(Math.abs(point.value))}`;
        const hint = point.hint ? `<div>${point.hint}</div>` : "";
        return `<div class="apexcharts-tooltip-title">${point.label}</div><div style="padding:6px 10px"><b>${value}</b>${hint}</div>`;
      },
    },
  };

  return (
    <Chart
      options={options}
      series={[{ name: t("shared.charts.balance"), data: bars }]}
      type="rangeBar"
      height={height}
    />
  );
}
