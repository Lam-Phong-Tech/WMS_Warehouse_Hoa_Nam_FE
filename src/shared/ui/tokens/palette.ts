/**
 * BẢNG MÀU THÔ theo chế độ hiển thị — nguồn của MỌI nơi cần một MÀU THẬT.
 *
 * Phân vai rõ ràng (đọc kỹ trước khi thêm chỗ dùng mới):
 *
 *  · `PALETTE.light` / `PALETTE.dark` — giá trị thô (#hex / rgba). Dùng ở nơi
 *    KHÔNG đi qua CSS: palette của MUI (`createTheme` phải parse được màu),
 *    bảng màu ApexCharts (Apex ghi thẳng vào thuộc tính `fill` của SVG, mà
 *    thuộc tính trình bày SVG KHÔNG phân giải `var()`), và các phép trộn màu
 *    bằng JS (`alpha`, `lighten`).
 *
 *  · `SEMANTIC_LIGHT` (semantic-light.ts) — mặt tiền CSS variable. Mọi `sx`,
 *    `styleOverrides` và CSS đọc từ đó để tự đổi theo `data-theme` mà không
 *    phải render lại.
 *
 * Nhánh `dark`: hue thương hiệu và semantic GIỮ NGUYÊN bảng Vuexy (tím/lục/cam/
 * đỏ/lam không đổi giữa hai chế độ); chỉ đảo tầng nền–chữ–viền và đổi nhóm chữ
 * `*Text` sang tông sáng vì trên nền tối chúng nằm trên nền soft TỐI.
 * Giá trị nền/chữ/bóng lấy đúng khối `html[data-theme="dark"]` của demo UI/UX
 * đã chốt (Other/Trang_Tong_Quan/assets/styles.css).
 */
import { COLOR, INK_RGB, OPACITY, SHADOW } from "./primitives";

export type ThemeModeName = "light" | "dark";

const softLight = (rgb: string) => `rgba(${rgb}, ${OPACITY.soft})`;
/** Nền soft trên nền tối phải đậm hơn mới đọc được — demo dùng 0.23. */
const DARK_SOFT_ALPHA = 0.23;
const softDark = (rgb: string) => `rgba(${rgb}, ${DARK_SOFT_ALPHA})`;

/** [ĐO demo dark] kênh RGB của màu mực chế độ tối #E7E3FC. */
export const INK_RGB_DARK = "231, 227, 252";

const inkAlphaDark = (alpha: number) => `rgba(${INK_RGB_DARK}, ${alpha})`;
const inkAlphaLight = (alpha: number) => `rgba(${INK_RGB}, ${alpha})`;

/** Sắc nền/chữ riêng của chế độ tối — chỉ tồn tại ở nhánh dark. */
const DARK = {
  canvas: "#25253C",
  surface: "#2F2F48",
  subtle: "#35354F",
  ink: "#E7E3FC",
  primaryDark: "#968CFF",
  secondaryDark: "#8F929E",
  greenText: "#70E6A7",
  orangeText: "#FFC27A",
  redText: "#FF8A8E",
  cyanText: "#5FDDEC",
  grey100: "#2B2B42",
  grey200: "#35354F",
  grey300: "#41415A",
  grey500: "#6E6E86",
  shadowCard: "0 3px 14px rgba(12, 12, 24, 0.32)",
  shadowFloating: "0 12px 32px rgba(12, 12, 24, 0.44)",
} as const;

