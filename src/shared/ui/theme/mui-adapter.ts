/**
 * MUI ADAPTER — map canonical tokens → MUI theme. `createTheme` DUY NHẤT của
 * dự án nằm ở đây (guard: provider-uniqueness test + `yarn ui:architecture`).
 *
 * HAI CHẾ ĐỘ: `palette` phải là MÀU THẬT vì `createTheme` tự sinh biến thể
 * (augmentColor) và vì `theme.palette.x.main` còn được đọc bằng JS ở vài chỗ
 * (`alpha()`, tint của UiButton) — nên nó lấy từ `PALETTE[mode]`. Ngược lại
 * `styleOverrides` bên dưới đọc `SEMANTIC_LIGHT` (đã là `var(--wms-…)`) nên
 * tự đúng màu theo `<html data-theme>` mà không cần dựng lại theme.
 *
 * Phần cấu trúc component overrides + motion kế thừa nguyên từ
 * src/app/mui-theme.ts cũ (đã đồng bộ nhịp với antd/CSS); chỉ thay giá trị
 * màu/kích thước bằng token Vuexy theo DEC-UI-BASELINE-01.
 */
import { createTheme } from "@mui/material/styles";
import Grow from "@mui/material/Grow";
import { MUI_ICON_SLOTS } from "@/shared/ui/icons";
import {
  BREAKPOINTS,
  COMPONENT_TOKENS as C,
  CONTROL,
  MOTION,
  PALETTE,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
  type ThemeModeName,
} from "@/shared/ui/tokens";

/**
 * Transition cho control tương tác — liệt kê property tường minh thay vì `all`
 * (xem ghi chú gốc trong mui-theme.ts cũ: `all` animate cả width/height gây
 * reflow/giật).
 */
const CONTROL_TRANSITION = [
  `color ${MOTION.duration.instant}ms ${MOTION.easing.standard}`,
  `background-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
  `border-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
  `box-shadow ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
  `transform ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
].join(", ");

