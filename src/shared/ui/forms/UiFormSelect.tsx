/**
 * UiFormSelect — select canonical (Part 3 Vuexy sync).
 *
 * RHF Controller + MUI FormControl (size small) + InputLabel + Select +
 * MenuItem + FormHelperText. Hỗ trợ multiple; placeholder render qua
 * renderValue (màu textDisabled từ token) với displayEmpty.
 *
 * Danh sách DÀI (> SEARCHABLE_OPTION_THRESHOLD option, nhãn dạng chuỗi) tự đổi
 * sang ô gõ-để-tìm — cùng quy tắc với UiSelect. Hình dạng GIÁ TRỊ trong form
 * giữ nguyên ("" khi chưa chọn, mảng khi multiple) để schema/validate không
 * phải biết ô đang ở dạng nào. Ép tay bằng prop `searchable`.
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
import { UiAutocomplete } from "./UiAutocomplete";
import { resolveSearchable } from "./searchable-options";
import { OPTION_LIST_MAX_HEIGHT } from "./option-window";

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
  /**
   * Ép có/không ô tìm kiếm. Bỏ trống = tự quyết theo số option (xem
   * resolveSearchable).
   */
  searchable?: boolean;
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
  searchable,
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

  if (resolveSearchable(options, searchable)) {
    // Nhãn đã được resolveSearchable bảo đảm là chuỗi.
    const choices = options as Array<{
      value: string | number;
      label: string;
      disabled?: boolean;
    }>;
    return (
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => {
          const message = fieldState.error?.message ?? helperText;
          const common = {
            options: choices,
            label,
            required,
            disabled,
            fullWidth,
            placeholder,
            error: Boolean(fieldState.error),
            helperText: message,
            "data-testid": dataTestId,
          } as const;
          return multiple ? (
            <UiAutocomplete
              {...common}
              multiple
              value={(field.value as Array<string | number>) ?? []}
              onChange={(next) => field.onChange(next)}
            />
          ) : (
            <UiAutocomplete
              {...common}
              value={(field.value as string | number | null) ?? null}
              // Giữ nguyên "" là "chưa chọn" như nhánh Select, không đổi sang
              // null giữa chừng làm lệch schema của form.
              onChange={(next) => field.onChange(next ?? "")}
            />
          );
        }}
      />
    );
  }

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
              // Trần cao 5 dòng — cùng luật với UiSelect (xem option-window).
              MenuProps={{
                slotProps: {
                  paper: {
                    sx: {
                      maxWidth: 520,
                      maxHeight: OPTION_LIST_MAX_HEIGHT + 16,
                    },
                  },
                },
              }}
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
                  // Nhãn dài không gãy dòng: menu tự nở thay vì bẻ chữ.
                  sx={{ whiteSpace: "nowrap" }}
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
