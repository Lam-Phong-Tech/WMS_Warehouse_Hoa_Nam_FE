/**
 * SEMANTIC (light) — hợp đồng token ngữ nghĩa của design system.
 *
 * Đây là bề mặt mà adapter (antd/MUI/CSS vars) và component được phép đọc.
 * Mọi giá trị đều dẫn xuất từ primitives — không literal mới ở đây.
 */
import { COLOR, INK_RGB, OPACITY, SHADOW, inkAlpha } from "./primitives";

const soft = (rgb: string) => `rgba(${rgb}, ${OPACITY.soft})`;

export const SEMANTIC_LIGHT = {
  // --- Brand -----------------------------------------------------------
  primary: COLOR.purple,
  primaryDark: COLOR.purpleDark,
  primaryLight: COLOR.purpleLight,
  primarySoft: soft("115, 103, 240"),
  onPrimary: COLOR.white,

  secondary: COLOR.grey,
  secondaryDark: COLOR.greyDark,
  secondarySoft: soft("128, 131, 144"),

  // --- Semantic --------------------------------------------------------
  success: COLOR.green,
  successDark: COLOR.greenDark,
  successSoft: soft("40, 199, 111"),
  successText: COLOR.greenText,

  warning: COLOR.orange,
  warningDark: COLOR.orangeDark,
  warningSoft: soft("255, 159, 67"),
  warningText: COLOR.orangeText,

  error: COLOR.red,
  errorDark: COLOR.redDark,
  errorSoft: soft("255, 76, 81"),
  errorText: COLOR.redText,

  info: COLOR.cyan,
  infoDark: COLOR.cyanDark,
  infoSoft: soft("0, 186, 209"),
  infoText: COLOR.cyanText,

  // --- Surface / nền ---------------------------------------------------
  bgCanvas: COLOR.canvas,
  bgSurface: COLOR.white,
  /** nền phụ trong surface (table head, khối nhấn nhẹ) */
  bgSubtle: COLOR.canvas,

  // --- Chữ --------------------------------------------------------------
  inkRgb: INK_RGB,
  textStrong: COLOR.ink,
  textHigh: inkAlpha(OPACITY.highEmphasis),
  textMedium: inkAlpha(OPACITY.mediumEmphasis),
  textDisabled: inkAlpha(OPACITY.disabled),

  // --- Viền / focus -----------------------------------------------------
  border: inkAlpha(OPACITY.border),
  borderInput: inkAlpha(OPACITY.inputBorder),
  divider: inkAlpha(OPACITY.border),
  focusRing: `0 0 0 3px rgba(115, 103, 240, 0.22)`,

  // --- Bóng -------------------------------------------------------------
  shadowCard: SHADOW.card,
  shadowFloating: SHADOW.floating,

  // --- Xám --------------------------------------------------------------
  grey100: COLOR.grey100,
  grey200: COLOR.grey200,
  grey300: COLOR.grey300,
  grey500: COLOR.grey500,
} as const;

export type SemanticTokens = typeof SEMANTIC_LIGHT;
