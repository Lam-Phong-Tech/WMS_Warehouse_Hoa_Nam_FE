/**
 * COMPONENT TOKENS — số đo cấp component, dẫn xuất từ primitives/semantic.
 * Adapter antd/MUI và foundation components đọc từ đây để hai engine render
 * cùng một đặc tả (cao/bo góc/chữ) — không copy literal vào theme file.
 */
import {
  CONTROL,
  NAV_COLOR_VARS,
  NAV_MOTION,
  NAV_SHADOW,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from "./primitives";
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
  /** Dialog dùng cùng bán kính với các khối nội dung. */
  modal: {
    radius: RADIUS.card,
    sheetRadius: RADIUS.sheet,
    titleFontSize: TYPOGRAPHY.cardTitle.fontSize,
    titleFontWeight: TYPOGRAPHY.cardTitle.fontWeight,
  },
  /**
   * MENU/POPUP xổ ra từ một ô nhập (Autocomplete, Select, Menu) — lớp NỔI trên
   * mặt trang nên phải tách khỏi ô neo bằng một khe hở.
   *
   * `gapAbove` > `gap`: khi popper LẬT LÊN, mép dưới của popup trùng đúng mép
   * trên (border-box) của ô nhập — chính là nơi NHÃN NỔI của MUI đang đứng,
   * nhô lên khoảng 9px. Khe hở dưới 10 sẽ cắt đôi nhãn.
   */
  menu: {
    /** khe hở khi popup xổ XUỐNG dưới ô */
    gap: SPACING.xs,
    /** khe hở khi popup LẬT LÊN trên ô — phải chừa được nhãn nổi (~9px) */
    gapAbove: SPACING.md,
    radius: RADIUS.card,
    shadow: S.shadowFloating,
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
  /**
   * NAV — số đo 1:1 của thanh điều hướng theo demo UI/UX đã chốt
   * `1.WMS_Hoa_Nam_Sidebar_Demo.html` (2026-08-31). Mọi con số dưới đây ĐO
   * TỪ DEMO, không làm tròn theo thang spacing chung: sửa một số ở đây là
   * lệch khỏi bản chốt.
   */
  nav: {
    /** khối logo + tên + nút thu gọn */
    brand: {
      height: 64,
      gap: 11,
      paddingLeft: 20,
      paddingRight: 15,
      logoSize: 34,
      /**
       * flex-basis của ô logo lúc MỞ RỘNG = 38 trong khi width/height = 34:
       * đúng như demo (ô logo hơi bè ngang 38×34, tên brand vì thế bắt đầu ở
       * 69px). Thu gọn thì basis = logoSize ⇒ ô vuông 34×34.
       */
      logoBasisExpanded: 38,
      logoRadius: 7,
      logoFontSize: 13,
      logoFontWeight: 500,
      logoLetterSpacing: "0.02em",
      nameFontSize: 19,
      nameFontWeight: 500,
      collapseSize: 24,
      collapseIconSize: 18,
      /** nét icon nút thu gọn — demo dày hơn icon menu (1.8 vs 1.65) */
      collapseStrokeWidth: 1.8,
    },
    /** padding của <nav>: 0 10px 18px (mở rộng) / 0 12px 18px (rail) */
    paddingX: 10,
    paddingBottom: 18,
    railPaddingX: 12,

    /** hàng cấp 1: mục đơn (direct) và tiêu đề nhóm */
    itemMinHeight: 42,
    itemPaddingY: 9,
    itemPaddingX: 12,
    itemGap: 12,
    itemFontSize: 15,
    itemFontWeight: 400,
    /** icon hàng cấp 1: 20px, nét 1.65 (mặc định của VuexyNavIcon) */
    iconSize: 20,
    /** chevron sổ nhóm: 15px */
    chevronSize: 15,
    radius: RADIUS.control,

    /** mục con: KHÔNG icon, đánh dấu bằng chấm tròn viền */
    childMinHeight: 40,
    childPaddingY: 8,
    childPaddingLeft: 43,
    childMarginY: 2,
    markerLeft: 20,
    markerSize: 7,
    markerBorderWidth: 1.5,

    /** rail thu gọn: ô icon vuông 44, gạch phân cách 22px giữa các cụm */
    railItemSize: 44,
    railItemMarginY: 2,
    railDividerWidth: 22,
    railDividerGapTop: 8,
    railDividerPadTop: 9,

    /** gradient của mục đang chọn — 118deg đúng demo */
    activeGradientAngle: "118deg",

    // Mặt tiền biến CSS: sidebar đổi màu theo chế độ mà không phải render lại.
    color: NAV_COLOR_VARS,
    shadow: NAV_SHADOW,
    motion: NAV_MOTION,
  },
} as const;
