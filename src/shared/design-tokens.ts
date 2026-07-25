/**
 * Design tokens dùng chung — nguồn duy nhất cho màu/font/spacing hard-code rải
 * rác khắp UI (FormDrawer, ErrorState, LoadingState, EmptyState, OrgChartPage...).
 *
 * Giá trị lấy đúng theo `Wireframe P0/Design System - Module 1.md` (nguồn chính
 * thức) — không tự đặt số mới. Khi tài liệu design system đổi, chỉ sửa ở đây.
 *
 * P2 (Chuẩn hóa Form/Drawer/Modal Pattern): phạm vi áp dụng ban đầu là
 * `FormDrawer` — các file khác (`ErrorState`, `LoadingState`, `EmptyState`,
 * `OrgChartPage`, `RolesPage`...) vẫn còn hard-code, cần dọn dần, xem
 * `docs/FORM_PATTERN_MIGRATION_CHECKLIST.md`.
 */

/** §2.1 Nền & mực (Neutrals) */
export const NEUTRAL_COLORS = {
  canvas: '#e7e5df',
  paper: '#ffffff',
  paperAlt: '#fcfbf8',
  ink: '#2b2b2b',
  ink2: '#4a463e',
  muted: '#7a766c',
  muted2: '#8c887e',
  placeholder: '#9a968c',
  tableHead: '#f3f1ea',
} as const;

/** §2.2 Đường kẻ (Borders / dividers) */
export const BORDER_COLORS = {
  input: '#b9b6ad',
  divider: '#d8d5cc',
  dividerSoft: '#e3e0d8',
  rowLine: '#ece9e1',
  connector: '#b9b6ad',
} as const;

/** §2.3 Màu nhấn (Accent — xanh dương) */
export const ACCENT_COLORS = {
  accent: '#356fa3',
  accentBg: '#eaf1f8',
  accentBorder: '#bcd2e6',
  accentInk: '#5b6b7e',
} as const;

/** §2.4 Màu ngữ nghĩa (Semantic) */
export const SEMANTIC_COLORS = {
  success: { bg: '#dceadf', text: '#3c6e4f', border: '#9cc3a8' },
  warning: { bg: '#f6eed6', text: '#8a6d1f', border: '#d9c489' },
  danger: { bg: '#fbe7e6', text: '#b94a48', border: '#d8a9a6' },
  neutral: { bg: '#eceae6', text: '#6b675e', border: '#c9c5bb' },
  overdue: { bg: '#fbe3d6', text: '#b15a2a', border: '#e0b598' },
} as const;

/** §3 Typography */
export const FONT_FAMILY = "'Be Vietnam Pro', system-ui, sans-serif";

/** §4.3 Đổ bóng (Shadow) — thẻ khung (frame card) */
export const CARD_SHADOW = '4px 5px 0 rgba(43,43,43,.12)';

/** §4.2 Bo góc (Radius) */
export const RADIUS = {
  card: 4,
  control: 3, // input / button / filter
  pill: 10,
} as const;

/** §6.5 Nút (Button) — style theo loại */
export const BUTTON_STYLES = {
  primary: {
    background: ACCENT_COLORS.accent,
    color: '#fff',
    fontWeight: 700,
  },
  secondary: {
    border: `1.5px solid ${NEUTRAL_COLORS.ink}`,
    color: NEUTRAL_COLORS.ink,
    background: NEUTRAL_COLORS.paper,
  },
  danger: {
    border: `1.5px solid ${SEMANTIC_COLORS.danger.text}`,
    color: SEMANTIC_COLORS.danger.text,
  },
  approve: {
    background: SEMANTIC_COLORS.success.text,
    color: '#fff',
    fontWeight: 700,
  },
} as const;
