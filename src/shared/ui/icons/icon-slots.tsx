/**
 * ICON SLOTS — nơi DUY NHẤT khai báo icon mặc định mà MUI / antd / sonner tự
 * render (Select arrow, Checkbox tick, Alert severity, Pagination arrow,
 * DatePicker calendar, toast icon...).
 *
 * Nếu KHÔNG override, các thư viện này vẽ icon của BỘ RIÊNG chúng
 * (@mui/internal-svg-icons và @ant-design/icons đi kèm trong node_modules) —
 * tức dự án sẽ có 3 bộ icon lẫn lộn. Toàn bộ được ép về Flaticon Uicons ở đây.
 *
 * Cách nối vào runtime:
 *  - MUI  → `MUI_ICON_SLOTS` được trộn vào defaultProps trong mui-adapter.ts.
 *  - antd → `ANTD_*_ICONS` truyền tay ở wrapper (antd không có API global).
 *  - sonner → `TOAST_ICONS` truyền vào <Toaster icons> ở AppProviders.
 *  - Mũi tên panel DatePicker do antd vẽ bằng border CSS (không phải prop) →
 *    override bằng glyph Flaticon trong src/index.css.
 */
import { createFlatIcon } from "./flat-icon";

/**
 * REGISTRY slug — đổi bộ mặt icon của cả app chỉ bằng bảng này.
 * Mọi slug đã đối chiếu với @flaticon/flaticon-uicons đang cài (guard
 * `yarn ui:icons` fail nếu ai đó gõ slug không tồn tại).
 */
export const ICON_SLUGS = {
  expand: "angle-small-down",
  prev: "angle-small-left",
  next: "angle-small-right",
  first: "angle-double-small-left",
  last: "angle-double-small-right",
  clear: "cross-small",
  close: "cross-small",
  chipDelete: "cross-circle",
  checkboxBlank: "square",
  checkboxChecked: "checkbox",
  checkboxIndeterminate: "square-minus",
  radioBlank: "circle",
  radioChecked: "dot-circle",
  success: "check-circle",
  info: "info",
  warning: "triangle-warning",
  error: "cross-circle",
  loading: "spinner",
  calendar: "calendar",
  rangeSeparator: "arrow-right",
  greeting: "hand-wave",
} as const;

/* --------------------------------------------------------------------------
 * Component icon dùng lại giữa các slot
 * ----------------------------------------------------------------------- */

/** Cỡ chuẩn cho icon nằm trong control (input/select/pagination). */
const CONTROL_ICON_SIZE = 16;
/** Cỡ chuẩn cho ô tick (checkbox/radio) — khớp SvgIcon `small` của MUI. */
const TICK_ICON_SIZE = 20;
/** Cỡ chuẩn cho icon severity của Alert/toast. */
const STATUS_ICON_SIZE = 20;

export const ExpandIcon = createFlatIcon(ICON_SLUGS.expand, {
  size: CONTROL_ICON_SIZE,
  displayName: "ExpandIcon",
});
export const PrevIcon = createFlatIcon(ICON_SLUGS.prev, {
  size: 18,
  displayName: "PrevIcon",
});
export const NextIcon = createFlatIcon(ICON_SLUGS.next, {
  size: 18,
  displayName: "NextIcon",
});
export const FirstPageIcon = createFlatIcon(ICON_SLUGS.first, {
  size: 18,
  displayName: "FirstPageIcon",
});
export const LastPageIcon = createFlatIcon(ICON_SLUGS.last, {
  size: 18,
  displayName: "LastPageIcon",
});
export const ClearIcon = createFlatIcon(ICON_SLUGS.clear, {
  size: CONTROL_ICON_SIZE,
  displayName: "ClearIcon",
});
export const CloseIcon = createFlatIcon(ICON_SLUGS.close, {
  size: CONTROL_ICON_SIZE,
  displayName: "CloseIcon",
});
export const ChipDeleteIcon = createFlatIcon(ICON_SLUGS.chipDelete, {
  size: CONTROL_ICON_SIZE,
  displayName: "ChipDeleteIcon",
});
export const CheckboxBlankIcon = createFlatIcon(ICON_SLUGS.checkboxBlank, {
  size: TICK_ICON_SIZE,
  displayName: "CheckboxBlankIcon",
});
export const CheckboxCheckedIcon = createFlatIcon(ICON_SLUGS.checkboxChecked, {
  size: TICK_ICON_SIZE,
  displayName: "CheckboxCheckedIcon",
});
export const CheckboxIndeterminateIcon = createFlatIcon(
  ICON_SLUGS.checkboxIndeterminate,
  { size: TICK_ICON_SIZE, displayName: "CheckboxIndeterminateIcon" },
);
export const RadioBlankIcon = createFlatIcon(ICON_SLUGS.radioBlank, {
  size: TICK_ICON_SIZE,
  displayName: "RadioBlankIcon",
});
export const RadioCheckedIcon = createFlatIcon(ICON_SLUGS.radioChecked, {
  size: TICK_ICON_SIZE,
  displayName: "RadioCheckedIcon",
});
export const SuccessIcon = createFlatIcon(ICON_SLUGS.success, {
  size: STATUS_ICON_SIZE,
  displayName: "SuccessIcon",
});
export const InfoIcon = createFlatIcon(ICON_SLUGS.info, {
  size: STATUS_ICON_SIZE,
  displayName: "InfoIcon",
});
export const WarningIcon = createFlatIcon(ICON_SLUGS.warning, {
  size: STATUS_ICON_SIZE,
  displayName: "WarningIcon",
});
export const ErrorIcon = createFlatIcon(ICON_SLUGS.error, {
  size: STATUS_ICON_SIZE,
  displayName: "ErrorIcon",
});
/** Spinner quay bằng keyframes toàn cục `hn-spin` (src/index.css). */
export const LoadingIcon = createFlatIcon(ICON_SLUGS.loading, {
  size: STATUS_ICON_SIZE,
  displayName: "LoadingIcon",
  style: { animation: "hn-spin 900ms linear infinite" },
});
export const CalendarIcon = createFlatIcon(ICON_SLUGS.calendar, {
  size: CONTROL_ICON_SIZE,
  displayName: "CalendarIcon",
});
export const RangeSeparatorIcon = createFlatIcon(ICON_SLUGS.rangeSeparator, {
  size: CONTROL_ICON_SIZE,
  displayName: "RangeSeparatorIcon",
});
export const GreetingIcon = createFlatIcon(ICON_SLUGS.greeting, {
  displayName: "GreetingIcon",
});

