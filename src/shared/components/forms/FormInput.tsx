import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  Control,
  ControllerRenderProps,
  FieldValues,
  Path,
} from "react-hook-form";
import { Input } from "antd";
import { FormField } from "@/shared/components/forms/FormField";

export interface FormInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  placeholder?: string;
  prefix?: ReactNode;
  type?: React.HTMLInputTypeAttribute;
  /** Hiển thị dạng ô mật khẩu (Input.Password). */
  password?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  required?: boolean;
  size?: "small" | "middle" | "large";
  /** Chỉ cho phép nhập số (không cho phép chữ cái và ký tự đặc biệt). */
  numericOnly?: boolean;
  /** Chỉ cho phép nhập chữ cái và khoảng trắng (không cho phép số và ký tự đặc biệt). */
  alphabeticOnly?: boolean;
  /** Giới hạn số ký tự tối đa có thể nhập. */
  maxLength?: number;
}

/**
 * Lọc giá trị theo chế độ numericOnly / alphabeticOnly.
 * Trả về chuỗi đã lọc, hoặc null nếu không cần thay đổi.
 */
function sanitize(
  value: string,
  numericOnly: boolean,
  alphabeticOnly: boolean,
): string | null {
  let cleaned = value;
  if (numericOnly) {
    cleaned = value.replace(/[^0-9]/g, "");
  } else if (alphabeticOnly) {
    // \p{L} khớp mọi ký tự chữ cái Unicode (bao gồm tất cả dấu tiếng Việt)
    cleaned = value.replace(/[^\p{L}\s]/gu, "");
  }
  return cleaned !== value ? cleaned : null;
}

/* ------------------------------------------------------------------ */
/*  Inner component: quản lý local state để không bị react-hook-form  */
/*  re-render phá IME composition khi gõ tiếng Việt.                  */
/* ------------------------------------------------------------------ */

interface InnerProps {
  field: ControllerRenderProps<FieldValues, string>;
  InputComp: typeof Input | typeof Input.Password;
  placeholder?: string;
  prefix?: ReactNode;
  type?: React.HTMLInputTypeAttribute;
  autoFocus: boolean;
  disabled: boolean;
  allowClear: boolean;
  size: "small" | "middle" | "large";
  maxLength?: number;
  numericOnly: boolean;
  alphabeticOnly: boolean;
}

function FormInputInner({
  field,
  InputComp,
  placeholder,
  prefix,
  type,
  autoFocus,
  disabled,
  allowClear,
  size,
  maxLength,
  numericOnly,
  alphabeticOnly,
}: InnerProps) {
  // Local state đóng vai trò buffer — Input đọc value từ đây thay vì
  // trực tiếp từ field.value. Nhờ vậy, react-hook-form re-render (do
  // validation onChange) không thể ghi đè value đang compose dở.
  const [localValue, setLocalValue] = useState<string>(field.value ?? "");
  const composingRef = useRef(false);
  const justSanitizedRef = useRef(false);

  // Đồng bộ khi field.value thay đổi từ BÊN NGOÀI (reset form, setValue,
  // restore draft, load editing data...). Không đồng bộ trong lúc compose
  // để tránh ghi đè composition đang dở.
  const prevFieldValue = useRef(field.value);
  useEffect(() => {
    if (field.value !== prevFieldValue.current && !composingRef.current) {
      setLocalValue(field.value ?? "");
    }
    prevFieldValue.current = field.value;
  }, [field.value]);

  return (
    <InputComp
      /* eslint-disable react-hooks/refs -- field properties from react-hook-form ControllerRenderProps */
      ref={field.ref}
      name={field.name}
      value={localValue}
      onBlur={field.onBlur}
      /* eslint-enable react-hooks/refs */
      placeholder={placeholder}
      prefix={prefix}
      type={type}
      autoFocus={autoFocus}
      disabled={disabled}
      allowClear={allowClear}
      size={size}
      maxLength={maxLength}
      autoComplete="off"
      onCompositionStart={() => {
        composingRef.current = true;
        justSanitizedRef.current = false;
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        justSanitizedRef.current = false;
        const raw = (e.target as HTMLInputElement).value;

        // Composition kết thúc — đồng bộ giá trị cuối cùng lên react-hook-form.
        if (numericOnly || alphabeticOnly) {
          const cleaned = sanitize(raw, numericOnly, alphabeticOnly);
          const final = cleaned ?? raw;

          setLocalValue(final);
          field.onChange(final);
        } else {
          field.onChange(raw);
        }
      }}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;

        if (justSanitizedRef.current) {
          justSanitizedRef.current = false;
          if (raw.length < localValue.length && localValue.startsWith(raw)) {
            return;
          }
        }

        // Khi đang gõ tiếng Việt (composing), chỉ cập nhật state nội bộ để
        // hiển thị chữ. Không gọi field.onChange() để tránh re-render từ
        // react-hook-form làm ngắt quãng IME.
        if (composingRef.current) {
          setLocalValue(raw);

          return;
        }

        // Nếu không có luật sanitize, cập nhật thẳng và kết thúc sớm.
        if (!numericOnly && !alphabeticOnly) {
          setLocalValue(raw);
          field.onChange(raw);
          return;
        }

        // Nếu có luật sanitize, lọc giá trị TRƯỚC khi cập nhật state.
        // Điều này tránh tình trạng state tạm thời chứa giá trị "bẩn"
        // (VD: "abc·") gây ra các hành vi bất định.
        const cleaned = sanitize(raw, numericOnly, alphabeticOnly);
        const final = cleaned ?? raw;

        if (final !== raw) {
          justSanitizedRef.current = true;
        }

        setLocalValue(final);
        field.onChange(final);
      }}
    />
  );
}

/* ------------------------------------------------------------------ */

/** Ô nhập văn bản / mật khẩu tích hợp react-hook-form. */
export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  prefix,
  type = "text",
  password = false,
  autoFocus = false,
  disabled = false,
  allowClear = false,
  required = false,
  size = "large",
  numericOnly = false,
  alphabeticOnly = false,
  maxLength,
}: FormInputProps<T>) {
  const InputComp = password ? Input.Password : Input;

  return (
    <FormField control={control} name={name} label={label} required={required}>
      {(field) => (
        <FormInputInner
          field={field as unknown as ControllerRenderProps<FieldValues, string>}
          InputComp={InputComp}
          placeholder={placeholder}
          prefix={prefix}
          type={password ? undefined : type}
          autoFocus={autoFocus}
          disabled={disabled}
          allowClear={allowClear}
          size={size}
          maxLength={maxLength}
          numericOnly={numericOnly}
          alphabeticOnly={alphabeticOnly}
        />
      )}
    </FormField>
  );
}
