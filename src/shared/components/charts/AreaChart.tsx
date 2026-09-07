import { LazyApexChart as Chart } from "./LazyApexChart";
import type { ApexOptions } from "apexcharts";
import { useChartBaseOptions, CHART_COLORS } from "./chart-theme";
import { useT } from "@/shared/i18n/useT";
import { fitAxisDensity, longestLabelChars } from "./axis-density";
import { apexPlotWidth, useChartWidth } from "./use-chart-width";

/** Cỡ chữ nhãn trục X đang đặt trong `options.xaxis.labels.style`. */
const AXIS_FONT_SIZE = 12;

export type AreaChartProps = {
  categories: string[];
  /** Dữ liệu 1 chuỗi — dùng cho chart xu hướng (vd tồn cuối theo ngày). */
  data: number[];
  name?: string;
  height?: number;
  color?: string;
  valueFormatter?: (value: number) => string;
};

/** Line + gradient fill — dùng cho chart xu hướng theo thời gian (tồn cuối, xu hướng ca...). */
export function AreaChart({
  categories,
  data,
  name,
  height = 260,
  color = CHART_COLORS.primary,
  valueFormatter,
}: AreaChartProps) {
  const t = useT();
  const seriesName = name ?? t("shared.charts.value");
  const baseChartOptions = useChartBaseOptions();

  // Kỳ dài (30 / 90 / 365 ngày) có nhiều mốc hơn số nhãn mà khung chứa nổi;
  // vẽ đủ nhãn thì trục X thành một vệt chữ chồng nhau. Xem `axis-density`.
  const { ref, width } = useChartWidth();
  const density = fitAxisDensity({
    count: categories.length,
    plotWidth: apexPlotWidth(width),
    labelChars: longestLabelChars(categories),
    fontSize: AXIS_FONT_SIZE,
    markerRadius: 4,
  });
  const dense = density.stride > 1;

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: "area" },
    stroke: {
      // Spline trên chuỗi dày đặc vẽ ra các bướu không có trong dữ liệu.
      curve: dense ? "straight" : "smooth",
      width: Math.max(1.5, 3 * density.strokeScale),
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.02,
        stops: [0, 90, 100],
      },
    },
    markers: {
      size: density.showMarkers ? 4 : 0,
      strokeWidth: 2,
      hover: { size: 6 },
    },
    colors: [color],
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: {
        style: { fontSize: `${AXIS_FONT_SIZE}px` },
        hideOverlappingLabels: true,
        rotate: 0,
        rotateAlways: false,
        trim: false,
      },
      // Số KHOẢNG chứ không phải số nhãn — n nhãn thì n−1 khoảng.
      tickAmount: dense
        ? Math.max(2, Math.min(categories.length - 1, density.maxLabels - 1))
        : undefined,
    },
    yaxis: {
      labels: {
        formatter: (value: number) => valueFormatter?.(value) ?? String(value),
      },
    },
    tooltip: {
      ...baseChartOptions.tooltip,
      y: {
        formatter: (value: number) => valueFormatter?.(value) ?? String(value),
      },
    },
  };

  return (
    <div ref={ref}>
      <Chart
        options={options}
        series={[{ name: seriesName, data }]}
        type="area"
        height={height}
      />
    </div>
  );
}
