import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { baseChartOptions, CATEGORICAL_PALETTE } from "./chart-theme";

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

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: "bar" },
    plotOptions: {
      bar: {
        distributed,
        borderRadius: 6,
        borderRadiusApplication: "end",
        columnWidth: series.length > 1 ? "55%" : "45%",
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (value: number) => valueFormatter?.(value) ?? String(value),
      style: { fontSize: "12px", fontWeight: 700 },
      offsetY: -20,
    },
    colors,
    xaxis: {
      categories,
      labels: { style: { fontSize: "12px" } },
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
    <Chart
      options={options}
      series={series.map((item) => ({ name: item.name, data: item.data }))}
      type="bar"
      height={height}
    />
  );
}
