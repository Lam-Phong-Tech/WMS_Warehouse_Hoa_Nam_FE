import type { SizeType } from "antd/es/config-provider/SizeContext";
import type { ThemeConfig } from "antd";

/**
 * Source of truth: HN_WMS_Wireframe_MVP.html supplied by BA.
 * Keep these values in lock-step with the HTML variables so Ant Design
 * controls render with the same palette, radius and typography.
 */
export const BRAND = {
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  canvas: "#f5f7fb",
  paper: "#ffffff",
  paperAlt: "#f8fafc",
  ink: "#1f2937",
  inkSecondary: "#1f2937",
  muted: "#6b7280",
  border: "#d8dfeb",
  divider: "#d8dfeb",
  tableHead: "#f8fafc",
  accentBg: "#dbeafe",
  accentBorder: "#60a5fa",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  siderBg: "#0f172a",
  siderHover: "#111f3d",
  siderText: "#e5e7eb",
  siderMuted: "#94a3b8",
  siderSelected: "#1d4ed8",
  siderSelectedBorder: "#60a5fa",
  headerBg: "#f5f7fb",
} as const;

export const DESIGN_TOKENS = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 14, xl: 18, xxl: 24 },
  radius: { sm: 10, md: 12, lg: 16 },
  table: { size: "middle" as SizeType },
  typography: {
    pageTitle: { fontSize: 24, fontWeight: 700, lineHeight: 1.2 },
    sectionTitle: { fontSize: 15, fontWeight: 700 },
    body: { fontSize: 14, lineHeight: 1.5 },
    caption: { fontSize: 12 },
  },
} as const;

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: BRAND.primary,
    colorLink: BRAND.primary,
    colorSuccess: BRAND.success,
    colorWarning: BRAND.warning,
    colorError: BRAND.danger,
    colorBgLayout: BRAND.canvas,
    colorBgContainer: BRAND.paper,
    colorText: BRAND.ink,
    colorTextSecondary: BRAND.muted,
    colorBorder: BRAND.border,
    colorBorderSecondary: BRAND.divider,
    borderRadius: 10,
    controlHeight: 36,
    fontSize: 14,
    lineHeight: 1.5,
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  components: {
    Layout: {
      bodyBg: BRAND.canvas,
      siderBg: BRAND.siderBg,
      headerBg: BRAND.canvas,
    },
    Menu: {
      darkItemBg: BRAND.siderBg,
      darkSubMenuItemBg: BRAND.siderBg,
      darkItemColor: BRAND.siderText,
      darkItemHoverBg: BRAND.siderHover,
      darkItemSelectedBg: BRAND.siderSelected,
      darkItemSelectedColor: "#ffffff",
      itemBorderRadius: 10,
      itemMarginInline: 0,
      itemMarginBlock: 3,
    },
    Card: {
      borderRadiusLG: 14,
    },
    Button: {
      controlHeight: 36,
      borderRadius: 10,
      fontWeight: 600,
    },
    Input: {
      controlHeight: 36,
      borderRadius: 10,
    },
    Select: {
      controlHeight: 36,
      borderRadius: 10,
    },
    Table: {
      headerBg: BRAND.paperAlt,
      headerColor: BRAND.ink,
      borderColor: BRAND.border,
      cellPaddingBlock: 10,
      cellPaddingInline: 10,
      fontSize: 13,
    },
    Modal: {
      borderRadiusLG: 16,
    },
    Drawer: {
      borderRadiusLG: 16,
    },
  },
};
