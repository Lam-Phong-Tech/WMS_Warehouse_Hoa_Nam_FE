import type { ApexChart } from "apexcharts";
import { PALETTE, TYPOGRAPHY } from "@/shared/ui/tokens";
import { useThemeStore } from "@/shared/ui/theme/theme.store";

/**
 * ApexCharts ghi màu THẲNG vào thuộc tính trình bày của SVG (`fill`, `stroke`),
 * mà thuộc tính trình bày KHÔNG phân giải `var()` — nên chart phải đọc màu thật
 * từ `PALETTE` chứ không dùng mặt tiền `SEMANTIC_LIGHT`.
 *
 * Hue thương hiệu/semantic giống nhau ở hai chế độ nên bảng màu chuỗi dùng
 * chung; chỉ nhóm trung tính (chữ trục, lưới, tooltip) mới đổi theo chế độ —
 * đó là việc của `useChartBaseOptions()` bên dưới.
 */
const S = PALETTE.light;

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

function chartBaseFor(mode: "light" | "dark") {
  const P = PALETTE[mode];
  return {
    chart: {
      fontFamily: CHART_FONT_FAMILY,
      toolbar: { show: false },
      foreColor: P.textMedium,
      background: "transparent",
    },
    grid: {
      borderColor: P.divider,
      strokeDashArray: 4,
    },
    tooltip: {
      theme: mode,
    },
  };
}

/**
 * Nền chart nằm dưới control của Apex chứ không phải CSS, nên chữ trục/lưới/
 * tooltip phải đổi theo chế độ ở tầng JS. Mọi chart dùng chung một lối vào này
 * để không màn nào tự chế nền riêng.
 */
export function useChartBaseOptions() {
  const mode = useThemeStore((state) => state.mode);
  return mode === "dark" ? CHART_BASE.dark : CHART_BASE.light;
}

const CHART_BASE = {
  light: chartBaseFor("light"),
  dark: chartBaseFor("dark"),
} as const;

/** @deprecated Dùng `useChartBaseOptions()` để chart theo được chế độ tối. */
export const baseChartOptions = CHART_BASE.light;

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
