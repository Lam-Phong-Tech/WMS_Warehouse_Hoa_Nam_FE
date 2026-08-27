/**
 * COMPONENT TOKENS — số đo cấp component, dẫn xuất từ primitives/semantic.
 * Adapter antd/MUI và foundation components đọc từ đây để hai engine render
 * cùng một đặc tả (cao/bo góc/chữ) — không copy literal vào theme file.
 */
import { CONTROL, RADIUS, SPACING, TYPOGRAPHY } from "./primitives";
import { SEMANTIC_LIGHT as S } from "./semantic-light";

export const COMPONENT_TOKENS = {
  /** [ĐO] nút Vuexy: cao 38, radius 6, chữ 15/500, không elevation */
  button: {
    height: CONTROL.height,
    radius: RADIUS.control,
    fontSize: TYPOGRAPHY.button.fontSize,
    fontWeight: TYPOGRAPHY.button.fontWeight,
  },
  /** [ĐO] input Vuexy: cao 38, radius 6, chữ 15, padding 7×14, label 13 */
  input: {
    height: CONTROL.height,
    radius: RADIUS.control,
    fontSize: TYPOGRAPHY.fontSizeBody,
    paddingX: CONTROL.inputPaddingX,
    paddingY: CONTROL.inputPaddingY,
    labelFontSize: TYPOGRAPHY.fontSizeSecondary,
    borderColor: S.borderInput,
  },
  card: {
    radius: RADIUS.card,
    paddingDesktop: SPACING.xl,
    paddingMobile: SPACING.lg,
    shadow: S.shadowCard,
    titleFontSize: TYPOGRAPHY.cardTitle.fontSize,
    titleFontWeight: TYPOGRAPHY.cardTitle.fontWeight,
  },
  /** [DX] dialog Vuexy cùng ngôn ngữ card (radius nhỏ); sheet mobile 16 */
  modal: {
    radius: RADIUS.card,
    sheetRadius: RADIUS.sheet,
    titleFontSize: TYPOGRAPHY.cardTitle.fontSize,
    titleFontWeight: TYPOGRAPHY.cardTitle.fontWeight,
  },
  /**
   * Bảng: GIỮ mật độ hiện hành của app (font 13, cell padding 10) — chưa đo
   * được table Vuexy ở Part 1/2; đo và chốt lại trong Part 3 (screen migration).
   */
  table: {
    fontSize: 13,
    cellPadding: 10,
    headerBg: S.bgSubtle,
  },
  chip: {
    radius: RADIUS.control,
    fontSize: 12.5,
  },
  icon: { sm: 16, md: 18, lg: 20 },
} as const;
