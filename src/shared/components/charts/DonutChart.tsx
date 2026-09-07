import { LazyApexChart as Chart } from "./LazyApexChart";
import type { ApexOptions } from "apexcharts";
import {
  useChartBaseOptions,
  CATEGORICAL_PALETTE,
  chartPointEvents,
} from "./chart-theme";
import { useT } from "@/shared/i18n/useT";

export type DonutChartItem = {
  label: string;
  value: number;
  color?: string;
};

export type DonutChartProps = {
  items: DonutChartItem[];
  height?: number;
  /** Nhãn hiển thị giữa donut, vd "Tổng ca" — không tự suy diễn % hoàn thành. */
  centerLabel?: string;
  valueFormatter?: (value: number) => string;
  /** Tắt khi ghép với DonutBreakdown — bảng chi tiết bên cạnh đã thay thế chú giải. */
  legend?: boolean;
  /** Nhấn vào một lát để xem chi tiết nhóm đó. */
  onSelect?: (item: DonutChartItem, index: number) => void;
};

export function DonutChart({
  items,
  height = 230,
  centerLabel,
  valueFormatter,
  legend = true,
  onSelect,
}: DonutChartProps) {
  const t = useT();
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const format = (value: number) => valueFormatter?.(value) ?? String(value);

  const baseChartOptions = useChartBaseOptions();

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: {
      ...baseChartOptions.chart,
      type: "donut",
      // Chỉ CHÈN key `events` khi thật sự có handler. Đặt `events: undefined`
      // sẽ ghi đè object mặc định của ApexCharts bằng undefined và chart im lặng
      // không mount (không ném lỗi, chỉ mất hẳn khỏi màn hình).
      ...chartPointEvents(
        onSelect
          ? (point) => {
              const item = items[point.dataPointIndex];
              if (item) onSelect(item, point.dataPointIndex);
            }
          : undefined,
      ),
    },
    labels: items.map((item) => item.label),
    colors: items.map(
      (item, index) =>
        item.color ?? CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length],
    ),
    legend: {
      show: legend,
      position: "bottom",
      fontSize: "12px",
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      ...baseChartOptions.tooltip,
      y: { formatter: format },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: centerLabel ?? t("shared.charts.total"),
              formatter: () => format(total),
            },
            value: {
              formatter: (value: string) => format(Number(value)),
            },
          },
        },
      },
    },
  };

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      {/* width số (không phải "100%") vì ApexCharts đo container tại thời
       * điểm mount — trong lưới CSS grid co giãn, phép đo đó có thể chạy
       * trước khi layout ổn định và ra một canvas hẹp bất thường. */}
      <Chart
        options={options}
        series={items.map((item) => item.value)}
        type="donut"
        width={340}
        height={height}
      />
    </div>
  );
}
