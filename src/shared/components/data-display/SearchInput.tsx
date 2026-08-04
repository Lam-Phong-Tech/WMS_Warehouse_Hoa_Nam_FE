import { Input } from "antd";
import type { InputProps } from "antd";
import { SearchOutlined } from "@ant-design/icons";

export interface SearchInputProps extends Omit<
  InputProps,
  "onChange" | "prefix" | "allowClear"
> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Default: 260 */
  width?: number | string;
}

/**
 * Ô tìm kiếm chuẩn hoá: prefix SearchOutlined, allowClear, aria-label tự động.
 * onChange nhận string thay vì ChangeEvent để dùng trực tiếp với state setter.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  width = 260,
  size = "large",
  style,
  ...rest
}: SearchInputProps) {
  return (
    <Input
      allowClear
      prefix={<SearchOutlined />}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      size={size}
      aria-label={rest["aria-label"] ?? placeholder}
      style={{ width, ...style }}
      autoComplete="off"
      {...rest}
    />
  );
}