const LIGHT_PALETTE = {
  primary: COLOR.purple,
  primaryDark: COLOR.purpleDark,
  primaryLight: COLOR.purpleLight,
  primarySoft: softLight("115, 103, 240"),
  onPrimary: COLOR.white,

  secondary: COLOR.grey,
  secondaryDark: COLOR.greyDark,
  secondarySoft: softLight("128, 131, 144"),

  success: COLOR.green,
  successDark: COLOR.greenDark,
  successSoft: softLight("40, 199, 111"),
  successText: COLOR.greenText,

  warning: COLOR.orange,
  warningDark: COLOR.orangeDark,
  warningSoft: softLight("255, 159, 67"),
  warningText: COLOR.orangeText,

  error: COLOR.red,
  errorDark: COLOR.redDark,
  errorSoft: softLight("255, 76, 81"),
  errorText: COLOR.redText,

  info: COLOR.cyan,
  infoDark: COLOR.cyanDark,
  infoSoft: softLight("0, 186, 209"),
  infoText: COLOR.cyanText,

  bgCanvas: COLOR.canvas,
  bgSurface: COLOR.white,
  bgSubtle: COLOR.canvas,

  inkRgb: INK_RGB,
  textStrong: COLOR.ink,
  textHigh: inkAlphaLight(OPACITY.highEmphasis),
  textMedium: inkAlphaLight(OPACITY.mediumEmphasis),
  textDisabled: inkAlphaLight(OPACITY.disabled),

  border: inkAlphaLight(OPACITY.border),
  borderInput: inkAlphaLight(OPACITY.inputBorder),
  divider: inkAlphaLight(OPACITY.border),
  focusRing: "0 0 0 3px rgba(115, 103, 240, 0.22)",

  shadowCard: SHADOW.card,
  shadowFloating: SHADOW.floating,

  grey100: COLOR.grey100,
  grey200: COLOR.grey200,
  grey300: COLOR.grey300,
  grey500: COLOR.grey500,
} as const;

const DARK_PALETTE: Record<keyof typeof LIGHT_PALETTE, string> = {
  primary: COLOR.purple,
  primaryDark: DARK.primaryDark,
  primaryLight: COLOR.purpleLight,
  primarySoft: softDark("115, 103, 240"),
  onPrimary: COLOR.white,

  secondary: COLOR.grey,
  secondaryDark: DARK.secondaryDark,
  secondarySoft: softDark("128, 131, 144"),

  success: COLOR.green,
  successDark: COLOR.greenDark,
  successSoft: softDark("40, 199, 111"),
  successText: DARK.greenText,

  warning: COLOR.orange,
  warningDark: COLOR.orangeDark,
  warningSoft: softDark("255, 159, 67"),
  warningText: DARK.orangeText,

  error: COLOR.red,
  errorDark: COLOR.redDark,
  errorSoft: softDark("255, 76, 81"),
  errorText: DARK.redText,

  info: COLOR.cyan,
  infoDark: COLOR.cyanDark,
  infoSoft: softDark("0, 186, 209"),
  infoText: DARK.cyanText,

  bgCanvas: DARK.canvas,
  bgSurface: DARK.surface,
  bgSubtle: DARK.subtle,

  inkRgb: INK_RGB_DARK,
  textStrong: DARK.ink,
  textHigh: inkAlphaDark(OPACITY.highEmphasis),
  textMedium: inkAlphaDark(0.68),
  textDisabled: inkAlphaDark(OPACITY.disabled),

  border: inkAlphaDark(OPACITY.border),
  borderInput: inkAlphaDark(OPACITY.inputBorder),
  divider: inkAlphaDark(OPACITY.border),
  focusRing: "0 0 0 3px rgba(115, 103, 240, 0.35)",

  shadowCard: DARK.shadowCard,
  shadowFloating: DARK.shadowFloating,

  grey100: DARK.grey100,
  grey200: DARK.grey200,
  grey300: DARK.grey300,
  grey500: DARK.grey500,
};

export const PALETTE: Record<ThemeModeName, Record<PaletteKey, string>> = {
  light: LIGHT_PALETTE,
  dark: DARK_PALETTE,
};

export type PaletteKey = keyof typeof LIGHT_PALETTE;

/**
 * Tên biến CSS của từng khoá — `primaryDark` ⇒ `--wms-primary-dark`,
 * `grey100` ⇒ `--wms-grey-100`. Dùng chung bởi mặt tiền semantic và bởi test
 * parity, nên đổi quy ước ở đây là đổi đồng bộ cả hai.
 */
export function cssVarNameOf(key: string): string {
  const kebab = key
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .toLowerCase();
  return `--wms-${kebab}`;
}

export const PALETTE_KEYS = Object.keys(LIGHT_PALETTE) as PaletteKey[];
