import type { SizeType } from "antd/es/config-provider/SizeContext";
import type { ThemeConfig } from "antd";

/**
 * Màu thương hiệu dùng chung toàn app (đồng bộ với theme antd).
 * P2: gom cả các giá trị trước đây hardcode rải rác trong layout (header
 * background/blur khi sticky) vào đây — khi cần đổi brand/theme (vd dark
 * mode, whitelabel) chỉ sửa 1 chỗ thay vì lục từng component.
 */
export const BRAND = {
  primary: "#7c3aed",
  primaryHover: "#6d28d9",
  siderBg: "#1f1d2b",
  siderTrigger: "#161320",
  gradient: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
  /** Nền Header khi sticky — hơi trong suốt để thấy nội dung cuộn phía sau. */
  headerBg: "rgba(255, 255, 255, 0.95)",
  headerBlur: "blur(8px)",
};

/** Token thiết kế dùng chung — spacing, radius, typography, table density. */
export const DESIGN_TOKENS = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 4, md: 8, lg: 12 },
  table: { size: "middle" as SizeType },
  typography: {
    pageTitle: { fontSize: 20, fontWeight: 700, lineHeight: 1.3 },
    sectionTitle: { fontSize: 16, fontWeight: 600 },
    body: { fontSize: 14, lineHeight: 1.5 },
    caption: { fontSize: 12 },
  },
} as const;

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: BRAND.primary,
    colorLink: BRAND.primary,
    borderRadius: 8,
    fontFamily:
      "'Inter', system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    colorBgLayout: "#f4f5fa",
  },
  components: {
    Layout: {
      headerBg: "#ffffff",
      headerHeight: 64,
      headerPadding: "0 24px",
      siderBg: BRAND.siderBg,
      triggerBg: BRAND.siderTrigger,
      bodyBg: "#f4f5fa",
    },
    Menu: {
      darkItemBg: BRAND.siderBg,
      darkSubMenuItemBg: BRAND.siderBg,
      darkItemSelectedBg: BRAND.primary,
      itemBorderRadius: 8,
      itemMarginInline: 12,
    },
    Card: {
      borderRadiusLG: 12,
    },
    Button: {
      controlHeight: 40,
      fontWeight: 500,
    },
    Input: {
      controlHeight: 40,
    },
    Select: {
      controlHeight: 40,
    },
  },
};
