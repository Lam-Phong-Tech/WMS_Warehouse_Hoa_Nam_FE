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
  /** [ĐO] đầu dải gradient của logo màn đăng nhập (đuôi là purple) */
  purpleGradientStart: "#8B7FF3",

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

/**
 * alpha-variant trên kênh mực Vuexy — GIÁ TRỊ THÔ của chế độ sáng.
 *
 * Dùng ở tầng token/adapter. KHÔNG dùng trong `sx` của component: nó khoá cứng
 * kênh mực tối nên chữ sẽ chìm nghỉm khi bật chế độ tối — dùng `inkAlphaVar`.
 */
export const inkAlpha = (alpha: number): string => `rgba(${INK_RGB}, ${alpha})`;

/**
 * alpha-variant trên kênh mực ĐANG hiển thị. `--wms-ink-rgb` đảo sang kênh sáng
 * ở chế độ tối nên cùng một dòng chữ vẫn đọc được ở cả hai chế độ.
 */
export const inkAlphaVar = (alpha: number): string =>
  `rgba(var(--wms-ink-rgb), ${alpha})`;

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

/** [ĐO card shadow không có ở login] → [X] bộ bóng của spec X */
export const SHADOW = {
  card: `0 4px 18px rgba(${INK_RGB}, 0.1)`,
  floating: `0 8px 24px rgba(${INK_RGB}, 0.14)`,
} as const;

/** Kênh RGB của primary #7367F0 — dùng cho alpha-variant (focus ring, bóng). */
export const PURPLE_RGB = "115, 103, 240";

/**
 * NAV_COLOR — bảng màu RIÊNG của thanh điều hướng, đo 1:1 từ demo UI/UX đã
 * chốt `1.WMS_Hoa_Nam_Sidebar_Demo.html` (2026-08-31). Tách khỏi COLOR chung
 * vì đây là biến thể chỉ sidebar dùng; không mở ra cho màn nghiệp vụ.
 */
export const NAV_COLOR = {
  /** [ĐO] đuôi gradient của mục đang chọn (đầu gradient = COLOR.purple) */
  activeGradientEnd: "#9E95F5",
  /** [ĐO] nền hover / nền nhóm đang mở */
  hover: "#F3F2F5",
  /** [ĐO] viền phải sidebar + gạch phân cách ở rail thu gọn */
  border: "#E8E7EC",
  /** [ĐO] chữ hàng cấp 1 (nhạt hơn chữ mục con — đúng demo) */
  itemText: "#5B5868",
  /** [ĐO] chữ phụ: nút thu gọn */
  muted: "#6D6A7B",
  /** [ĐO] viền chấm tròn đánh dấu mục con */
  marker: "#8F8B99",
  /** [ĐO] màu outline khi focus bằng bàn phím */
  focus: "#8F85F3",
} as const;

/**
 * NAV_COLOR_DARK — bản chế độ tối của bảng trên. Nền sidebar ở chế độ tối là
 * `--wms-bg-surface` (#2F2F48) nên chữ/viền/hover phải đảo sang mực SÁNG, nếu
 * không cả thanh điều hướng thành chữ xám trên nền tối và không đọc được gì.
 */
export const NAV_COLOR_DARK = {
  activeGradientEnd: "#8379EA",
  hover: "#3A3A55",
  border: "rgba(231, 227, 252, 0.1)",
  itemText: "rgba(231, 227, 252, 0.78)",
  muted: "rgba(231, 227, 252, 0.6)",
  marker: "rgba(231, 227, 252, 0.42)",
  focus: "#A79EFF",
} as const;

/**
 * Mặt tiền BIẾN CSS của bảng màu nav — đây là thứ component/sx phải dùng để
 * sidebar tự đổi theo `<html data-theme>`. Giá trị thô của hai chế độ nằm ở
 * `NAV_COLOR` / `NAV_COLOR_DARK` và được mirror sang css-vars*.css.
 */
export const NAV_COLOR_VARS = Object.fromEntries(
  Object.keys(NAV_COLOR).map((key) => [
    key,
    `var(--wms-nav-${key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()})`,
  ]),
) as Record<keyof typeof NAV_COLOR, string>;

/** [ĐO] bộ bóng của sidebar theo 3 trạng thái + mục đang chọn. */
export const NAV_SHADOW = {
  sidebar: `2px 0 12px rgba(${INK_RGB}, 0.05)`,
  sidebarCollapsed: `1px 0 8px rgba(${INK_RGB}, 0.04)`,
  sidebarPeek: `8px 0 24px rgba(${INK_RGB}, 0.12)`,
  activeItem: `0 3px 8px rgba(${PURPLE_RGB}, 0.34)`,
} as const;

/** [ĐO] motion riêng của sidebar (demo dùng `ease`, không phải easing chung). */
export const NAV_MOTION = {
  /** đóng/mở bề rộng sidebar */
  width: 240,
  /** sổ submenu (grid-template-rows 0fr → 1fr) */
  submenu: 210,
  /** mờ/rõ submenu */
  submenuOpacity: 160,
  /** xoay chevron 180° */
  chevron: 180,
  easing: "ease",
} as const;
