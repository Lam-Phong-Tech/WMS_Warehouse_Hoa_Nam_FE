/**
 * UiFormDate — ô chọn ngày canonical (Part 3 Vuexy sync).
 *
 * underlying adapter: antd DatePicker — thay bằng MUI X khi có Decision.
 *
 * VALUE-CONTRACT (giữ đúng bản cũ src/shared/components/forms/FormDatePicker):
 * giá trị lưu trong form là ĐỐI TƯỢNG dayjs (theo antd DatePicker), không phải
 * chuỗi ISO. Label/error/helper render bằng MUI FormControl/FormLabel/
 * FormHelperText (label 13px theo theme) để đồng nhất với các field khác.
 */
import { useId } from "react";
import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import { ANTD_PICKER_ICONS, antdAllowClear } from "@/shared/ui/icons";

export interface UiFormDateProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  required?: boolean;
  /** Định dạng hiển thị của antd DatePicker. */
  format?: string;
  allowClear?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Helper mặc định — bị message lỗi validation đè khi field invalid. */
  helperText?: ReactNode;
  /** Mặc định true. */
  fullWidth?: boolean;
  "data-testid"?: string;
}

export function UiFormDate<T extends FieldValues>({
  control,
  name,
  label,
  required = false,
  format = "DD/MM/YYYY",
  allowClear = true,
  disabled = false,
  placeholder,
  helperText,
  fullWidth = true,
  "data-testid": dataTestId,
}: UiFormDateProps<T>) {
  // id nối FormLabel ↔ input bên trong DatePicker (antd áp id lên input gốc).
  const inputId = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const message = fieldState.error?.message ?? helperText;
        return (
          <FormControl
            fullWidth={fullWidth}
            required={required}
            disabled={disabled}
            error={Boolean(fieldState.error)}
          >
            {label != null ? (
              <FormLabel htmlFor={inputId} sx={{ mb: 0.5 }}>
                {label}
              </FormLabel>
            ) : null}
            <DatePicker
              id={inputId}
              // Giá trị form là dayjs | null — truyền thẳng, không convert.
              value={(field.value as Dayjs | null | undefined) ?? null}
              onChange={(date) => field.onChange(date)}
              onBlur={field.onBlur}
              format={format}
              // Calendar/clear mặc định của antd là @ant-design/icons — ép Flaticon.
              suffixIcon={ANTD_PICKER_ICONS.suffixIcon}
              allowClear={antdAllowClear(allowClear)}
              disabled={disabled}
              placeholder={placeholder}
              status={fieldState.error ? "error" : undefined}
              style={{ width: "100%" }}
              autoComplete="off"
              data-testid={dataTestId}
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
