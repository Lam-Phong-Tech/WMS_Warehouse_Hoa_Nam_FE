import type { ApexChart } from "apexcharts";
import { SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui/tokens";

/**
 * Bảng màu chart lấy từ canonical tokens (@/shared/ui/tokens) — cùng nguồn với
 * antd/MUI adapter để chart đồng bộ UI. `violet` là tông mở rộng cho
 * categorical >6 nhóm, dùng primary-dark cùng dải tím Vuexy.
 */
export const CHART_COLORS = {
  primary: S.primary,
  secondary: S.secondary,
  success: S.success,
  warning: S.warning,
  danger: S.error,
  info: S.info,
  violet: S.primaryDark,
  /**
   * Tông đậm cùng sắc — dùng khi một chart có các cặp chuỗi "cùng loại, khác
   * chiều phụ" (vd Nhập sản phẩm / Nhập linh kiện). Cùng sắc để mắt đọc được
   * nhóm trước, khác độ đậm để phân biệt thành viên trong nhóm.
   *
   * Dùng token *Text (không phải *Dark): greenDark chỉ tối hơn green ~5% nên hai
   * cột cạnh nhau nhìn như cùng một màu, đúng thứ mà cặp màu này sinh ra để tránh.
   */
  successDeep: S.successText,
  warningDeep: S.warningText,
} as const;

export const CATEGORICAL_PALETTE: string[] = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.info,
  CHART_COLORS.danger,
  CHART_COLORS.violet,
  CHART_COLORS.secondary,
];

export const CHART_FONT_FAMILY = TYPOGRAPHY.fontFamily;

export const baseChartOptions = {
  chart: {
    fontFamily: CHART_FONT_FAMILY,
    toolbar: { show: false },
    foreColor: S.textMedium,
  },
  grid: {
    borderColor: S.divider,
    strokeDashArray: 4,
  },
  tooltip: {
    theme: "light" as const,
  },
};

/** Chỉ số điểm dữ liệu ApexCharts trả về trong các callback tương tác. */
export type ChartPointRef = {
  seriesIndex: number;
  dataPointIndex: number;
};

type ApexChartEvents = NonNullable<ApexChart["events"]>;

/**
 * Bọc handler click điểm dữ liệu thành `chart.events` đúng kiểu ApexCharts.
 *
 * Typing của apexcharts khai callback là `(e, chart?, options?)` với `options`
 * kiểu `ApexChartEventOpts`, còn thứ runtime thực sự truyền vào là object có
 * `seriesIndex`/`dataPointIndex`. Viết thẳng chữ ký hẹp tại chỗ gọi sẽ đỏ
 * typecheck, nên quy về MỘT lối vào đã kiểm soát ở đây thay vì rải ép kiểu
 * khắp các chart.
 *
 * `events` chỉ được CHÈN khi thật sự có handler — đặt `events: undefined` sẽ
 * ghi đè object mặc định của ApexCharts và chart im lặng không mount.
 */
export function chartPointEvents(
  handler: ((point: ChartPointRef) => void) | undefined,
  eventName: "dataPointSelection" | "markerClick" = "dataPointSelection",
): { events?: ApexChartEvents } {
  if (!handler) return {};
  const listener = (_event: unknown, _chart: unknown, options: unknown) => {
    const point = options as ChartPointRef | undefined;
    if (!point || typeof point.dataPointIndex !== "number") return;
    handler(point);
  };
  return { events: { [eventName]: listener } as unknown as ApexChartEvents };
}
