/**
 * PRIMITIVES — giá trị thô của design system Vuexy (DEC-UI-BASELINE-01).
 *
 * ĐÂY LÀ CANONICAL TOKEN SOURCE DUY NHẤT của dự án. Mọi theme (antd/MUI),
 * CSS variables (css-vars.css) và component đều phải đọc từ đây (trực tiếp
 * hoặc qua semantic/component tokens) — không nơi nào khác được khai báo
 * design literal mới (guard: `yarn ui:tokens`).
 *
 * Nguồn giá trị (ghi rõ để audit):
 * - [ĐO] đo computed style từ Vuexy Vuejs demo-1 ngày 2026-08-27
 *   (docs/ui/vuexy-sync/01-context-readiness.md §4 + DEC-UI-BASELINE-01).
 * - [X]  lấy từ spec "hệ X" của Mini App (docs/ui-system-x-vuexy.md) ở những
 *   điểm live demo không đo được và không mâu thuẫn số đo.
 * - [DX] suy ra từ quy ước Vuexy (tint/shade cùng dải) — chưa đo trực tiếp.
 */

/** Kênh RGB của màu mực Vuexy #2F2B3D — dùng cho mọi alpha-variant. [ĐO] */
export const INK_RGB = "47, 43, 61";

export const COLOR = {
  /** [ĐO] */
  white: "#FFFFFF",
  /** [ĐO] nền canvas toàn app */
  canvas: "#F8F7FA",
  /** [ĐO] màu mực đặc (100%) */
  ink: "#2F2B3D",

  /** [ĐO] primary + darken-1 */
  purple: "#7367F0",
  purpleDark: "#675DD8",
  /** [DX] tint ~40% về trắng của purple — viền/nhấn nhạt */
  purpleLight: "#ABA4F6",

  /** [ĐO] secondary + darken-1 */
  grey: "#808390",
  greyDark: "#737682",

  /** [ĐO] semantic + darken-1 */
  green: "#28C76F",
  greenDark: "#24B364",
  orange: "#FF9F43",
  orangeDark: "#E68F3C",
  red: "#FF4C51",
  redDark: "#E64449",
  cyan: "#00BAD1",
  cyanDark: "#00A7BC",

  /** [X] chữ đậm trên nền soft cùng tông — đã kiểm AA trong spec X */
  greenText: "#167A45",
  orangeText: "#98520E",
  redText: "#B52F3B",
  cyanText: "#087C90",

  /** [ĐO] thang xám Vuetify của demo */
  grey100: "#F5F5F5",
  grey200: "#EEEEEE",
  grey300: "#E0E0E0",
  grey500: "#9E9E9E",
} as const;

/** [ĐO] opacity hệ thống của Vuexy (đo --v-*-opacity) */
export const OPACITY = {
  highEmphasis: 0.9,
  mediumEmphasis: 0.7,
  disabled: 0.4,
  hover: 0.06,
  border: 0.12,
  /** [DX] viền input outlined — đậm hơn divider theo quy ước Vuexy */
  inputBorder: 0.22,
  /** [DX] nền soft/tonal của semantic color */
  soft: 0.16,
} as const;

/** alpha-variant trên kênh mực Vuexy */
export const inkAlpha = (alpha: number): string => `rgba(${INK_RGB}, ${alpha})`;

/** [X] thang spacing 4-based */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** [ĐO control/card=6] [X sheet 16] */
export const RADIUS = { control: 6, card: 6, sheet: 16, pill: 999 } as const;

export const TYPOGRAPHY = {
  /**
   * [ĐO] Public Sans, system-preferred — KHÔNG tải Google Fonts render-blocking
   * (DEC-UI-BASELINE-01 D1; cùng phương án Mini App app.scss:59).
   */
  fontFamily:
    '"Public Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  /** [ĐO] body 15px, [ĐO] label/secondary 13px */
  fontSizeBody: 15,
  fontSizeSecondary: 13,
  lineHeightBody: 1.467, // 22/15 [X]
  /** [ĐO] h4 login 24/500/38 */
  heading: { fontSize: 24, fontWeight: 500, lineHeight: 38 / 24 },
  /** [X] card title 18/24 w600 */
  cardTitle: { fontSize: 18, fontWeight: 600, lineHeight: 24 / 18 },
  /** [X] KPI 22/30 w600 */
  kpi: { fontSize: 22, fontWeight: 600, lineHeight: 30 / 22 },
  /** [ĐO] button 15/500 */
  button: { fontSize: 15, fontWeight: 500 },
} as const;

/** [ĐO] button/input cao 38px; [X] touch target mobile 44px */
export const CONTROL = {
  height: 38,
  heightTouch: 44,
  inputPaddingX: 14,
  inputPaddingY: 7,
} as const;

/**
 * Motion — GIỮ bộ số hiện hành của dự án (antd/MUI/CSS đã đồng bộ 3 hệ từ
 * trước, xem 03-token-source-matrix.md T6/T7). Đây là nơi khai báo DUY NHẤT;
 * `src/shared/components/motion/motion-tokens.ts` và `hn-motion.css` là mirror
 * (parity test: src/test/ui-foundation/token-css-parity.test.ts).
 */
export const MOTION = {
  duration: { instant: 90, fast: 140, normal: 200, slow: 280 },
  easing: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
  },
} as const;

/** Hợp đồng breakpoint đã tuyên bố của dự án (khớp mui-theme + hn-responsive) */
export const BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 980,
  xl: 1280,
} as const;

/**
 * Thang z-index đặt tên — token-hóa các giá trị đang vận hành (chuẩn hoá lại
 * thang trong Part 3 khi làm shell mới; antd mask mặc định ~1000 nằm giữa
 * dropdown và pwa).
 */
export const Z_INDEX = {
  header: 30,
  sidebar: 40,
  dropdown: 999,
  pwaBanner: 2200,
  blockingLoading: 9999,
} as const;

/**
 * LEGACY SHELL — sidebar tối theo BA-wireframe MVP, GIỮ TẠM trong Part 2.
 * Shell Vuexy (sidebar sáng ~260px) làm ở Part 3 Phase C; khi đó xoá khối này.
 * Allowlist: docs/ui/vuexy-sync/allowlists/legacy-scoped.json (owner/deadline).
 */
export const LEGACY_SHELL = {
  siderBg: "#0f172a",
  siderHover: "#111f3d",
  siderText: "#e5e7eb",
  siderMuted: "#94a3b8",
} as const;

/** [ĐO card shadow không có ở login] → [X] bộ bóng của spec X */
export const SHADOW = {
  card: `0 4px 18px rgba(${INK_RGB}, 0.1)`,
  floating: `0 8px 24px rgba(${INK_RGB}, 0.14)`,
} as const;
