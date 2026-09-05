/**
 * Foundation TextField/FormField — input chuẩn Vuexy (cao 38, radius 6,
 * chữ 15, label 13 — tất cả từ theme adapter).
 *
 * Binding React Hook Form (control/name) sẽ nối ở Part 3 khi hợp nhất lớp
 * forms; UiTextField là bề mặt input canonical cho catalog/screen mới.
 */
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import type { TextFieldProps } from "@mui/material/TextField";
import type { ReactNode } from "react";

export type UiTextFieldProps = TextFieldProps;

/**
 * LƯỚI AN TOÀN độ dài: ô nào không tự khai `maxLength` thì nhận trần này.
 * Cột text dài nhất của BE là 2000 (mô tả/ghi chú); không có lưới thì một lần
 * dán nhầm vài trăm nghìn ký tự vẫn đi thẳng lên API và đổi 422 đọc được thành
 * lỗi 413/500. Ô nghiệp vụ vẫn PHẢI khai trần riêng (mã 100, tên 255…) —
 * đây chỉ là trần cuối cùng, không phải luật của từng ô.
 */
const FALLBACK_MAX_LENGTH = 2000;

export function UiTextField({ slotProps, ...props }: UiTextFieldProps) {
  const htmlInput = (slotProps?.htmlInput ?? {}) as Record<string, unknown>;
  return (
    <TextField
      size="small"
      {...props}
      slotProps={{
        ...slotProps,
        htmlInput: { maxLength: FALLBACK_MAX_LENGTH, ...htmlInput },
      }}
    />
  );
}

/**
 * FormField shell: label 13px + control + helper/error — dùng khi control bên
 * trong không phải TextField (select/custom). Với TextField thường, dùng
 * thẳng UiTextField (label/helperText có sẵn).
 */
export interface UiFormFieldProps {
  label: ReactNode;
  required?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}

export function UiFormField({
  label,
  required,
  error,
  helperText,
  children,
  htmlFor,
}: UiFormFieldProps) {
  return (
    <FormControl fullWidth error={error} required={required}>
      <FormLabel htmlFor={htmlFor} sx={{ mb: 0.5 }}>
        {label}
      </FormLabel>
      {children}
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}
