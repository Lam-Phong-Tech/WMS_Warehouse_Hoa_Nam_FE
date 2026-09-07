/**
 * Barrel icon của design system. Feature/screen KHÔNG import trực tiếp file
 * con — dùng `@/shared/ui` (hoặc `@/shared/ui/icons`).
 */
export { ICON_FAMILY, flatIconClass } from "./icon-family";
export { watchIconFontHealth } from "./icon-font-health";
export {
  createFlatIcon,
  type FlatIconElementProps,
  type CreateFlatIconOptions,
} from "./flat-icon";
export {
  ICON_SLUGS,
  MUI_ICON_SLOTS,
  ANTD_PICKER_ICONS,
  ANTD_CLOSE_ICON,
  ANTD_ALERT_ICONS,
  TOAST_ICONS,
  antdAllowClear,
  ExpandIcon,
  PrevIcon,
  NextIcon,
  FirstPageIcon,
  LastPageIcon,
  ClearIcon,
  CloseIcon,
  ChipDeleteIcon,
  CheckboxBlankIcon,
  CheckboxCheckedIcon,
  CheckboxIndeterminateIcon,
  RadioBlankIcon,
  RadioCheckedIcon,
  SuccessIcon,
  InfoIcon,
  WarningIcon,
  ErrorIcon,
  LoadingIcon,
  CalendarIcon,
  RangeSeparatorIcon,
  GreetingIcon,
} from "./icon-slots";
export { VUEXY_NAV_ICONS, type VuexyNavIconName } from "./vuexy-nav-icon-paths";
export { VuexyNavIcon, type VuexyNavIconProps } from "./vuexy-nav-icons";
export {
  VUEXY_DEMO_ICONS,
  type VuexyDemoIconName,
} from "./vuexy-demo-icon-paths";
export { VuexyDemoIcon } from "./VuexyDemoIcon";
