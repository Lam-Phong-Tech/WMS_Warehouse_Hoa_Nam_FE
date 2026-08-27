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
