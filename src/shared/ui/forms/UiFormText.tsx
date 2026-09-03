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
import { flatIconClass } from "@/shared/ui/icons/icon-family";
import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import { UiIconButton } from "../components/UiButton";
import InputAdornment from "@mui/material/InputAdornment";
import { SEMANTIC_LIGHT as S, inkAlphaVar } from "../tokens";
import { useT } from "@/shared/i18n/useT";

/**
 * MUI (bản đang dùng trong dự án) tự sinh/gỡ CSS động cho biến thể
 * "&.Mui-error" của notchedOutline/label một cách không ổn định (đã quan
 * sát được viền/label KHÔNG đổi đỏ dù class Mui-error có mặt) — ép màu trực
 * tiếp qua sx gắn với fieldState.error để đồng bộ tuyệt đối với validation.
 */
const ERROR_FIELD_SX = {
  "& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline": {
    borderColor: S.error,
  },
  "& .MuiInputLabel-root.Mui-error": { color: S.error },
} as const;

export interface UiFormTextProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  /**
   * "floating" (mặc định) — nhãn nổi trong viền như MUI outlined.
   * "above" — nhãn TĨNH nằm trên ô + placeholder bên trong (pattern login-v2
   * của Vuexy). Chỉ đổi cách hiển thị nhãn, không đổi hành vi validation.
   */
  labelPlacement?: "floating" | "above";
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
  labelPlacement = "floating",
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
  const t = useT();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  // password đang ẩn → type "password"; bấm toggle → "text" để đọc được.
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  const endAdornment = isPassword ? (
    <InputAdornment position="end">
      <UiIconButton
        aria-label={
          showPassword
            ? t("shared.form.hidePassword")
            : t("shared.form.showPassword")
        }
        onClick={() => setShowPassword((prev) => !prev)}
        edge="end"
        disabled={disabled}
      >
        <i
          className={flatIconClass(showPassword ? "eye-crossed" : "eye")}
          aria-hidden
        />
      </UiIconButton>
    </InputAdornment>
  ) : undefined;

  const startIconSlug = type === "search" ? "search" : startIcon;
  const startAdornment = startIconSlug ? (
    <InputAdornment position="start">
      <i className={flatIconClass(startIconSlug)} aria-hidden />
    </InputAdornment>
  ) : undefined;

  const isAbove = labelPlacement === "above";
  const fieldId = isAbove ? `uift-${String(name)}` : undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const textField = (
          <TextField
            id={fieldId}
            size="small"
            fullWidth={fullWidth}
            // Nhãn "above" render riêng bên trên → TextField không nhận label
            // (tránh nhãn nổi trùng lặp trong viền).
            label={isAbove ? undefined : label}
            required={required}
            type={inputType}
            multiline={multiline}
            rows={rows}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            error={Boolean(fieldState.error)}
            sx={fieldState.error ? ERROR_FIELD_SX : undefined}
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
        );

        if (!isAbove) return textField;

        return (
          <Box>
            <Box
              component="label"
              htmlFor={fieldId}
              sx={{
                display: "block",
                marginBottom: "4px",
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1.15,
                color: fieldState.error ? S.error : inkAlphaVar(0.78),
              }}
            >
              {label}
              {required ? (
                <Box
                  component="span"
                  sx={{ color: S.error, marginLeft: "2px" }}
                >
                  *
                </Box>
              ) : null}
            </Box>
            {textField}
          </Box>
        );
      }}
    />
  );
}
