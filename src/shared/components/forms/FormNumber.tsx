import type { ReactNode } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { InputNumber } from "antd";
import { FormField } from "@/shared/components/forms/FormField";

export interface FormNumberProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  addonAfter?: ReactNode;
  disabled?: boolean;
  size?: "small" | "middle" | "large";
}

/** Ô nhập số tích hợp react-hook-form. */
export function FormNumber<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  min,
  max,
  step,
  addonAfter,
  disabled = false,
  size = "large",
}: FormNumberProps<T>) {
  return (
    <FormField control={control} name={name} label={label}>
      {(field) => (
        <InputNumber
          {...field}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          addonAfter={addonAfter}
          disabled={disabled}
          size={size}
          style={{ width: "100%" }}
          autoComplete="off"
        />
      )}
    </FormField>
  );
}
