/**
 * UiFormAutocomplete — autocomplete canonical (Part 3 Vuexy sync).
 *
 * RHF Controller + MUI Autocomplete. Giá trị lưu trong form là scalar
 * (option.value) — single: string | number | null; multiple: Array<value>.
 * So khớp option theo `value` (isOptionEqualToValue).
 */
import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

export interface UiAutocompleteOption {
  value: string | number;
  /** Autocomplete cần label dạng chuỗi (getOptionLabel/lọc theo text). */
  label: string;
  disabled?: boolean;
}

export interface UiFormAutocompleteProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  options: UiAutocompleteOption[];
  label?: ReactNode;
  required?: boolean;
  multiple?: boolean;
  placeholder?: string;
  /** Helper mặc định — bị message lỗi validation đè khi field invalid. */
  helperText?: ReactNode;
  disabled?: boolean;
  /** Mặc định true. */
  fullWidth?: boolean;
  "data-testid"?: string;
}

export function UiFormAutocomplete<T extends FieldValues>({
  control,
  name,
  options,
  label,
  required = false,
  multiple = false,
  placeholder,
  helperText,
  disabled = false,
  fullWidth = true,
  "data-testid": dataTestId,
}: UiFormAutocompleteProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        // Map scalar trong form ↔ option object của Autocomplete.
        const selected = multiple
          ? options.filter((option) =>
              ((field.value as Array<string | number>) ?? []).includes(
                option.value,
              ),
            )
          : (options.find((option) => option.value === field.value) ?? null);

        return (
          <Autocomplete
            size="small"
            fullWidth={fullWidth}
            multiple={multiple}
            options={options}
            disabled={disabled}
            value={selected}
            onChange={(_event, next) => {
              if (multiple) {
                field.onChange(
                  ((next as UiAutocompleteOption[]) ?? []).map(
                    (option) => option.value,
                  ),
                );
              } else {
                field.onChange(
                  (next as UiAutocompleteOption | null)?.value ?? null,
                );
              }
            }}
            onBlur={field.onBlur}
            getOptionLabel={(option) => option.label}
            getOptionDisabled={(option) => Boolean(option.disabled)}
            isOptionEqualToValue={(option, valueOption) =>
              option.value === valueOption.value
            }
            noOptionsText="Không có lựa chọn"
            renderInput={(params) => (
              <TextField
                {...params}
                label={label}
                required={required}
                placeholder={placeholder}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message ?? helperText}
                inputRef={field.ref}
                slotProps={{
                  ...params.slotProps,
                  htmlInput: {
                    ...params.slotProps?.htmlInput,
                    ...(dataTestId ? { "data-testid": dataTestId } : {}),
                  },
                }}
              />
            )}
          />
        );
      }}
    />
  );
}
