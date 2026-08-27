import { createTheme } from "@mui/material/styles";
import Grow from "@mui/material/Grow";
import { BRAND } from "@/app/theme";
import {
  MOTION_DURATION,
  MOTION_EASING,
} from "@/shared/components/motion/motion-tokens";

/**
 * Bộ transition cho control tương tác (nút, ô nhập, chip...).
 * Liệt kê property tường minh thay vì `all`: `all` sẽ animate luôn cả
 * width/height khi component đổi class, gây reflow và đúng cái giật cần tránh.
 */
const CONTROL_TRANSITION = [
  `color ${MOTION_DURATION.instant}ms ${MOTION_EASING.standard}`,
  `background-color ${MOTION_DURATION.fast}ms ${MOTION_EASING.standard}`,
  `border-color ${MOTION_DURATION.fast}ms ${MOTION_EASING.standard}`,
  `box-shadow ${MOTION_DURATION.fast}ms ${MOTION_EASING.standard}`,
  `transform ${MOTION_DURATION.fast}ms ${MOTION_EASING.standard}`,
].join(", ");

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
  // Khớp breakpoint của src/styles/hn-responsive.css (576/768/980/1280) để
  // Grid/sx responsive của MUI và CSS legacy kích hoạt cùng 1 mốc viewport.
  breakpoints: {
    values: { xs: 0, sm: 576, md: 768, lg: 980, xl: 1280 },
  },
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
  // Nguồn duy nhất cho mọi chuyển động do MUI điều khiển bằng JS (Dialog,
  // Menu, Collapse, Fade, Tabs...). Cùng bộ số với biến CSS trong
  // src/styles/hn-motion.css để MUI và antd/CSS chạy cùng nhịp — lệch nhịp
  // giữa hai hệ là thứ tạo cảm giác giao diện "rời rạc".
  transitions: {
    duration: {
      shortest: MOTION_DURATION.instant,
      shorter: MOTION_DURATION.fast,
      short: MOTION_DURATION.normal,
      standard: MOTION_DURATION.normal,
      complex: MOTION_DURATION.slow,
      enteringScreen: MOTION_DURATION.slow,
      leavingScreen: MOTION_DURATION.normal,
    },
    easing: {
      easeInOut: MOTION_EASING.standard,
      easeOut: MOTION_EASING.out,
      easeIn: MOTION_EASING.in,
      sharp: MOTION_EASING.standard,
    },
  },
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
          transition: CONTROL_TRANSITION,
          // Nhấc nhẹ khi rê chuột + lún xuống khi bấm: phản hồi tức thì cho
          // người dùng biết nút đã nhận thao tác, trước cả khi API trả về.
          "&:hover:not(.Mui-disabled)": { transform: "translateY(-1px)" },
          "&:active:not(.Mui-disabled)": {
            transform: "translateY(0) scale(0.97)",
            transitionDuration: `${MOTION_DURATION.instant}ms`,
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
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 12,
          fontSize: 15,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10 },
        input: { paddingTop: 10, paddingBottom: 10, fontSize: 15 },
        // Viền ô nhập đổi màu dần khi focus/lỗi thay vì đổi phựt một cái.
        notchedOutline: {
          transition: [
            `border-color ${MOTION_DURATION.fast}ms ${MOTION_EASING.standard}`,
            `border-width ${MOTION_DURATION.fast}ms ${MOTION_EASING.standard}`,
          ].join(", "),
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: 15, minHeight: 38, transition: CONTROL_TRANSITION },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        // Nhỉnh hơn 1 chút so với .field label cũ (12px) theo yêu cầu người dùng.
        root: {
          fontSize: 13,
          // Nhãn field giữ màu chữ bình thường kể cả khi field đang lỗi —
          // chỉ viền input và dòng helperText bên dưới đổi màu đỏ để báo lỗi
          // (theo yêu cầu người dùng: không đổi màu chữ nhãn/label khi lỗi).
          "&.Mui-error": { color: BRAND.ink },
        },
        asterisk: { color: BRAND.danger },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: 12.5 },
      },
    },
    MuiDialog: {
      defaultProps: {
        // Modal bung ra từ 95% kích thước + mờ dần (Grow) thay vì hiện nguyên
        // khối. Thời lượng đóng lấy `normal` chứ không phải `fast`: bấm ra ngoài
        // để đóng là thao tác rất hay dùng, 140ms khiến modal "biến mất phựt".
        slots: { transition: Grow },
        transitionDuration: {
          enter: MOTION_DURATION.slow,
          exit: MOTION_DURATION.normal,
        },
        // Chỉ gỡ nội dung khỏi DOM SAU khi chạy xong hiệu ứng đóng — thiếu cờ
        // này modal biến mất ngay còn lớp nền mới mờ dần, trông như bị giật.
        closeAfterTransition: true,
      },
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
    MuiDrawer: {
      defaultProps: {
        transitionDuration: {
          enter: MOTION_DURATION.slow,
          exit: MOTION_DURATION.normal,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: `background-color ${MOTION_DURATION.fast}ms ${MOTION_EASING.standard}`,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { transition: CONTROL_TRANSITION },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { transition: CONTROL_TRANSITION },
      },
    },
    MuiTooltip: {
      defaultProps: {
        // Trễ nhẹ khi vào để tooltip không nhấp nháy lúc rê chuột ngang qua
        // hàng nút; tắt ngay khi rời đi.
        enterDelay: 250,
        enterNextDelay: 250,
        leaveDelay: 0,
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          transition: [
            `box-shadow ${MOTION_DURATION.normal}ms ${MOTION_EASING.standard}`,
            `border-color ${MOTION_DURATION.fast}ms ${MOTION_EASING.standard}`,
          ].join(", "),
        },
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
        root: {
          borderRadius: 8,
          fontSize: 12.5,
          transition: CONTROL_TRANSITION,
        },
      },
    },
    MuiIconButton: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          fontSize: 18,
          transition: CONTROL_TRANSITION,
          "&:active:not(.Mui-disabled)": {
            transform: "scale(0.92)",
            transitionDuration: `${MOTION_DURATION.instant}ms`,
          },
        },
      },
    },
  },
});
