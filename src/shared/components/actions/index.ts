/**
 * Lớp HÀNH ĐỘNG dùng chung — điểm import DUY NHẤT cho mọi nút thao tác.
 *
 *   import { ActionButton, ActionGroup } from "@/shared/components/actions";
 *
 * Quy ước bắt buộc toàn dự án:
 *   • Nút có nhãn  → <ActionButton kind="..." />
 *   • Cột thao tác → <RowActionGroup><RowActionButton kind="..." /></RowActionGroup>
 *   • Nút chỉ icon → <ActionIconButton kind="..." /> (chỉ ngoài bảng)
 *   • Nhóm nút     → <ActionGroup>...</ActionGroup>
 *   • KHÔNG tự chọn icon/màu tại màn — khai thêm `kind` trong action-kinds.tsx
 */
export { ActionButton, type ActionButtonProps } from "./ActionButton";
export {
  ActionIconButton,
  type ActionIconButtonProps,
} from "./ActionIconButton";
export { ActionGroup, type ActionGroupProps } from "./ActionGroup";
export { RowActionButton, type RowActionButtonProps } from "./RowActionButton";
export { RowActionGroup, type RowActionGroupProps } from "./RowActionGroup";
export {
  ACTION_KINDS,
  actionColor,
  actionIcon,
  type ActionKind,
  type ActionKindSpec,
} from "./action-kinds";
export {
  ACTION_APPEARANCE_DEFAULT,
  actionSurfaceSx,
  type ActionAppearance,
} from "./action-surface";
