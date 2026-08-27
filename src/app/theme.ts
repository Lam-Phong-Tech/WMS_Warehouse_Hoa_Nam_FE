/**
 * @deprecated SHIM tương thích — nguồn token thật là `@/shared/ui/tokens`,
 * antd theme thật là `@/shared/ui/theme/antd-adapter`.
 *
 * `BRAND`/`DESIGN_TOKENS` từng là token source của hệ "cool MVP" (BA wireframe,
 * #2563eb/Arial). Theo DEC-UI-BASELINE-01, mọi giá trị ở đây đã được RE-POINT
 * về canonical Vuexy tokens để consumer cũ đổi diện mạo theo mà không phải sửa
 * đồng loạt trong Part 2. KHÔNG thêm consumer mới (guard: `yarn ui:tokens`);
 * consumer hiện có sẽ migrate về `@/shared/ui/tokens` trong Part 3 rồi xoá file.
 */
import type { SizeType } from "antd/es/config-provider/SizeContext";
import {
  COMPONENT_TOKENS,
  LEGACY_SHELL,
  RADIUS,
  SEMANTIC_LIGHT as S,
  SPACING,
  TYPOGRAPHY,
} from "@/shared/ui/tokens";
import { antdTheme } from "@/shared/ui/theme/antd-adapter";

/** @deprecated đọc `SEMANTIC_LIGHT` từ `@/shared/ui/tokens` */
export const BRAND = {
  primary: S.primary,
  primaryHover: S.primaryDark,
  canvas: S.bgCanvas,
  paper: S.bgSurface,
  paperAlt: S.bgSubtle,
  ink: S.textHigh,
  inkSecondary: S.textHigh,
  muted: S.textMedium,
  border: S.borderInput,
  divider: S.divider,
  tableHead: S.bgSubtle,
  accentBg: S.primarySoft,
  accentBorder: S.primaryLight,
  success: S.success,
  warning: S.warning,
  danger: S.error,
  siderBg: LEGACY_SHELL.siderBg,
  siderHover: LEGACY_SHELL.siderHover,
  siderText: LEGACY_SHELL.siderText,
  siderMuted: LEGACY_SHELL.siderMuted,
  siderSelected: S.primary,
  siderSelectedBorder: S.primaryLight,
  headerBg: S.bgCanvas,
} as const;

/** @deprecated đọc `COMPONENT_TOKENS`/`SPACING`/`RADIUS` từ `@/shared/ui/tokens` */
export const DESIGN_TOKENS = {
  spacing: {
    xs: SPACING.xs,
    sm: SPACING.sm,
    md: SPACING.md,
    lg: SPACING.lg,
    xl: SPACING.xl,
    xxl: SPACING.xxl,
  },
  radius: { sm: RADIUS.control, md: RADIUS.card, lg: RADIUS.sheet },
  table: { size: "middle" as SizeType },
  typography: {
    pageTitle: {
      fontSize: TYPOGRAPHY.heading.fontSize,
      fontWeight: 700,
      lineHeight: 1.2,
    },
    sectionTitle: {
      fontSize: TYPOGRAPHY.cardTitle.fontSize,
      fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
    },
    body: {
      fontSize: TYPOGRAPHY.fontSizeBody,
      lineHeight: TYPOGRAPHY.lineHeightBody,
    },
    caption: { fontSize: 12 },
  },
  button: COMPONENT_TOKENS.button,
} as const;

/** @deprecated import `antdTheme` từ `@/shared/ui/theme` */
export const themeConfig = antdTheme;
