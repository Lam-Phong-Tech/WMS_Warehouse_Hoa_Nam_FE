import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { baseChartOptions, CHART_COLORS } from "./chart-theme";

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
  name = "Giá trị",
  height = 260,
  color = CHART_COLORS.primary,
  valueFormatter,
}: AreaChartProps) {
  const options: ApexOptions = {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: "area" },
    stroke: { curve: "smooth", width: 3 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.02,
        stops: [0, 90, 100],
      },
    },
    markers: { size: 4, strokeWidth: 2, hover: { size: 6 } },
    colors: [color],
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: { style: { fontSize: "12px" } },
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
    <Chart
      options={options}
      series={[{ name, data }]}
      type="area"
      height={height}
    />
  );
}
