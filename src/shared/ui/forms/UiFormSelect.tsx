/**
 * UiFormSelect — select canonical (Part 3 Vuexy sync).
 *
 * RHF Controller + MUI FormControl (size small) + InputLabel + Select +
 * MenuItem + FormHelperText. Hỗ trợ multiple; placeholder render qua
 * renderValue (màu textDisabled từ token) với displayEmpty.
 */
import { useId } from "react";
import { Fragment } from "react";
import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { SEMANTIC_LIGHT } from "@/shared/ui/tokens";

export interface UiSelectOption {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
}

export interface UiFormSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  options: UiSelectOption[];
  label?: ReactNode;
  required?: boolean;
  multiple?: boolean;
  /** Hiển thị khi chưa chọn gì (renderValue + displayEmpty, màu textDisabled). */
  placeholder?: string;
  /** Helper mặc định — bị message lỗi validation đè khi field invalid. */
  helperText?: ReactNode;
  disabled?: boolean;
  /** Mặc định true. */
  fullWidth?: boolean;
  "data-testid"?: string;
}

export function UiFormSelect<T extends FieldValues>({
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
}: UiFormSelectProps<T>) {
  const reactId = useId();
  const labelId = `${reactId}-label`;
  const hasPlaceholder = Boolean(placeholder);

  const renderValue = (selected: unknown): ReactNode => {
    const isEmpty = multiple
      ? !Array.isArray(selected) || selected.length === 0
      : selected == null || selected === "";
    if (isEmpty) {
      return hasPlaceholder ? (
        <span style={{ color: SEMANTIC_LIGHT.textDisabled }}>
          {placeholder}
        </span>
      ) : null;
    }
    if (multiple) {
      const values = selected as Array<string | number>;
      const labels = options
        .filter((option) => values.includes(option.value))
        .map((option) => option.label);
      // Nối label bằng ", " — label là ReactNode nên interleave qua Fragment.
      return labels.map((optionLabel, index) => (
        <Fragment key={index}>
          {index > 0 ? ", " : null}
          {optionLabel}
        </Fragment>
      ));
    }
    const matched = options.find((option) => option.value === selected);
    return matched ? matched.label : String(selected);
  };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value =
          (field.value as string | number | Array<string | number> | null) ??
          (multiple ? [] : "");
        const message = fieldState.error?.message ?? helperText;
        return (
          <FormControl
            size="small"
            fullWidth={fullWidth}
            required={required}
            disabled={disabled}
            error={Boolean(fieldState.error)}
            data-testid={dataTestId}
          >
            {label != null ? (
              <InputLabel
                id={labelId}
                // Có placeholder → label luôn shrink để không đè lên placeholder.
                shrink={hasPlaceholder ? true : undefined}
              >
                {label}
              </InputLabel>
            ) : null}
            <Select
              labelId={label != null ? labelId : undefined}
              label={label}
              multiple={multiple}
              displayEmpty={hasPlaceholder}
              value={value}
              onChange={(event) => field.onChange(event.target.value)}
              onBlur={field.onBlur}
              inputRef={field.ref}
              name={field.name}
              renderValue={renderValue}
            >
              {options.map((option) => (
                <MenuItem
                  key={String(option.value)}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {message != null ? (
              <FormHelperText>{message}</FormHelperText>
            ) : null}
          </FormControl>
        );
      }}
    />
  );
}
