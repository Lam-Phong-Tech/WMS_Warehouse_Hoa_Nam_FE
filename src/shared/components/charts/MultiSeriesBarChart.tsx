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
  const resolvedHeight =
    height ?? (horizontal ? Math.max(240, categories.length * 32 + 80) : 300);

  /*
   * Ở dạng cột dọc, trục X là trục hạng mục/thời gian và là chỗ vỡ giao diện
   * khi người dùng chọn kỳ dài: nhãn ngày chồng khít lên nhau, số trên đầu cột
   * dính thành một hàng chữ. Nghiêng nhãn 45° trước (giữ được nhiều mốc nhất),
   * chỉ khi vẫn không đủ chỗ mới thưa nhãn.
   *
   * Dạng NGANG không đi qua đây: nhãn hạng mục nằm ở trục Y, mỗi nhãn một dòng
   * riêng nên không có chuyện chồng chữ; chiều cao đã giãn theo số dòng.
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
  const rotated = !horizontal && flat.stride > 1;
  const density = rotated
    ? fitAxisDensity({
        count: categories.length,
        plotWidth,
        labelChars,
        fontSize: AXIS_FONT_SIZE,
        rotateDegrees: 45,
      })
    : flat;
  const dense = !horizontal && (rotated || categories.length > 14);
  // Dạng ngang xếp mỗi hạng mục một DÒNG, nên chỗ cho nhãn số phụ thuộc chiều
  // cao chứ không phải bề rộng — giữ nguyên ngưỡng theo số dòng như trước.
  const labelsOn =
    showValues ??
    (horizontal
      ? categories.length <= 14 && series.length <= 3
      : !dense && density.showPointValues && series.length <= 3);

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
        // Kỳ dài: để cột thở 68% thì mỗi cột chỉ còn vài phần mười pixel và
        // biểu đồ biến thành một dải màu đứt quãng. Dồn sát để cụm cột của mỗi
        // mốc còn đọc được thành một khối.
        columnWidth: dense ? "92%" : series.length > 1 ? "68%" : "45%",
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
        style: { fontSize: `${AXIS_FONT_SIZE}px` },
        hideOverlappingLabels: true,
        rotate: rotated ? -45 : 0,
        rotateAlways: rotated,
        trim: rotated,
        maxHeight: 96,
        formatter: horizontal
          ? (value: string) => format(Number(value))
          : undefined,
      },
      // Số KHOẢNG chứ không phải số nhãn — n nhãn thì n−1 khoảng.
      tickAmount:
        !horizontal && density.stride > 1
          ? Math.max(2, Math.min(categories.length - 1, density.maxLabels - 1))
          : undefined,
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
    <div ref={ref}>
      <Chart
        options={options}
        series={series.map((item) => ({ name: item.name, data: item.data }))}
        type="bar"
        height={resolvedHeight}
      />
    </div>
  );
}
