import type { Control, FieldValues, Path } from "react-hook-form";
import { Select, type SelectProps } from "antd";
import {
  FormField,
  type FormFieldProps,
} from "@/shared/components/forms/FormField";

export type FormSelectProps<T extends FieldValues> =
  // Gộp tất cả props của Antd Select
  SelectProps &
    // Props cho react-hook-form
    { control: Control<T>; name: Path<T> } &
    // Props cho FormField wrapper (label, help text)
    Partial<Pick<FormFieldProps<T>, "label" | "help" | "tooltip" | "required">>;

/** Ô chọn (đơn/đa) tích hợp react-hook-form. */
export function FormSelect<T extends FieldValues>({
  control,
  name,
  label,
  help,
  tooltip,
  required,
  ...rest
}: FormSelectProps<T>) {
  return (
    // `label` được truyền vào FormField, các props còn lại của Select được truyền vào <Select>
    <FormField
      control={control}
      name={name}
      label={label}
      help={help}
      tooltip={tooltip}
      required={required}
    >
      {(field) => (
        <Select
          {...field}
          {...rest}
          // antd Select chỉ hiện placeholder khi value là undefined/null;
          // '' (giá trị mặc định của react-hook-form) khiến nó hiển thị trống thay vì placeholder
          value={field.value === "" ? undefined : field.value}
          style={{ width: "100%" }}
        />
      )}
    </FormField>
  );
}
