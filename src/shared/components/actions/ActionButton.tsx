import type { ReactNode } from "react";
import { Button, type ButtonProps as MuiButtonProps } from "@mui/material";
import { ACTION_KINDS, actionColor, type ActionKind } from "./action-kinds";
import {
  ACTION_APPEARANCE_DEFAULT,
  actionSurfaceSx,
  type ActionAppearance,
} from "./action-surface";
import {
  usePermissionState,
  hasPermission,
} from "@/modules/auth/utils/permission";
import {
  getPermissionCode,
  type PermissionAction,
} from "@/shared/types/permission";
import { hasScopeForAction } from "@/shared/types/permission.scope";
import { UI_STATE, uiStateTestId } from "@/shared/constants/ui-state";

export interface ActionButtonProps extends Omit<
  MuiButtonProps,
  "startIcon" | "variant" | "color" | "size" | "action"
> {
  /** Hành động nghiệp vụ — quyết định icon, màu icon và nhãn mặc định. */
  kind: ActionKind;
  /** Ghi đè nhãn mặc định của `kind`. Cũng có thể truyền qua `children`. */
  label?: ReactNode;
  /** Ghi đè icon (hiếm dùng — ưu tiên thêm `kind` mới vào action-kinds). */
  icon?: ReactNode;
  /** Ẩn nhãn, chỉ hiện icon (dùng cho nút phụ trong modal). Vẫn giữ aria-label. */
  iconOnly?: boolean;
  /**
   * Kiểu bề mặt. Bỏ trống = theo mặc định toàn dự án
   * (`ACTION_APPEARANCE_DEFAULT`). Chỉ khai tại màn khi đang dùng thử.
   */
  appearance?: ActionAppearance;

  // — Kiểm soát quyền (tùy chọn; chỉ bật khi truyền đủ module + action) —
  /** Module để suy ra mã quyền. */
  module?: string;
  /** Loại thao tác để suy ra mã quyền. */
  action?: PermissionAction;
  /** Mã quyền tùy biến, ưu tiên hơn mapping module+action (scope vẫn theo module+action). */
  permissionCode?: string;
  /** 'hide' = ẩn khi thiếu quyền, 'disable' = hiện nhưng khóa. Mặc định suy theo quyền. */
  mode?: "hide" | "disable";
  /** Tooltip hiển thị khi bị khóa vì thiếu quyền. */
  disabledTooltip?: string;

  /** Test hook — giữ nguyên nếu màn tự khai, nếu không sẽ tự gắn khi bị khóa quyền. */
  "data-testid"?: string;
  /** Cờ trạng thái UI cho bằng chứng QA (WWHN-268). */
  "data-ui-state"?: string;
}

/**
 * NÚT HÀNH ĐỘNG CHUẨN — dùng cho MỌI thao tác trong toàn dự án.
 *
 * Hình thức chốt cứng, không cho lệch giữa các màn:
 *   • nền phẳng (MUI `variant="text"`), chữ màu primary
 *   • icon đứng trước nhãn, tô đúng tông màu nghiệp vụ theo `kind`
 *   • cỡ `small`, chiều cao 36px theo `muiTheme`
 *
 * Icon / màu / nhãn mặc định KHÔNG khai tại màn mà lấy từ
 * `action-kinds.tsx` — muốn thêm hành động thì thêm `kind` ở đó.
 *
 * ```tsx
 * <ActionButton kind="view" onClick={openView} />            // "Xem"
 * <ActionButton kind="edit" label="Sửa thông tin" ... />
 * <ActionButton kind="delete" module="sku" action="delete" mode="hide" />
 * ```
 */
export function ActionButton({
  kind,
  label,
  icon,
  iconOnly = false,
  appearance = ACTION_APPEARANCE_DEFAULT,
  module,
  action,
  permissionCode,
  mode,
  disabledTooltip = "Bạn không có quyền thực hiện thao tác này",
  children,
  disabled,
  title,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
  "data-ui-state": dataUiState,
  ...buttonProps
}: ActionButtonProps) {
  const state = usePermissionState();
  const spec = ACTION_KINDS[kind];
  const Icon = spec.icon;
  const text = label ?? children ?? spec.label;

  // Chỉ bật kiểm soát quyền khi màn khai đủ module + action.
  const permissionEnabled = Boolean(module && action);
  let isButtonDisabled = false;

  if (permissionEnabled) {
    const resolvedCode = getPermissionCode(
      action as PermissionAction,
      module as string,
      permissionCode,
    );
    const hasCodePermission = hasPermission(resolvedCode, state);
    const scopePassed = hasScopeForAction(
      state.currentScopeType,
      module as string,
      action as PermissionAction,
      state.isSuperAdmin,
    );
    const can = hasCodePermission && scopePassed;
    const effectiveMode = mode ?? (hasCodePermission ? "disable" : "hide");

    if (effectiveMode === "hide" && !can) return null;
    isButtonDisabled = effectiveMode === "disable" && !can;
  }

  const resolvedAriaLabel =
    ariaLabel ?? (iconOnly && typeof text === "string" ? text : undefined);

  // Bề mặt `tonal` đã tô màu cho cả chữ lẫn icon, nên icon kế thừa màu chữ;
  // bề mặt `flat` thì icon phải tự tô để còn phân biệt được hành động.
  const tonal = appearance === "tonal";
  const iconNode =
    icon ?? (tonal ? <Icon /> : <Icon style={{ color: actionColor(kind) }} />);

  return (
    <Button
      {...buttonProps}
      variant="text"
      size="small"
      color="primary"
      // WWHN-268: nút bị khóa vì quyền phải mang test hook "disabled" để bằng
      // chứng RBAC phân biệt được "bị khóa" với "ẩn".
      data-ui-state={
        dataUiState ?? (isButtonDisabled ? UI_STATE.DISABLED : undefined)
      }
      data-testid={
        dataTestId ??
        (isButtonDisabled ? uiStateTestId(UI_STATE.DISABLED) : undefined)
      }
      disabled={Boolean(disabled) || isButtonDisabled}
      title={isButtonDisabled ? disabledTooltip : title}
      aria-label={resolvedAriaLabel}
      sx={{
        whiteSpace: "nowrap",
        minWidth: iconOnly ? 0 : undefined,
        ...(tonal ? actionSurfaceSx(kind) : null),
        ...buttonProps.sx,
      }}
      startIcon={iconOnly ? undefined : iconNode}
    >
      {iconOnly ? iconNode : text}
    </Button>
  );
}
