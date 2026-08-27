import { InputAdornment, TextField } from "@mui/material";
import type { TextFieldProps } from "@mui/material";
import { SearchOutlined } from "@/shared/components/icons";
import { ActionIconButton } from "@/shared/components/actions";

export interface SearchInputProps extends Omit<
  TextFieldProps,
  "onChange" | "value" | "variant"
> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Default: 260 */
  width?: number | string;
}

/**
 * Ô tìm kiếm chuẩn hoá (MUI): icon tìm kiếm, nút xoá khi có giá trị, aria-label
 * tự động lấy từ placeholder nếu không truyền riêng.
 * onChange nhận string thay vì ChangeEvent để dùng trực tiếp với state setter.
 */
export function SearchInput({
  value = "",
  onChange,
  placeholder = "Tìm kiếm...",
  width = 260,
  sx,
  slotProps,
  ...rest
}: SearchInputProps) {
  const ariaLabel =
    (rest as { "aria-label"?: string })["aria-label"] ?? placeholder;

  return (
    <TextField
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      // width cố định qua maxWidth (không phải width tuyệt đối) để control vẫn
      // co được dưới 576px theo baseline responsive chung.
      // Giảm padding dọc so với mặc định muiTheme (10px) để chiều cao khớp
      // antd Select (~35px) đặt cạnh nhau trong FilterBar — padding mặc định
      // ra ~41.5px, cao hơn hẳn Select, nhìn lệch dù cùng size="small".
      sx={{
        width: "100%",
        maxWidth: width,
        "& .MuiOutlinedInput-input": {
          paddingTop: "6px",
          paddingBottom: "6px",
        },
        ...sx,
      }}
      slotProps={{
        ...slotProps,
        htmlInput: {
          "aria-label": ariaLabel,
          ...(slotProps?.htmlInput as object),
        },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchOutlined style={{ fontSize: 15 }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <ActionIconButton
                kind="clear"
                label="Xoá tìm kiếm"
                edge="end"
                onClick={() => onChange?.("")}
              />
            </InputAdornment>
          ) : undefined,
          ...(slotProps?.input as object),
        },
      }}
      {...rest}
    />
  );
}
