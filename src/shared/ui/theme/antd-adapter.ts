/**
 * ANTD ADAPTER — map canonical tokens → Ant Design ConfigProvider theme.
 * antd còn phục vụ các màn chưa migrate (xem 06-library-import-graph.md);
 * adapter này bảo đảm antd render CÙNG token Vuexy với MUI — không literal.
 */
import type { ThemeConfig } from "antd";
import {
  COMPONENT_TOKENS as C,
  MOTION,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui/tokens";

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: S.primary,
    colorLink: S.primary,
    colorInfo: S.info,
    colorSuccess: S.success,
    colorWarning: S.warning,
    colorError: S.error,
    colorBgLayout: S.bgCanvas,
    colorBgContainer: S.bgSurface,
    colorText: S.textHigh,
    colorTextSecondary: S.textMedium,
    colorBorder: S.borderInput,
    colorBorderSecondary: S.border,
    borderRadius: C.button.radius,
    controlHeight: C.button.height,
    fontSize: TYPOGRAPHY.fontSizeBody,
    lineHeight: TYPOGRAPHY.lineHeightBody,
    fontFamily: TYPOGRAPHY.fontFamily,
    // Cùng bộ số motion với MUI adapter và hn-motion.css (một nguồn, nhiều adapter)
    motionDurationFast: `${MOTION.duration.fast / 1000}s`,
    motionDurationMid: `${MOTION.duration.normal / 1000}s`,
    motionDurationSlow: `${MOTION.duration.slow / 1000}s`,
    motionEaseInOut: MOTION.easing.standard,
    motionEaseOut: MOTION.easing.out,
  },
  components: {
    // Part 4: khối Layout/Menu (sidebar tối legacy) đã XOÁ — shell là
    // UiAppShell (MUI); antd không còn render Layout/Menu nào trong app.
    Card: {
      borderRadiusLG: C.card.radius,
    },
    Button: {
      controlHeight: C.button.height,
      borderRadius: C.button.radius,
      fontWeight: C.button.fontWeight,
    },
    Input: {
      controlHeight: C.input.height,
      borderRadius: C.input.radius,
    },
    Select: {
      controlHeight: C.input.height,
      borderRadius: C.input.radius,
    },
    Table: {
      headerBg: C.table.headerBg,
      headerColor: S.textHigh,
      borderColor: S.border,
      cellPaddingBlock: C.table.cellPadding,
      cellPaddingInline: C.table.cellPadding,
      fontSize: C.table.fontSize,
    },
    Modal: {
      borderRadiusLG: C.modal.radius,
    },
    Drawer: {
      borderRadiusLG: C.modal.radius,
    },
  },
};
