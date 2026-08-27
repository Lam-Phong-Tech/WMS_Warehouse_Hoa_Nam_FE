/**
 * UiFormText — ô nhập text canonical của lớp form (Part 3 Vuexy sync).
 *
 * RHF Controller + MUI TextField (size="small", fullWidth mặc định) — lỗi
 * validation đọc từ fieldState.error?.message (error + helperText).
 *
 * type="password": nút toggle hiện/ẩn mật khẩu (aria-label đổi theo trạng thái).
 * type="search": icon kính lúp ở startAdornment.
 *
 * LƯU Ý IME: component KHÔNG can thiệp onKeyDown/onCompositionStart — gõ
 * tiếng Việt (Telex/VNI) phải nguyên vẹn, mọi phím đi thẳng vào input gốc.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import TextField from "@mui/material/TextField";
import { UiIconButton } from "../components/UiButton";
import InputAdornment from "@mui/material/InputAdornment";

export interface UiFormTextProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  required?: boolean;
  type?: "text" | "password" | "search";
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  /** Helper mặc định — bị message lỗi validation đè khi field invalid. */
  helperText?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Mặc định true — field canonical chiếm hết bề ngang khối form. */
  fullWidth?: boolean;
  /** Icon trang trí đầu ô (slug flaticon, vd "user"/"lock") — màu textDisabled. */
  startIcon?: string;
  /** Chỉ nhận chữ số 0-9 (vd ô OTP) — lọc trước khi ghi vào form state. */
  numericOnly?: boolean;
  /** Giới hạn số ký tự (thuộc tính maxLength của input gốc). */
  maxLength?: number;
  "data-testid"?: string;
}

export function UiFormText<T extends FieldValues>({
  control,
  name,
  label,
  required = false,
  type = "text",
  multiline = false,
  rows,
  placeholder,
  helperText,
  disabled = false,
  autoFocus = false,
  fullWidth = true,
  startIcon,
  numericOnly = false,
  maxLength,
  "data-testid": dataTestId,
}: UiFormTextProps<T>) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  // password đang ẩn → type "password"; bấm toggle → "text" để đọc được.
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  const endAdornment = isPassword ? (
    <InputAdornment position="end">
      <UiIconButton
        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        onClick={() => setShowPassword((prev) => !prev)}
        edge="end"
        disabled={disabled}
      >
        <i
          className={showPassword ? "fi fi-rr-eye-crossed" : "fi fi-rr-eye"}
          aria-hidden
        />
      </UiIconButton>
    </InputAdornment>
  ) : undefined;

  const startIconSlug = type === "search" ? "search" : startIcon;
  const startAdornment = startIconSlug ? (
    <InputAdornment position="start">
      <i className={`fi fi-rr-${startIconSlug}`} aria-hidden />
    </InputAdornment>
  ) : undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          size="small"
          fullWidth={fullWidth}
          label={label}
          required={required}
          type={inputType}
          multiline={multiline}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ?? helperText}
          name={field.name}
          value={(field.value as string | undefined) ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            field.onChange(numericOnly ? raw.replace(/[^0-9]/g, "") : raw);
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          slotProps={{
            input: { startAdornment, endAdornment },
            htmlInput: {
              ...(dataTestId ? { "data-testid": dataTestId } : {}),
              ...(maxLength !== undefined ? { maxLength } : {}),
              ...(numericOnly ? { inputMode: "numeric" as const } : {}),
            },
          }}
          autoComplete="off"
        />
      )}
    />
  );
}
