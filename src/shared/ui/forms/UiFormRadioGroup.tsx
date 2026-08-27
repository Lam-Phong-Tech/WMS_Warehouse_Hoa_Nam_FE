/**
 * UiFormRadioGroup — nhóm radio canonical (Part 3 Vuexy sync).
 *
 * RHF Controller + FormControl + FormLabel (gắn nhóm qua aria-labelledby) +
 * RadioGroup (role="radiogroup" — MUI mặc định). RadioGroup làm việc bằng
 * string nên value được String-hoá khi render và map ngược về kiểu gốc
 * (string | number) khi onChange.
 */
import { useId } from "react";
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
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";

export interface UiRadioOption {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
}

export interface UiFormRadioGroupProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  options: UiRadioOption[];
  label?: ReactNode;
  required?: boolean;
  /** Xếp các radio trên một hàng ngang. */
  row?: boolean;
  /** Helper mặc định — bị message lỗi validation đè khi field invalid. */
  helperText?: ReactNode;
  disabled?: boolean;
  "data-testid"?: string;
}

export function UiFormRadioGroup<T extends FieldValues>({
  control,
  name,
  options,
  label,
  required = false,
  row = false,
  helperText,
  disabled = false,
  "data-testid": dataTestId,
}: UiFormRadioGroupProps<T>) {
  const labelId = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const message = fieldState.error?.message ?? helperText;
        return (
          <FormControl
            error={Boolean(fieldState.error)}
            required={required}
            disabled={disabled}
            data-testid={dataTestId}
          >
            {label != null ? <FormLabel id={labelId}>{label}</FormLabel> : null}
            <RadioGroup
              row={row}
              aria-labelledby={label != null ? labelId : undefined}
              value={field.value != null ? String(field.value) : ""}
              onChange={(_event, next) => {
                // Map string của RadioGroup về đúng kiểu gốc của option.
                const matched = options.find(
                  (option) => String(option.value) === next,
                );
                field.onChange(matched ? matched.value : next);
              }}
              onBlur={field.onBlur}
              name={field.name}
            >
              {options.map((option) => (
                <FormControlLabel
                  key={String(option.value)}
                  value={String(option.value)}
                  disabled={option.disabled}
                  control={<Radio size="small" />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
            {message != null ? (
              <FormHelperText>{message}</FormHelperText>
            ) : null}
          </FormControl>
        );
      }}
    />
  );
}
