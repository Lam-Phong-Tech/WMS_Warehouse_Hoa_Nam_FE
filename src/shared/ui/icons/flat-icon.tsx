/**
 * FLATICON UICONS — factory tạo component icon dùng được ở MỌI slot icon của
 * dự án (MUI `IconComponent`/`slots`, antd `suffixIcon`/`closeIcon`, sonner
 * `icons`, hoặc JSX thường).
 *
 * Vì sao cần factory riêng thay vì dùng thẳng `UiIcon`:
 *  - MUI truyền `ownerState` + `fontSize="small"` xuống slot component (chúng
 *    hợp lệ với SvgIcon nhưng sẽ rơi thẳng ra DOM và React sẽ cảnh báo nếu ta
 *    render `<i>`), nên phải NUỐT hai prop đó.
 *  - Một số slot (MUI Select icon, Autocomplete popup indicator, antd clear
 *    icon) truyền `className` mang state (mở/đóng → rotate) — phải GHÉP thêm
 *    class chứ không được ghi đè.
 *  - Vài slot cần ref (MUI Tabs scroll button) → forwardRef.
 *
 * Font CSS nạp một lần duy nhất ở src/main.tsx
 * (@flaticon/flaticon-uicons/css/regular/rounded.css).
 */
import { forwardRef } from "react";
import { flatIconClass } from "./icon-family";
import type { CSSProperties, HTMLAttributes } from "react";

export interface FlatIconElementProps extends HTMLAttributes<HTMLElement> {
  /** MUI slot API bơm ownerState xuống — không được đẩy ra DOM. */
  ownerState?: unknown;
  /** MUI SvgIcon API (`fontSize="small"`) — cỡ do `size` của factory quyết. */
  fontSize?: unknown;
}

export interface CreateFlatIconOptions {
  /** Cỡ glyph (px). Bỏ trống ⇒ kế thừa font-size của chỗ đặt. */
  size?: number;
  /** displayName cho React DevTools / test snapshot. */
  displayName?: string;
  /** Style bổ sung (vd rotate cho mũi tên "trang cuối"). */
  style?: CSSProperties;
}

/**
 * Tạo component icon Flaticon từ slug (biến thể do ICON_FAMILY quyết định).
 * Slug PHẢI tồn tại trong bộ font đã cài — guard `yarn ui:icons` kiểm tra
 * toàn bộ slug xuất hiện trong src/ so với CSS của package.
 */
export function createFlatIcon(
  slug: string,
  options: CreateFlatIconOptions = {},
) {
  const { size, displayName, style: baseStyle } = options;

  const FlatIcon = forwardRef<HTMLElement, FlatIconElementProps>(
    function FlatIcon(
      {
        className,
        style,
        ownerState: _ownerState,
        fontSize: _fontSize,
        ...rest
      },
      ref,
    ) {
      const slugClass = flatIconClass(slug);
      return (
        <i
          ref={ref}
          aria-hidden="true"
          {...rest}
          className={className ? `${slugClass} ${className}` : slugClass}
          style={{
            display: "inline-flex",
            lineHeight: 1,
            ...(size != null ? { fontSize: size } : null),
            ...baseStyle,
            ...style,
          }}
        />
      );
    },
  );

  FlatIcon.displayName = displayName ?? `FlatIcon(${slug})`;
  return FlatIcon;
}