/* --------------------------------------------------------------------------
 * MUI — trộn vào defaultProps ở mui-adapter.ts
 * ----------------------------------------------------------------------- */

/**
 * Danh sách component MUI CÓ icon mặc định của riêng nó. Guard `yarn ui:icons`
 * đối chiếu danh sách này với các component MUI thực sự được import trong src/
 * — import một component có icon mà chưa khai báo slot ở đây sẽ đỏ.
 */
export const MUI_ICON_SLOTS = {
  MuiSelect: { IconComponent: ExpandIcon },
  MuiNativeSelect: { IconComponent: ExpandIcon },
  MuiAutocomplete: {
    popupIcon: <ExpandIcon />,
    clearIcon: <ClearIcon />,
  },
  MuiCheckbox: {
    icon: <CheckboxBlankIcon />,
    checkedIcon: <CheckboxCheckedIcon />,
    indeterminateIcon: <CheckboxIndeterminateIcon />,
  },
  MuiRadio: {
    icon: <RadioBlankIcon />,
    checkedIcon: <RadioCheckedIcon />,
  },
  MuiChip: { deleteIcon: <ChipDeleteIcon /> },
  MuiAlert: {
    iconMapping: {
      success: <SuccessIcon />,
      info: <InfoIcon />,
      warning: <WarningIcon />,
      error: <ErrorIcon />,
    },
    slots: { closeIcon: CloseIcon },
  },
  MuiPaginationItem: {
    slots: {
      first: FirstPageIcon,
      last: LastPageIcon,
      next: NextIcon,
      previous: PrevIcon,
    },
  },
  MuiTabs: {
    slots: {
      startScrollButtonIcon: PrevIcon,
      endScrollButtonIcon: NextIcon,
    },
  },
} as const;

/* --------------------------------------------------------------------------
 * antd — không có API global, truyền tay ở wrapper trong @/shared/ui
 * ----------------------------------------------------------------------- */

/**
 * Icon cho antd DatePicker/RangePicker. `allowClear` của antd nhận object
 * `{ clearIcon }` nên helper bên dưới dựng đúng shape theo cờ boolean.
 */
export const ANTD_PICKER_ICONS = {
  suffixIcon: <CalendarIcon />,
  separator: <RangeSeparatorIcon />,
} as const;

export function antdAllowClear(enabled: boolean) {
  return enabled ? { clearIcon: <ClearIcon /> } : (false as const);
}

/** Icon nút đóng của antd Modal/Drawer. */
export const ANTD_CLOSE_ICON = <CloseIcon />;

/** Icon severity của antd Alert (`showIcon`). */
export const ANTD_ALERT_ICONS = {
  success: <SuccessIcon />,
  info: <InfoIcon />,
  warning: <WarningIcon />,
  error: <ErrorIcon />,
} as const;

/* --------------------------------------------------------------------------
 * sonner — <Toaster icons>
 * ----------------------------------------------------------------------- */

export const TOAST_ICONS = {
  success: <SuccessIcon />,
  info: <InfoIcon />,
  warning: <WarningIcon />,
  error: <ErrorIcon />,
  loading: <LoadingIcon />,
  close: <CloseIcon />,
} as const;
