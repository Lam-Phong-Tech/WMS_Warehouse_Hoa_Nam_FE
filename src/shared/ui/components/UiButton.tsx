/**
 * Foundation Button/IconButton — chuẩn Vuexy (cao 38, radius 6, chữ 15/500 —
 * tất cả đến từ theme adapter, component KHÔNG tự đặt số).
 *
 * LƯU Ý: nút hành động nghiệp vụ (có permission/kind/tonal) vẫn dùng
 * `ActionButton`/`ActionIconButton` (@/shared/components/actions) — lớp đó sẽ
 * được nối về foundation trong Part 3. UiButton là bề mặt canonical cho
 * catalog/screen mới.
 */
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import { UiSpinner } from "./UiSpinner";
import type { ButtonProps } from "@mui/material/Button";
import type { IconButtonProps } from "@mui/material/IconButton";

export type UiButtonAppearance = "filled" | "tonal" | "outlined" | "text";

export interface UiButtonProps extends Omit<ButtonProps, "variant"> {
  appearance?: UiButtonAppearance;
  loading?: boolean;
}

const APPEARANCE_TO_VARIANT: Record<
  UiButtonAppearance,
  ButtonProps["variant"]
> = {
  filled: "contained",
  tonal: "contained",
  outlined: "outlined",
  text: "text",
};

export function UiButton({
  appearance = "filled",
  loading = false,
  disabled,
  children,
  sx,
  color = "primary",
  startIcon,
  ...rest
}: UiButtonProps) {
  // "inherit" không có trong palette — tonal cần một tông thật để pha nền nhạt.
  const paletteColor = color === "inherit" ? "primary" : color;
  return (
    <Button
      variant={APPEARANCE_TO_VARIANT[appearance]}
      color={color}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      startIcon={loading ? <UiSpinner size={16} label={null} /> : startIcon}
      sx={
        appearance === "tonal"
          ? [
              (theme) => ({
                backgroundColor: `rgba(${hexToRgb(
                  theme.palette[paletteColor as "primary"].main,
                )}, 0.16)`,
                color: theme.palette[paletteColor as "primary"].dark,
                "&:hover": {
                  backgroundColor: `rgba(${hexToRgb(
                    theme.palette[paletteColor as "primary"].main,
                  )}, 0.24)`,
                },
                boxShadow: "none",
              }),
              ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
            ]
          : sx
      }
      {...rest}
    >
      {children}
    </Button>
  );
}

export type UiIconButtonProps = IconButtonProps;

export function UiIconButton(props: UiIconButtonProps) {
  return <IconButton {...props} />;
}

/** Chuyển hex token thành chuỗi kênh "r, g, b" — hỗ trợ tonal tint. */
function hexToRgb(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
