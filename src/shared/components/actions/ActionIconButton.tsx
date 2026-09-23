import { IconButton, type IconButtonProps } from "@mui/material";
import { ACTION_KINDS, actionColor, type ActionKind } from "./action-kinds";
import {
  ACTION_APPEARANCE_DEFAULT,
  actionSurfaceSx,
  type ActionAppearance,
} from "./action-surface";

export interface ActionIconButtonProps extends Omit<
  IconButtonProps,
  "color" | "size" | "children"
> {
  /** Hành động nghiệp vụ — quyết định icon và màu icon. */
  kind: ActionKind;
  /**
   * Nhãn cho tooltip + aria-label. Bắt buộc để nút chỉ-icon vẫn đọc được:
   * mặc định lấy nhãn chuẩn của `kind`.
   */
  label?: string;
  /** Kiểu bề mặt. Bỏ trống = theo mặc định toàn dự án. */
  appearance?: ActionAppearance;
}

/**
 * NÚT CHỈ-ICON CHUẨN — dùng cho thao tác phụ trong modal/drawer/ô hẹp
 * (đóng modal, gỡ file đính kèm, phóng to ảnh...) nơi không đủ chỗ cho nhãn.
 *
 * Cùng nguồn icon + màu với `<ActionButton />` nên không bao giờ lệch;
 * khác biệt duy nhất là ẩn nhãn và luôn có tooltip/aria-label.
 *
 * Trong BẢNG dữ liệu hãy dùng `<ActionButton />` (có nhãn) thay vì nút này.
 */
export function ActionIconButton({
  kind,
  label,
  appearance = ACTION_APPEARANCE_DEFAULT,
  title,
  "aria-label": ariaLabel,
  ...iconButtonProps
}: ActionIconButtonProps) {
  const spec = ACTION_KINDS[kind];
  const Icon = spec.icon;
  const text = label ?? spec.label;
  const tonal = appearance === "tonal";

  return (
    <IconButton
      {...iconButtonProps}
      data-action-kind={kind}
      data-action-tone={spec.tone}
      data-action-appearance={appearance}
      size="small"
      title={title ?? text}
      aria-label={ariaLabel ?? text}
      sx={{
        ...(tonal ? actionSurfaceSx(kind) : null),
        ...iconButtonProps.sx,
      }}
    >
      {tonal ? <Icon /> : <Icon style={{ color: actionColor(kind) }} />}
    </IconButton>
  );
}
