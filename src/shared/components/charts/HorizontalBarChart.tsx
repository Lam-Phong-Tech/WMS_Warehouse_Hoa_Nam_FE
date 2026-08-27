import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { baseChartOptions, CHART_COLORS } from "./chart-theme";

export type HorizontalBarItem = {
  label: string;
  value: number;
};

export type HorizontalBarChartProps = {
  items: HorizontalBarItem[];
  /** Số dòng tối đa hiển thị, xếp theo value giảm dần. Mặc định 10. */
  limit?: number;
  height?: number;
  color?: string;
  valueFormatter?: (value: number) => string;
};

/** Horizontal ranked bar chart — dùng cho mọi "Top N" (bệnh/lỗi, nơi nhận, SKU...). */
export function HorizontalBarChart({
  items,
  limit = 10,
  height,
  color = CHART_COLORS.primary,
  valueFormatter,
}: HorizontalBarChartProps) {
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, limit);
  const resolvedHeight = height ?? Math.max(220, sorted.length * 34 + 40);

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: "bar" },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 5,
        borderRadiusApplication: "end",
        barHeight: "60%",
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (value: number) => valueFormatter?.(value) ?? String(value),
      style: { fontSize: "12px", fontWeight: 700 },
    },
    colors: [color],
    xaxis: {
      categories: sorted.map((item) => item.label),
      labels: {
        formatter: (value: string) => valueFormatter?.(Number(value)) ?? value,
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
    <Chart
      options={options}
      series={[{ name: "Giá trị", data: sorted.map((item) => item.value) }]}
      type="bar"
      height={resolvedHeight}
    />
  );
}
