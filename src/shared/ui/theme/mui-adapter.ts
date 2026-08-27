/**
 * MUI ADAPTER — map canonical tokens → MUI theme. `createTheme` DUY NHẤT của
 * dự án nằm ở đây (guard: provider-uniqueness test + `yarn ui:architecture`).
 *
 * Phần cấu trúc component overrides + motion kế thừa nguyên từ
 * src/app/mui-theme.ts cũ (đã đồng bộ nhịp với antd/CSS); chỉ thay giá trị
 * màu/kích thước bằng token Vuexy theo DEC-UI-BASELINE-01.
 */
import { createTheme } from "@mui/material/styles";
import Grow from "@mui/material/Grow";
import {
  BREAKPOINTS,
  COMPONENT_TOKENS as C,
  MOTION,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
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

export const muiTheme = createTheme({
  breakpoints: { values: { ...BREAKPOINTS } },
  palette: {
    primary: { main: S.primary, dark: S.primaryDark, light: S.primaryLight },
    secondary: { main: S.secondary, dark: S.secondaryDark },
    error: { main: S.error, dark: S.errorDark },
    warning: { main: S.warning, dark: S.warningDark },
    success: { main: S.success, dark: S.successDark },
    info: { main: S.info, dark: S.infoDark },
    background: { default: S.bgCanvas, paper: S.bgSurface },
    text: {
      primary: S.textHigh,
      secondary: S.textMedium,
      disabled: S.textDisabled,
    },
    divider: S.divider,
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
      defaultProps: { size: "small" },
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
      styleOverrides: {
        root: {
          borderRadius: C.chip.radius,
          fontSize: C.chip.fontSize,
          transition: CONTROL_TRANSITION,
        },
      },
    },
    MuiIconButton: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          fontSize: C.icon.md,
          transition: CONTROL_TRANSITION,
          "&:active:not(.Mui-disabled)": {
            transform: "scale(0.92)",
            transitionDuration: `${MOTION.duration.instant}ms`,
          },
        },
      },
    },
  },
});
