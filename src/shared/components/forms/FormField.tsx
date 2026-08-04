import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Form } from "antd";

export interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  help?: ReactNode;
  tooltip?: ReactNode;
  required?: boolean;
  /** Render input bên trong, nhận `field` của react-hook-form. */
  children: (field: ControllerRenderProps<T, Path<T>>) => ReactNode;
}

/**
 * Khung field dùng chung: gói Controller + Form.Item + hiển thị lỗi validation.
 * Các FormInput/FormSelect/... đều xây trên khung này để khỏi lặp.
 *
 * Validation được kích hoạt real-time:
 * - validateTrigger: onChange, onBlur (kiểm tra ngay khi người dùng nhập/rời khỏi field)
 * - Giúp người dùng thấy lỗi ngay lập tức mà không cần ấn nút lưu
 */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  help,
  tooltip,
  required,
  children,
}: FormFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Form.Item
          label={label}
          required={required}
          tooltip={tooltip}
          validateStatus={fieldState.error ? "error" : ""}
          help={fieldState.error?.message ?? help}
        >
          {children(field)}
        </Form.Item>
      )}
    />
  );
}