function buildMuiTheme(mode: ThemeModeName) {
  const P = PALETTE[mode];
  return createTheme({
  breakpoints: { values: { ...BREAKPOINTS } },
  palette: {
    mode,
    primary: { main: P.primary, dark: P.primaryDark, light: P.primaryLight },
    secondary: { main: P.secondary, dark: P.secondaryDark },
    error: { main: P.error, dark: P.errorDark },
    warning: { main: P.warning, dark: P.warningDark },
    success: { main: P.success, dark: P.successDark },
    info: { main: P.info, dark: P.infoDark },
    background: { default: P.bgCanvas, paper: P.bgSurface },
    text: {
      primary: P.textHigh,
      secondary: P.textMedium,
      disabled: P.textDisabled,
    },
    divider: P.divider,
  },
  shape: { borderRadius: C.button.radius },
  transitions: {
    duration: {
      shortest: MOTION.duration.instant,
      shorter: MOTION.duration.fast,
      short: MOTION.duration.normal,
      standard: MOTION.duration.normal,
      complex: MOTION.duration.slow,
      enteringScreen: MOTION.duration.slow,
      leavingScreen: MOTION.duration.normal,
    },
    easing: {
      easeInOut: MOTION.easing.standard,
      easeOut: MOTION.easing.out,
      easeIn: MOTION.easing.in,
      sharp: MOTION.easing.standard,
    },
  },
  typography: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.fontSizeBody,
    button: {
      fontSize: C.button.fontSize,
      fontWeight: C.button.fontWeight,
      textTransform: "none",
    },
  },
  components: {
    MuiButton: {
      defaultProps: { size: "small", disableElevation: true },
      styleOverrides: {
        root: {
          height: C.button.height,
          borderRadius: C.button.radius,
          fontWeight: C.button.fontWeight,
          fontSize: C.button.fontSize,
          textTransform: "none",
          transition: CONTROL_TRANSITION,
          "&:hover:not(.Mui-disabled)": { transform: "translateY(-1px)" },
          "&:active:not(.Mui-disabled)": {
            transform: "translateY(0) scale(0.97)",
            transitionDuration: `${MOTION.duration.instant}ms`,
          },
          // Focus phải thấy được bằng mắt: global :where(...) trong
          // hn-motion.css có specificity 0 nên bị mọi `outline: none` cục bộ
          // đè mất — khai lại ở đây với specificity thật của component.
          "&:focus-visible": {
            outline: `2px solid ${S.primary}`,
            outlineOffset: 2,
          },
        },
        startIcon: {
          "& > *:nth-of-type(1)": { fontSize: 16 },
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiFormControl: {
      defaultProps: { size: "small" },
    },
    MuiSelect: {
      defaultProps: { size: "small", ...MUI_ICON_SLOTS.MuiSelect },
      styleOverrides: {
        select: {
          paddingTop: C.input.paddingY,
          paddingBottom: C.input.paddingY,
          paddingLeft: C.input.paddingX - 2,
          fontSize: C.input.fontSize,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: C.input.radius },
        input: {
          paddingTop: C.input.paddingY,
          paddingBottom: C.input.paddingY,
          fontSize: C.input.fontSize,
        },
        notchedOutline: {
          borderColor: C.input.borderColor,
          transition: [
            `border-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
            `border-width ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
          ].join(", "),
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: C.input.fontSize,
          minHeight: C.button.height,
          transition: CONTROL_TRANSITION,
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontSize: C.input.labelFontSize,
          // Nhãn field giữ màu chữ bình thường kể cả khi field lỗi — chỉ viền
          // input và helperText đổi đỏ (quyết định UX có sẵn của dự án).
          "&.Mui-error": { color: S.textHigh },
          // BUG: InputLabel tự nhân thêm transform scale(0.75) khi ở trạng
          // thái nổi lên viền (shrink) — nếu root fontSize đặt thẳng 13px thì
          // chữ HIỂN THỊ THẬT chỉ còn 13*0.75=9.75px, quá nhỏ khiến dấu tiếng
          // Việt (ã, ạ, ộ...) vỡ nét/trông như mất nửa chữ (đo được qua
          // getComputedStyle trên label thật — xem ghi chú soát UI 2026-08-29).
          // Bù ngược 0.75 chỉ ở trạng thái shrink để chữ nổi hiển thị đúng
          // 13px thật; trạng thái nghỉ (chưa nổi) không có transform nên vẫn
          // đúng 13px như trước, không đổi.
          "&.MuiInputLabel-shrink": {
            fontSize: `${(C.input.labelFontSize / 0.75).toFixed(4)}px`,
          },
        },
        asterisk: { color: S.error },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: 12.5 },
      },
    },
    MuiDialog: {
      defaultProps: {
        slots: { transition: Grow },
        transitionDuration: {
          enter: MOTION.duration.slow,
          exit: MOTION.duration.normal,
        },
        closeAfterTransition: true,
      },
      styleOverrides: {
        paper: { borderRadius: C.modal.radius },
      },
    },
    MuiDrawer: {
      defaultProps: {
        transitionDuration: {
          enter: MOTION.duration.slow,
          exit: MOTION.duration.normal,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: `background-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { transition: CONTROL_TRANSITION, textTransform: "none" },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { transition: CONTROL_TRANSITION },
      },
    },
    MuiTooltip: {
      defaultProps: {
        enterDelay: 250,
        enterNextDelay: 250,
        leaveDelay: 0,
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          transition: [
            `box-shadow ${MOTION.duration.normal}ms ${MOTION.easing.standard}`,
            `border-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
          ].join(", "),
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: C.modal.titleFontSize,
          fontWeight: C.modal.titleFontWeight,
          padding: "16px 20px",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { fontSize: TYPOGRAPHY.fontSizeBody },
      },
    },
    MuiChip: {
      defaultProps: { ...MUI_ICON_SLOTS.MuiChip },
      styleOverrides: {
        root: {
          borderRadius: C.chip.radius,
          fontSize: C.chip.fontSize,
          transition: CONTROL_TRANSITION,
        },
      },
    },
    /**
     * Alert (lỗi API, cảnh báo nghiệp vụ) xuất hiện giữa luồng thao tác và đẩy
     * nội dung bên dưới xuống — hiện tức thì làm cả trang giật một nhịp. Dùng
     * lại keyframes toàn cục của hn-motion.css để giữ một nguồn định nghĩa.
     */
    MuiAlert: {
      defaultProps: { ...MUI_ICON_SLOTS.MuiAlert },
      styleOverrides: {
        root: {
          animation: `hn-fade-in-up ${MOTION.duration.normal}ms ${MOTION.easing.out} backwards`,
        },
      },
    },
    /**
     * Các component MUI tự vẽ icon mặc định (bộ SVG nội bộ của MUI). Ép về
     * Flaticon Uicons ở đây để cả app chỉ còn MỘT bộ icon — chi tiết slug xem
     * src/shared/ui/icons/icon-slots.tsx.
     */
    MuiNativeSelect: {
      defaultProps: { ...MUI_ICON_SLOTS.MuiNativeSelect },
    },
    MuiAutocomplete: {
      defaultProps: { ...MUI_ICON_SLOTS.MuiAutocomplete },
    },
    MuiCheckbox: {
      defaultProps: { ...MUI_ICON_SLOTS.MuiCheckbox },
    },
    MuiRadio: {
      defaultProps: { ...MUI_ICON_SLOTS.MuiRadio },
    },
    MuiPaginationItem: {
      defaultProps: { ...MUI_ICON_SLOTS.MuiPaginationItem },
    },
    MuiTabs: {
      defaultProps: { ...MUI_ICON_SLOTS.MuiTabs },
    },
    MuiIconButton: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          fontSize: C.icon.md,
          // Vùng bấm tối thiểu: size="small" mặc định chỉ ~28px, quá nhỏ cho
          // thao tác trong kho (WCAG khuyến nghị ≥44, tokens khai heightTouch
          // 44). 34px là mức cân bằng không phá layout bảng dày.
          minWidth: 34,
          minHeight: 34,
          "@media (pointer: coarse)": {
            minWidth: CONTROL.heightTouch,
            minHeight: CONTROL.heightTouch,
          },
          transition: CONTROL_TRANSITION,
          "&:active:not(.Mui-disabled)": {
            transform: "scale(0.92)",
            transitionDuration: `${MOTION.duration.instant}ms`,
          },
          "&:focus-visible": {
            outline: `2px solid ${S.primary}`,
            outlineOffset: 2,
          },
        },
      },
    },
  },
  });
}

/** Theme dựng sẵn cho hai chế độ — provider chỉ việc chọn theo `mode`. */
export const MUI_THEMES = {
  light: buildMuiTheme("light"),
  dark: buildMuiTheme("dark"),
} as const;

/** Giữ tên cũ cho các chỗ đang import (test foundation, catalog). */
export const muiTheme = MUI_THEMES.light;
