import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  useChartBaseOptions,
  CATEGORICAL_PALETTE,
  chartPointEvents,
} from "./chart-theme";
import { fitAxisDensity, longestLabelChars } from "./axis-density";
import { apexPlotWidth, useChartWidth } from "./use-chart-width";

/** Cỡ chữ nhãn trục X đang đặt trong `options.xaxis.labels.style`. */
const AXIS_FONT_SIZE = 12;

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
 * Marker tắt khi chuỗi dài: khi khoảng cách giữa hai điểm hẹp hơn đường kính chấm
 * thì chấm tròn dính vào nhau thành một dải đặc, che mất chính đường xu hướng mà
 * chart này tồn tại để thể hiện.
 *
 * Ngưỡng "dài" tính theo BỀ RỘNG THẬT của khung chứ không theo số điểm cố định:
 * cùng một kỳ 90 ngày, panel rộng trên desktop thì vừa, panel hẹp (tablet, hoặc
 * sau khi mở sidebar) thì nhãn chồng lên nhau. Xem `axis-density`.
 */
export function LineChart({
  categories,
  series,
  height = 280,
  valueFormatter,
  onSelect,
}: LineChartProps) {
  const { ref, width } = useChartWidth();
  const density = fitAxisDensity({
    count: categories.length,
    plotWidth: apexPlotWidth(width),
    labelChars: longestLabelChars(categories),
    fontSize: AXIS_FONT_SIZE,
    markerRadius: 4,
  });
  const dense = density.stride > 1;
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
    stroke: {
      // Nội suy "smooth" trên chuỗi dày đặc vẽ ra các bướu không có trong dữ
      // liệu (spline vọt qua điểm); kỳ dài dùng nét thẳng cho đúng số liệu.
      curve: dense ? "straight" : "smooth",
      width: Math.max(1.5, 3 * density.strokeScale),
    },
    markers: {
      // Có drill-down thì marker phải luôn hiện: điểm dữ liệu chính là vùng
      // bấm được, ẩn đi thì người dùng không biết chỗ nào bấm được — nhưng vẫn
      // co lại theo mật độ để không dính thành dải đặc.
      size: density.showMarkers ? 4 : onSelect ? 2 : 0,
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
        style: { fontSize: `${AXIS_FONT_SIZE}px` },
        // Chốt chặn cuối của ApexCharts; số nhãn đã được `tickAmount` ép về
        // mức vừa khung nên đây chỉ là lưới an toàn.
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
    yaxis: { labels: { formatter: format } },
    legend: { show: series.length > 1, position: "top", fontSize: "12px" },
    tooltip: { ...baseChartOptions.tooltip, y: { formatter: format } },
  };

  return (
    <div ref={ref}>
      <Chart
        options={options}
        series={series.map((item) => ({ name: item.name, data: item.data }))}
        type="line"
        height={height}
      />
    </div>
  );
}
