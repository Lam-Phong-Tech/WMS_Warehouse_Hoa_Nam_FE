import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  useChartBaseOptions,
  CATEGORICAL_PALETTE,
  chartPointEvents,
} from "./chart-theme";

export type MultiSeriesBarSeries = {
  name: string;
  data: number[];
  color?: string;
};

export type MultiSeriesBarChartProps = {
  categories: string[];
  series: MultiSeriesBarSeries[];
  /** true = các chuỗi chồng lên nhau (cơ cấu); false = đứng cạnh nhau (so sánh). */
  stacked?: boolean;
  /** true = thanh nằm ngang (nhãn category dài, vd tên SKU / nơi nhận). */
  horizontal?: boolean;
  height?: number;
  valueFormatter?: (value: number) => string;
  /** Bật nhãn số trên thân cột. Mặc định tắt khi có nhiều mốc để tránh chữ đè. */
  showValues?: boolean;
  /** Nhấn vào một cột → trả về mốc + chuỗi để mở drill-down. */
  onSelect?: (payload: {
    category: string;
    categoryIndex: number;
    seriesName: string;
    seriesIndex: number;
    value: number;
  }) => void;
};

/**
 * Column/Bar nhiều chuỗi dùng chung cho mọi biểu đồ "so sánh nhiều chiều" của
 * trang Báo cáo vận hành: grouped column theo ngày, stacked column kết quả
 * import/in ấn, stacked bar cơ cấu theo nơi nhận, grouped horizontal bar đối
 * soát Balance ↔ Movement.
 *
 * `BarChart` hiện có chỉ vẽ được cột dọc, không stack và không nhận click nên
 * không phủ được các ca trên; gộp về một component thay vì nhân bản bốn biến
 * thể gần giống nhau.
 */
export function MultiSeriesBarChart({
  categories,
  series,
  stacked = false,
  horizontal = false,
  height,
  valueFormatter,
  showValues,
  onSelect,
}: MultiSeriesBarChartProps) {
  const format = (value: number) => valueFormatter?.(value) ?? String(value);
  const dense = categories.length > 14;
  const resolvedHeight =
    height ?? (horizontal ? Math.max(240, categories.length * 32 + 80) : 300);
  const labelsOn = showValues ?? (!dense && series.length <= 3);

  const baseChartOptions = useChartBaseOptions();

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: {
      ...baseChartOptions.chart,
      type: "bar",
      stacked,
      // Chỉ CHÈN `events` khi có handler (đặt undefined làm chart không mount).
      ...chartPointEvents(
        onSelect
          ? (point) => {
              const item = series[point.seriesIndex];
              const category = categories[point.dataPointIndex];
              if (!item || category === undefined) return;
              onSelect({
                category,
                categoryIndex: point.dataPointIndex,
                seriesName: item.name,
                seriesIndex: point.seriesIndex,
                value: item.data[point.dataPointIndex] ?? 0,
              });
            }
          : undefined,
      ),
    },
    plotOptions: {
      bar: {
        horizontal,
        borderRadius: 4,
        borderRadiusApplication: stacked ? "end" : "end",
        columnWidth: series.length > 1 ? "68%" : "45%",
        barHeight: "62%",
      },
    },
    colors: series.map(
      (item, index) =>
        item.color ?? CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
    ),
    dataLabels: {
      enabled: labelsOn,
      // Cột 0 mà vẫn in "0" thì hàng nhãn dày đặc số vô nghĩa — ẩn hẳn.
      formatter: (value: number) => (value ? format(value) : ""),
      style: { fontSize: "11px", fontWeight: 700 },
    },
    xaxis: {
      categories,
      labels: {
        style: { fontSize: "12px" },
        hideOverlappingLabels: true,
        rotate: !horizontal && dense ? -45 : 0,
        formatter: horizontal
          ? (value: string) => format(Number(value))
          : undefined,
      },
      tickPlacement: "on",
    },
    yaxis: {
      labels: {
        formatter: (value: number) =>
          horizontal ? String(value) : format(value),
      },
    },
    legend: {
      show: series.length > 1,
      position: "top",
      horizontalAlign: "left",
      fontSize: "12px",
    },
    tooltip: {
      ...baseChartOptions.tooltip,
      shared: true,
      intersect: false,
      y: { formatter: (value: number) => format(value) },
    },
  };

  return (
    <Chart
      options={options}
      series={series.map((item) => ({ name: item.name, data: item.data }))}
      type="bar"
      height={resolvedHeight}
    />
  );
}
