/**
 * UiSelect — select ĐIỀU KHIỂN TRỰC TIẾP (value/onChange, không RHF) cho
 * toolbar/bộ lọc — thay antd Select và MUI Select trần trong feature (Part 4).
 * Bản RHF cho form: UiFormSelect (@/shared/ui/forms).
 */
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useId } from "react";
import type { ReactNode } from "react";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";

export interface UiSelectChoice {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
}

export interface UiSelectProps {
  value: string | number | "";
  onChange: (value: string) => void;
  options: UiSelectChoice[];
  /** Nhãn nổi (InputLabel). Bỏ trống khi dùng aria-label. */
  label?: ReactNode;
  /** Bắt buộc khi không có label hiển thị. */
  "aria-label"?: string;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Bề rộng tối thiểu cho toolbar (px). */
  minWidth?: number;
  "data-testid"?: string;
}

export function UiSelect({
  value,
  onChange,
  options,
  label,
  "aria-label": ariaLabel,
  placeholder,
  disabled = false,
  fullWidth = false,
  minWidth,
  "data-testid": dataTestId,
}: UiSelectProps) {
  const labelId = useId();
  return (
    <FormControl
      size="small"
      disabled={disabled}
      fullWidth={fullWidth}
      sx={minWidth ? { minWidth } : undefined}
    >
      {label ? <InputLabel id={labelId}>{label}</InputLabel> : null}
      <Select
        labelId={label ? labelId : undefined}
        label={label}
        value={value}
        onChange={(event) => onChange(String(event.target.value))}
        displayEmpty={Boolean(placeholder)}
        inputProps={ariaLabel ? { "aria-label": ariaLabel } : undefined}
        renderValue={
          placeholder
            ? (selected) => {
                if (selected === "" || selected === undefined) {
                  return (
                    <span style={{ color: S.textDisabled }}>{placeholder}</span>
                  );
                }
                const match = options.find((o) => o.value === selected);
                return <>{match?.label ?? String(selected)}</>;
              }
            : undefined
        }
        data-testid={dataTestId}
      >
        {placeholder ? (
          <MenuItem value="">
            <span style={{ color: S.textDisabled }}>{placeholder}</span>
          </MenuItem>
        ) : null}
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
    </FormControl>
  );
}
