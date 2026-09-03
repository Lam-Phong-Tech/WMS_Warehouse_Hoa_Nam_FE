import { InputAdornment, TextField } from "@mui/material";
import type { TextFieldProps } from "@mui/material";
import { SearchOutlined } from "@/shared/components/icons";
import { ActionIconButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";

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
  placeholder,
  width = 260,
  sx,
  slotProps,
  ...rest
}: SearchInputProps) {
  const t = useT();
  const resolvedPlaceholder =
    placeholder ?? t("shared.table.searchPlaceholder");
  // `aria-label` được gắn cho THẺ INPUT bên dưới (slotProps.htmlInput). Phải
  // tách nó khỏi `rest`, nếu không nó rơi xuống cả div bọc của TextField và ô
  // tìm kiếm có HAI phần tử mang cùng tên trợ năng — trình đọc màn hình đọc
  // lặp, còn `getByLabelText` trong test thì báo "Found multiple elements".
  const { "aria-label": ariaLabelProp, ...rootProps } = rest as typeof rest & {
    "aria-label"?: string;
  };
  const ariaLabel = ariaLabelProp ?? resolvedPlaceholder;

  return (
    <TextField
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={resolvedPlaceholder}
      autoComplete="off"
      // width cố định qua maxWidth (không phải width tuyệt đối) để control vẫn
      // co được dưới 576px theo baseline responsive chung.
      //
      // CHIỀU CAO: cố ý KHÔNG ghi đè padding dọc — để nguyên `C.input.paddingY`
      // của theme thì ô cao đúng 38px (CONTROL.height), bằng UiSelect,
      // UiTextField và UiVuexyDateField đứng cạnh nó trong mọi thanh lọc.
      // Trước đây chỗ này ép padding 6px để khớp antd Select (~35px); từ khi
      // toolbar chuyển hết sang MUI (Part 4) thì không còn antd Select nào
      // trong `src/` nữa, nên phép bù đó chỉ còn làm ô tìm kiếm THẤP hơn 2px so
      // với các control bên cạnh (thấy rõ ở thanh lọc 8 màn Báo cáo).
      sx={{
        width: "100%",
        maxWidth: width,
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
                label={t("shared.table.clearSearch")}
                edge="end"
                onClick={() => onChange?.("")}
              />
            </InputAdornment>
          ) : undefined,
          ...(slotProps?.input as object),
        },
      }}
      {...rootProps}
    />
  );
}
