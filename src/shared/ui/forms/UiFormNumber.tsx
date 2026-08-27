/**
 * UiFormNumber — ô nhập số canonical (Part 3 Vuexy sync).
 *
 * Giá trị lưu trong form là number | null (chuỗi rỗng → null). Chuỗi đang gõ
 * dở ("1.", "-", "1,") được giữ ở state text cục bộ — chỉ đẩy vào form khi
 * parse được số hợp lệ; blur sẽ chốt lại (clamp min/max + chuẩn hoá text).
 * Chấp nhận cả dấu phẩy thập phân kiểu Việt ("1,5" → 1.5).
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldValues,
  type Path,
} from "react-hook-form";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";

export interface UiFormNumberProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  required?: boolean;
  placeholder?: string;
  /** Helper mặc định — bị message lỗi validation đè khi field invalid. */
  helperText?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Mặc định true. */
  fullWidth?: boolean;
  min?: number;
  max?: number;
  /** Hậu tố hiển thị ở endAdornment, vd "₫", "kg". */
  suffix?: ReactNode;
  "data-testid"?: string;
}

/**
 * Parse chuỗi nhập → number | null | undefined.
 * - "" → null (xoá giá trị)
 * - số hợp lệ → number
 * - đang gõ dở / không parse được → undefined (giữ nguyên form value)
 */
function parseNumberText(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const numeric = Number(trimmed.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : undefined;
}

interface NumberInnerProps<T extends FieldValues> extends Omit<
  UiFormNumberProps<T>,
  "control" | "name"
> {
  field: ControllerRenderProps<T, Path<T>>;
  fieldState: ControllerFieldState;
}

/** Phần thân giữ state text cục bộ — tách riêng để mỗi field một state. */
function UiFormNumberInner<T extends FieldValues>({
  field,
  fieldState,
  label,
  required = false,
  placeholder,
  helperText,
  disabled = false,
  autoFocus = false,
  fullWidth = true,
  min,
  max,
  suffix,
  "data-testid": dataTestId,
}: NumberInnerProps<T>) {
  const formValue = (field.value as number | null | undefined) ?? null;
  const [text, setText] = useState<string>(
    formValue == null ? "" : String(formValue),
  );

  // Đồng bộ khi form value đổi từ BÊN NGOÀI (reset/setValue) — nếu text hiện
  // tại vẫn parse ra đúng giá trị form (vd "1." ↔ 1) thì giữ nguyên text đang gõ.
  useEffect(() => {
    setText((prev) => {
      const parsed = parseNumberText(prev);
      if (parsed !== undefined && Object.is(parsed, formValue)) return prev;
      return formValue == null ? "" : String(formValue);
    });
  }, [formValue]);

  const clamp = (value: number): number => {
    let next = value;
    if (min != null && next < min) next = min;
    if (max != null && next > max) next = max;
    return next;
  };

  const handleChange = (raw: string) => {
    setText(raw);
    const parsed = parseNumberText(raw);
    // Chỉ đẩy vào form khi parse được (null = xoá); gõ dở thì giữ form value cũ.
    if (parsed !== undefined) field.onChange(parsed);
  };

  const handleBlur = () => {
    const parsed = parseNumberText(text);
    if (parsed === undefined) {
      // Chuỗi không hợp lệ → khôi phục theo giá trị form hiện tại.
      setText(formValue == null ? "" : String(formValue));
    } else if (parsed === null) {
      field.onChange(null);
      setText("");
    } else {
      const clamped = clamp(parsed);
      field.onChange(clamped);
      setText(String(clamped));
    }
    field.onBlur();
  };

  return (
    <TextField
      size="small"
      fullWidth={fullWidth}
      label={label}
      required={required}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      error={Boolean(fieldState.error)}
      helperText={fieldState.error?.message ?? helperText}
      name={field.name}
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      inputRef={field.ref}
      slotProps={{
        input: {
          endAdornment: suffix ? (
            <InputAdornment position="end">{suffix}</InputAdornment>
          ) : undefined,
        },
        htmlInput: {
          inputMode: "decimal",
          ...(dataTestId ? { "data-testid": dataTestId } : {}),
        },
      }}
      autoComplete="off"
    />
  );
}

export function UiFormNumber<T extends FieldValues>({
  control,
  name,
  ...rest
}: UiFormNumberProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <UiFormNumberInner field={field} fieldState={fieldState} {...rest} />
      )}
    />
  );
}
