/**
 * Re-export các layout/overlay primitive của MUI qua bề mặt design system —
 * feature code import từ `@/shared/ui` thay vì chạm thẳng `@mui/material`
 * (biên giới: docs/ui/vuexy-sync/13-import-boundary-policy.md).
 *
 * Chỉ re-export primitive KHÔNG mang ngữ nghĩa nghiệp vụ (Box/Stack/Grid/…).
 * Control có ngữ nghĩa (Button, TextField, Chip, Dialog…) phải dùng bản
 * canonical Ui* — không re-export để tránh 2 public choice cùng purpose.
 */
export { default as Box, type BoxProps } from "@mui/material/Box";
export { default as Drawer, type DrawerProps } from "@mui/material/Drawer";
export { default as useMediaQuery } from "@mui/material/useMediaQuery";
export { default as Stack, type StackProps } from "@mui/material/Stack";
export { default as Grid, type GridProps } from "@mui/material/Grid";
export { default as Divider, type DividerProps } from "@mui/material/Divider";
export { default as Tooltip, type TooltipProps } from "@mui/material/Tooltip";
export { default as Popover, type PopoverProps } from "@mui/material/Popover";
export { default as Menu, type MenuProps } from "@mui/material/Menu";
export {
  default as MenuItem,
  type MenuItemProps,
} from "@mui/material/MenuItem";
export {
  default as ListItemIcon,
  type ListItemIconProps,
} from "@mui/material/ListItemIcon";
export {
  default as ListItemText,
  type ListItemTextProps,
} from "@mui/material/ListItemText";
export {
  default as Skeleton,
  type SkeletonProps,
} from "@mui/material/Skeleton";
export { default as Badge, type BadgeProps } from "@mui/material/Badge";
export {
  default as LinearProgress,
  type LinearProgressProps,
} from "@mui/material/LinearProgress";
export {
  default as Collapse,
  type CollapseProps,
} from "@mui/material/Collapse";
export { default as Switch, type SwitchProps } from "@mui/material/Switch";
export {
  default as Checkbox,
  type CheckboxProps,
} from "@mui/material/Checkbox";
export { default as Radio, type RadioProps } from "@mui/material/Radio";
export {
  default as FormControlLabel,
  type FormControlLabelProps,
} from "@mui/material/FormControlLabel";
