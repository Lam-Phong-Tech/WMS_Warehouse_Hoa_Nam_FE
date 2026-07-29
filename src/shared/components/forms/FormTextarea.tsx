import type { ReactNode } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Input } from "antd";
import { FormField } from "@/shared/components/forms/FormField";

const { TextArea } = Input;

export interface FormTextareaProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  disabled?: boolean;
}

/** Ô nhập nhiều dòng tích hợp react-hook-form. */
export function FormTextarea<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  rows = 4,
  maxLength,
  showCount = false,
  disabled = false,
}: FormTextareaProps<T>) {
  return (
    <FormField control={control} name={name} label={label}>
      {(field) => (
        <TextArea
          {...field}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          showCount={showCount}
          disabled={disabled}
          autoComplete="off"
        />
      )}
    </FormField>
  );
}
