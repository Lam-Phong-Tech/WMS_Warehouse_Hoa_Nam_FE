import { createTheme } from "@mui/material/styles";
import { BRAND } from "@/app/theme";

/**
 * MUI theme cho các màn hình đã chuyển sang MUI (Vuexy stack).
 * Map trực tiếp từ BRAND (src/app/theme.ts) để giữ đồng bộ màu/khoảng cách
 * với các màn hình vẫn còn dùng Ant Design trong lúc chuyển đổi dần.
 *
 * size="small" đặt làm defaultProps cho TextField/FormControl/Select để mọi
 * control cao đồng nhất ~36px (khớp controlHeight cũ của antd) mà không phải
 * lặp lại size="small" ở từng nơi gọi.
 */
export const muiTheme = createTheme({
  palette: {
    primary: { main: BRAND.primary, dark: BRAND.primaryHover },
    error: { main: BRAND.danger },
    warning: { main: BRAND.warning },
    success: { main: BRAND.success },
    background: { default: BRAND.canvas, paper: BRAND.paper },
    text: { primary: BRAND.ink, secondary: BRAND.muted },
    divider: BRAND.divider,
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 14,
  },
  components: {
    MuiButton: {
      defaultProps: { size: "small", disableElevation: true },
      styleOverrides: {
        root: {
          height: 36,
          borderRadius: 10,
          fontWeight: 600,
          textTransform: "none",
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
        select: { paddingTop: 10, paddingBottom: 10, paddingLeft: 12, fontSize: 15 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10 },
        input: { paddingTop: 10, paddingBottom: 10, fontSize: 15 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: 15, minHeight: 38 },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        // Nhỉnh hơn 1 chút so với .field label cũ (12px) theo yêu cầu người dùng.
        root: { fontSize: 13 },
        asterisk: { color: BRAND.danger },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: 12.5 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: 18, fontWeight: 700, padding: "16px 20px" },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { fontSize: 15 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontSize: 12.5 },
      },
    },
    MuiIconButton: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: { fontSize: 18 },
      },
    },
  },
});
