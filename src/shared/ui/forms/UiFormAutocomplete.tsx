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
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";

export interface UiAutocompleteOption {
  value: string | number;
  /** Autocomplete cần label dạng chuỗi (getOptionLabel/lọc theo text). */
  label: string;
  disabled?: boolean;
}

/**
 * Sentinel riêng cho dòng "+ Thêm mới" — không phải giá trị thật, chỉ dùng để
 * nhận diện lúc chọn rồi chặn không cho vào field.value (chuỗi cố ý dài/lạ để
 * không bao giờ trùng value thật, vốn thường là UUID).
 */
const ADD_NEW_OPTION_VALUE = "__ui_form_autocomplete_add_new__";

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
  /**
   * Khi truyền vào, thêm 1 dòng đặc biệt cuối danh sách (label mặc định
   * "+ Thêm mới"). Chọn dòng này KHÔNG set giá trị field — chỉ gọi
   * `onAddNew()` (dùng cho case tạo nhanh 1 bản ghi danh mục ngay trong
   * dropdown, ví dụ "+ Thêm bệnh lỗi" ở form tiếp nhận bảo hành).
   */
  onAddNew?: () => void;
  addNewLabel?: string;
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
  onAddNew,
  addNewLabel = "+ Thêm mới",
}: UiFormAutocompleteProps<T>) {
  const optionsWithAddNew = onAddNew
    ? [...options, { value: ADD_NEW_OPTION_VALUE, label: addNewLabel }]
    : options;

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
            options={optionsWithAddNew}
            disabled={disabled}
            value={selected}
            onChange={(_event, next) => {
              if (multiple) {
                const nextOptions = (next as UiAutocompleteOption[]) ?? [];
                const addNewPicked = nextOptions.some(
                  (option) => option.value === ADD_NEW_OPTION_VALUE,
                );
                field.onChange(
                  nextOptions
                    .filter((option) => option.value !== ADD_NEW_OPTION_VALUE)
                    .map((option) => option.value),
                );
                if (addNewPicked) onAddNew?.();
              } else {
                const nextOption = next as UiAutocompleteOption | null;
                if (nextOption?.value === ADD_NEW_OPTION_VALUE) {
                  onAddNew?.();
                  return;
                }
                field.onChange(nextOption?.value ?? null);
              }
            }}
            onBlur={field.onBlur}
            getOptionLabel={(option) => option.label}
            getOptionDisabled={(option) => Boolean(option.disabled)}
            isOptionEqualToValue={(option, valueOption) =>
              option.value === valueOption.value
            }
            noOptionsText="Không có lựa chọn"
            renderOption={(optionProps, option) => {
              const { key, ...rest } = optionProps;
              if (option.value === ADD_NEW_OPTION_VALUE) {
                return (
                  <Box
                    component="li"
                    key={key}
                    {...rest}
                    sx={{
                      color: "primary.main",
                      fontWeight: 600,
                      gap: 0.75,
                      borderTop: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <i className="fi fi-rr-plus" aria-hidden="true" />
                    {option.label}
                  </Box>
                );
              }
              return (
                <li key={key} {...rest}>
                  {option.label}
                </li>
              );
            }}
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
