import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { useChartBaseOptions, CATEGORICAL_PALETTE } from "./chart-theme";

export type StackedBarSegment = {
  label: string;
  value: number;
  color?: string;
};

export type StackedBarChartProps = {
  segments: StackedBarSegment[];
  height?: number;
  /** Nhãn của thanh (trục category). Mặc định rỗng vì thường chỉ có 1 thanh. */
  barLabel?: string;
  valueFormatter?: (value: number) => string;
};

/**
 * 100% stacked bar ngang — dùng cho "cơ cấu" (tỉ trọng các thành phần trong một
 * tổng), vd tồn kho theo trạng thái.
 *
 * Chọn 100% thay vì stacked thường vì câu hỏi nghiệp vụ ở đây là "bao nhiêu phần
 * trăm tồn đang không bán được", không phải "tổng tồn là bao nhiêu" — con số tuyệt
 * đối do bảng bên cạnh chịu trách nhiệm. Nằm ngang để nhãn trạng thái tiếng Việt
 * đọc được mà không phải xoay đầu.
 */
export function StackedBarChart({
  segments,
  height = 150,
  barLabel = "",
  valueFormatter,
}: StackedBarChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const format = (value: number) => valueFormatter?.(value) ?? String(value);

  const baseChartOptions = useChartBaseOptions();

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: {
      ...baseChartOptions.chart,
      type: "bar",
      stacked: true,
      stackType: "100%",
    },
    plotOptions: {
      bar: { horizontal: true, borderRadius: 4, barHeight: "46%" },
    },
    colors: segments.map(
      (segment, index) =>
        segment.color ??
        CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
    ),
    dataLabels: {
      enabled: true,
      // Đoạn quá hẹp thì % in ra sẽ tràn sang đoạn bên cạnh — ẩn dưới 8%.
      formatter: (value: number) =>
        typeof value === "number" && value >= 8 ? `${Math.round(value)}%` : "",
      style: { fontSize: "12px", fontWeight: 700 },
    },
    xaxis: {
      categories: [barLabel],
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { show: Boolean(barLabel) } },
    grid: { ...baseChartOptions.grid, show: false },
    legend: { show: true, position: "bottom", fontSize: "12px" },
    tooltip: {
      ...baseChartOptions.tooltip,
      // Tooltip phải trả về số TUYỆT ĐỐI: trục đã là %, nếu tooltip cũng chỉ có %
      // thì không chỗ nào trong chart đọc được lượng tồn thật.
      y: {
        formatter: (value: number) =>
          total > 0
            ? `${format(value)} (${Math.round((value / total) * 100)}%)`
            : format(value),
      },
    },
  };

  return (
    <Chart
      options={options}
      series={segments.map((segment) => ({
        name: segment.label,
        data: [segment.value],
      }))}
      type="bar"
      height={height}
    />
  );
}
