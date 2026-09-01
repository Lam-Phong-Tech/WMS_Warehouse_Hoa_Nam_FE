import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  useChartBaseOptions,
  CATEGORICAL_PALETTE,
  chartPointEvents,
} from "./chart-theme";

export type LineChartSeries = {
  name: string;
  data: number[];
  color?: string;
};

export type LineChartProps = {
  categories: string[];
  series: LineChartSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
  /**
   * Nhấn vào một điểm để drill-down xuống danh sách của đúng mốc + chuỗi đó
   * (vd chuỗi "Quá hạn" tại ngày 12/08 → mở danh sách hồ sơ quá hạn ngày đó).
   */
  onSelect?: (payload: {
    category: string;
    categoryIndex: number;
    seriesName: string;
    seriesIndex: number;
    value: number;
  }) => void;
};

/**
 * Line nhiều chuỗi — dùng cho xu hướng theo thời gian khi số mốc đã nhiều tới mức
 * cột chồng lên nhau (từ mốc "tháng" trở lên). `AreaChart` chỉ vẽ được 1 chuỗi nên
 * không thay thế được ở các chart so sánh nhiều chiều.
 *
 * Marker tắt khi chuỗi dài: trên 60 điểm thì chấm tròn dính vào nhau thành một dải
 * đặc, che mất chính đường xu hướng mà chart này tồn tại để thể hiện.
 */
export function LineChart({
  categories,
  series,
  height = 280,
  valueFormatter,
  onSelect,
}: LineChartProps) {
  const dense = categories.length > 60;
  const format = (value: number) => valueFormatter?.(value) ?? String(value);

  const baseChartOptions = useChartBaseOptions();

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: {
      ...baseChartOptions.chart,
      type: "line",
      // Chỉ CHÈN `events` khi có handler — đặt `events: undefined` sẽ ghi đè
      // object mặc định của ApexCharts và chart im lặng không mount.
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
        "markerClick",
      ),
    },
    stroke: { curve: "smooth", width: 3 },
    markers: {
      // Có drill-down thì marker phải luôn hiện: điểm dữ liệu chính là vùng
      // bấm được, ẩn đi thì người dùng không biết chỗ nào bấm được.
      size: dense && !onSelect ? 0 : 4,
      strokeWidth: 2,
      hover: { size: 7 },
    },
    colors: series.map(
      (item, index) =>
        item.color ?? CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
    ),
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: {
        style: { fontSize: "12px" },
        // Trục dày đặc thì để ApexCharts tự giãn nhãn thay vì in đè lên nhau.
        hideOverlappingLabels: true,
        rotate: dense ? -45 : 0,
      },
      tickAmount: dense ? 12 : undefined,
    },
    yaxis: { labels: { formatter: format } },
    legend: { show: series.length > 1, position: "top", fontSize: "12px" },
    tooltip: { ...baseChartOptions.tooltip, y: { formatter: format } },
  };

  return (
    <Chart
      options={options}
      series={series.map((item) => ({ name: item.name, data: item.data }))}
      type="line"
      height={height}
    />
  );
}
