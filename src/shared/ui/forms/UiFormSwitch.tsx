/**
 * UiFormSwitch — công tắc canonical (Part 3 Vuexy sync).
 *
 * RHF Controller + FormControlLabel + Switch (giá trị boolean). Lỗi
 * validation hiển thị qua FormHelperText của FormControl bọc ngoài.
 */
import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Switch from "@mui/material/Switch";

export interface UiFormSwitchProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  required?: boolean;
  /** Helper mặc định — bị message lỗi validation đè khi field invalid. */
  helperText?: ReactNode;
  disabled?: boolean;
  "data-testid"?: string;
}

export function UiFormSwitch<T extends FieldValues>({
  control,
  name,
  label,
  required = false,
  helperText,
  disabled = false,
  "data-testid": dataTestId,
}: UiFormSwitchProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const message = fieldState.error?.message ?? helperText;
        return (
          <FormControl
            error={Boolean(fieldState.error)}
            disabled={disabled}
            data-testid={dataTestId}
          >
            <FormControlLabel
              required={required}
              disabled={disabled}
              control={
                <Switch
                  size="small"
                  checked={Boolean(field.value)}
                  onChange={(event) => field.onChange(event.target.checked)}
                  onBlur={field.onBlur}
                  name={field.name}
                  // MUI 9 bỏ inputRef — ref của RHF nối qua slot input.
                  slotProps={{ input: { ref: field.ref } }}
                />
              }
              label={label}
            />
            {message != null ? (
              <FormHelperText>{message}</FormHelperText>
            ) : null}
          </FormControl>
        );
      }}
    />
  );
}
