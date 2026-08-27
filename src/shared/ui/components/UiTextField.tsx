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

export function UiTextField(props: UiTextFieldProps) {
  return <TextField size="small" {...props} />;
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
