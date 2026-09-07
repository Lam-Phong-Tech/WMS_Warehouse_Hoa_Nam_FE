import { LazyApexChart as Chart } from "./LazyApexChart";
import type { ApexOptions } from "apexcharts";
import {
  useChartBaseOptions,
  chartPointEvents,
  CHART_COLORS,
} from "./chart-theme";
import { useT } from "@/shared/i18n/useT";

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
  /**
   * Nhấn vào một cột để xem chi tiết. Nhận `item` đã sắp xếp/cắt trần, không phải
   * phần tử thứ i của `items` gốc — caller không cần tự lặp lại phép sort.
   */
  onSelect?: (item: HorizontalBarItem, index: number) => void;
};

/** Horizontal ranked bar chart — dùng cho mọi "Top N" (bệnh/lỗi, nơi nhận, SKU...). */
export function HorizontalBarChart({
  items,
  limit = 10,
  height,
  color = CHART_COLORS.primary,
  valueFormatter,
  onSelect,
}: HorizontalBarChartProps) {
  const t = useT();
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, limit);
  const resolvedHeight = height ?? Math.max(220, sorted.length * 34 + 40);

  const baseChartOptions = useChartBaseOptions();

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: {
      ...baseChartOptions.chart,
      type: "bar",
      // Chỉ CHÈN key `events` khi thật sự có handler. Đặt `events: undefined`
      // sẽ ghi đè object mặc định của ApexCharts bằng undefined và chart im lặng
      // không mount (không ném lỗi, chỉ mất hẳn khỏi màn hình).
      ...chartPointEvents(
        onSelect
          ? (point) => {
              const item = sorted[point.dataPointIndex];
              if (item) onSelect(item, point.dataPointIndex);
            }
          : undefined,
      ),
    },
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
      series={[
        {
          name: t("shared.charts.value"),
          data: sorted.map((item) => item.value),
        },
      ]}
      type="bar"
      height={resolvedHeight}
    />
  );
}
