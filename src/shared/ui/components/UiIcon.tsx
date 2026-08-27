/**
 * Foundation Icon wrapper — một icon family duy nhất (Flaticon Uicons,
 * `fi fi-rr-*`, CSS nạp một lần ở main.tsx). Kích thước theo token.
 *
 * Icon nghiệp vụ có tên sẵn: dùng shim `@/shared/components/icons`
 * (90 component, cùng cơ chế class này). UiIcon dành cho catalog/foundation
 * và icon mới chưa có trong shim.
 */
import { COMPONENT_TOKENS } from "@/shared/ui/tokens";

export interface UiIconProps {
  /** Slug Flaticon rounded-regular, vd "user", "box", "check" → fi-rr-<slug>. */
  name: string;
  size?: keyof typeof COMPONENT_TOKENS.icon;
  /** Màu bằng token — mặc định kế thừa màu chữ hiện tại. */
  color?: string;
  className?: string;
  "aria-label"?: string;
}

export function UiIcon({
  name,
  size = "md",
  color,
  className,
  "aria-label": ariaLabel,
}: UiIconProps) {
  return (
    <i
      className={`fi fi-rr-${name}${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      style={{
        fontSize: COMPONENT_TOKENS.icon[size],
        lineHeight: 1,
        display: "inline-flex",
        ...(color ? { color } : {}),
      }}
    />
  );
}
