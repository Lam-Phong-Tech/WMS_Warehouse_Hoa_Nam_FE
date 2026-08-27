import { BRAND } from "@/app/theme";

/**
 * Bảng màu chart suy ra từ BRAND (src/app/theme.ts) để đồng bộ với UI hiện có
 * (antd + MUI đều map từ BRAND). Chỉ thêm 2 tông bổ trợ (info/violet) không có
 * sẵn trong BRAND, dùng khi cần nhiều hơn 4 nhóm màu (categorical).
 */
export const CHART_COLORS = {
  primary: BRAND.primary,
  secondary: BRAND.accentBorder,
  success: BRAND.success,
  warning: BRAND.warning,
  danger: BRAND.danger,
  info: "#0891b2",
  violet: "#7c3aed",
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

export const CHART_FONT_FAMILY = "Arial, Helvetica, sans-serif";

export const baseChartOptions = {
  chart: {
    fontFamily: CHART_FONT_FAMILY,
    toolbar: { show: false },
    foreColor: BRAND.muted,
  },
  grid: {
    borderColor: BRAND.divider,
    strokeDashArray: 4,
  },
  tooltip: {
    theme: "light" as const,
  },
};
