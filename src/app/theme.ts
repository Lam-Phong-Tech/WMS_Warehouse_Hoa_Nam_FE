import type { SizeType } from "antd/es/config-provider/SizeContext";
import type { ThemeConfig } from "antd";

/**
 * Design tokens đồng bộ với BA_HOA_NAM/WMS_HoaNam_Wireframe_P0.html.
 * Wireframe dùng low-fi desktop/tablet: canvas be, paper trắng, viền rõ,
 * accent xanh và Be Vietnam Pro.
 */
export const BRAND = {
  primary: "#356fa3",
  primaryHover: "#2d638f",
  canvas: "#e7e5df",
  paper: "#ffffff",
  paperAlt: "#fcfbf8",
  ink: "#2b2b2b",
  inkSecondary: "#4a463e",
  muted: "#7a766c",
  border: "#b9b6ad",
  divider: "#d8d5cc",
  tableHead: "#f3f1ea",
  accentBg: "#eaf1f8",
  accentBorder: "#bcd2e6",
  siderBg: "#2b2b2b",
  siderTrigger: "#232323",
  gradient: "linear-gradient(135deg, #356fa3 0%, #2d638f 100%)",
  headerBg: "rgba(252, 251, 248, 0.97)",
  headerBlur: "blur(8px)",
};

export const DESIGN_TOKENS = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32 },
  radius: { sm: 3, md: 4, lg: 4 },
  table: { size: "middle" as SizeType },
  typography: {
    pageTitle: { fontSize: 25, fontWeight: 800, lineHeight: 1.12 },
    sectionTitle: { fontSize: 17, fontWeight: 800 },
    body: { fontSize: 14, lineHeight: 1.38 },
    caption: { fontSize: 12 },
  },
} as const;

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: BRAND.primary,
    colorLink: BRAND.primary,
    colorBgLayout: BRAND.canvas,
    colorBgContainer: BRAND.paper,
    colorText: BRAND.ink,
    colorTextSecondary: BRAND.muted,
    colorBorder: BRAND.border,
    colorBorderSecondary: BRAND.divider,
    borderRadius: 3,
    controlHeight: 36,
    fontSize: 14,
    lineHeight: 1.38,
    fontFamily:
      "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  components: {
    Layout: {
      headerBg: BRAND.paperAlt,
      headerHeight: 60,
      headerPadding: "0 16px",
      siderBg: BRAND.siderBg,
      triggerBg: BRAND.siderTrigger,
      bodyBg: BRAND.canvas,
    },
    Menu: {
      darkItemBg: BRAND.siderBg,
      darkSubMenuItemBg: BRAND.siderBg,
      darkItemSelectedBg: BRAND.primary,
      itemBorderRadius: 3,
      itemMarginInline: 8,
    },
    Card: {
      borderRadiusLG: 4,
    },
    Button: {
      controlHeight: 36,
      fontWeight: 700,
    },
    Input: {
      controlHeight: 36,
    },
    Select: {
      controlHeight: 36,
    },
  },
};
