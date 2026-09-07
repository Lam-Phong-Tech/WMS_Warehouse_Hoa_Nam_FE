import { LazyApexChart as Chart } from "./LazyApexChart";
import type { ApexOptions } from "apexcharts";
import { useChartBaseOptions, CATEGORICAL_PALETTE } from "./chart-theme";
import { fitAxisDensity, longestLabelChars } from "./axis-density";
import { apexPlotWidth, useChartWidth } from "./use-chart-width";

/** Cỡ chữ nhãn trục X đang đặt trong `options.xaxis.labels.style`. */
const AXIS_FONT_SIZE = 12;

export type BarChartSeries = {
  name: string;
  data: number[];
  color?: string;
};

export type BarChartProps = {
  categories: string[];
  series: BarChartSeries[];
  height?: number;
  /** Mỗi cột 1 màu riêng theo CATEGORICAL_PALETTE — chỉ dùng khi có đúng 1 series. */
  distributed?: boolean;
  valueFormatter?: (value: number) => string;
};

/** Column chart dùng chung cho các biểu đồ so sánh nhiều nhóm (vd 4 metric vận hành). */
export function BarChart({
  categories,
  series,
  height = 260,
  distributed = false,
  valueFormatter,
}: BarChartProps) {
  const colors =
    distributed && series.length === 1
      ? categories.map(
          (_, index) => CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
        )
      : series.map(
          (item, index) =>
            item.color ??
            CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
        );

  const baseChartOptions = useChartBaseOptions();

  /*
   * Trục HẠNG MỤC: giấu bớt nhãn ở đây là giấu mất tên của chính cột đang vẽ,
   * nên thứ tự xử lý ngược với chart xu hướng — nghiêng nhãn 45° trước (sức
   * chứa tăng ~3 lần), chỉ khi vẫn không đủ mới thưa nhãn.
   */
  const { ref, width } = useChartWidth();
  const plotWidth = apexPlotWidth(width);
  const labelChars = longestLabelChars(categories);
  const flat = fitAxisDensity({
    count: categories.length,
    plotWidth,
    labelChars,
    fontSize: AXIS_FONT_SIZE,
  });
  const rotated = flat.stride > 1;
  const density = rotated
    ? fitAxisDensity({
        count: categories.length,
        plotWidth,
        labelChars,
        fontSize: AXIS_FONT_SIZE,
        rotateDegrees: 45,
      })
    : flat;

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: "bar" },
    plotOptions: {
      bar: {
        distributed,
        borderRadius: 6,
        borderRadiusApplication: "end",
        columnWidth:
          categories.length > 20 ? "88%" : series.length > 1 ? "55%" : "45%",
      },
    },
    dataLabels: {
      // Nhiều cột thì số trên đầu cột chồng lên nhau thành một hàng chữ dính —
      // giá trị đã có trong tooltip và bảng dữ liệu.
      enabled: density.showPointValues,
      formatter: (value: number) => valueFormatter?.(value) ?? String(value),
      style: { fontSize: "12px", fontWeight: 700 },
      offsetY: -20,
    },
    colors,
    xaxis: {
      categories,
      labels: {
        style: { fontSize: `${AXIS_FONT_SIZE}px` },
        hideOverlappingLabels: true,
        rotate: rotated ? -45 : 0,
        rotateAlways: rotated,
        trim: rotated,
        maxHeight: 96,
      },
      tickAmount:
        density.stride > 1
          ? Math.max(2, Math.min(categories.length - 1, density.maxLabels - 1))
          : undefined,
    },
    yaxis: {
      labels: {
        formatter: (value: number) => valueFormatter?.(value) ?? String(value),
      },
    },
    legend: { show: series.length > 1 },
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
        series={series.map((item) => ({ name: item.name, data: item.data }))}
        type="bar"
        height={height}
      />
    </div>
  );
}
