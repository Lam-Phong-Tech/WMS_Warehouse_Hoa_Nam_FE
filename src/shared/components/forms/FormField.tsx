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
  /**
   * Id của control bên trong để `<label for>` trỏ đúng ô nhập.
   * Chỉ truyền khi control thực sự render đúng id đó; nếu không, label sẽ trỏ hụt
   * và trình đọc màn hình đọc sai (a11y — WWHN-274 / FE274-P2-03).
   */
  htmlFor?: string;
  /** Render input bên trong, nhận `field` và trạng thái lỗi của react-hook-form. */
  children: (
    field: ControllerRenderProps<T, Path<T>>,
    fieldState: { invalid: boolean },
  ) => ReactNode;
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
  htmlFor,
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
          htmlFor={htmlFor}
          validateStatus={fieldState.error ? "error" : ""}
          help={fieldState.error?.message ?? help}
        >
          {children(field, { invalid: Boolean(fieldState.error) })}
        </Form.Item>
      )}
    />
  );
}
