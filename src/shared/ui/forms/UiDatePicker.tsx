/**
 * UiDatePicker / UiDateRangePicker — bộ chọn ngày ĐIỀU KHIỂN TRỰC TIẾP
 * (không RHF) cho toolbar báo cáo/bộ lọc.
 *
 * Underlying adapter: antd DatePicker/RangePicker (token hoá qua antd-adapter)
 * — thay bằng MUI X khi có Decision, cùng lộ trình UiFormDate. Value contract
 * dayjs|null (giữ nguyên như antd) để call site hiện hành không đổi logic.
 */
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";

const { RangePicker } = DatePicker;

export interface UiDatePickerProps {
  value: Dayjs | null;
  onChange: (value: Dayjs | null) => void;
  placeholder?: string;
  format?: string;
  allowClear?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}

export function UiDatePicker({
  value,
  onChange,
  placeholder,
  format,
  allowClear = true,
  disabled = false,
  "aria-label": ariaLabel,
}: UiDatePickerProps) {
  return (
    <DatePicker
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      format={format}
      allowClear={allowClear}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
}

export interface UiDateRangePickerProps {
  value: [Dayjs | null, Dayjs | null] | null;
  onChange: (value: [Dayjs | null, Dayjs | null] | null) => void;
  placeholder?: [string, string];
  format?: string;
  allowClear?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}

export function UiDateRangePicker({
  value,
  onChange,
  placeholder,
  format,
  allowClear = true,
  disabled = false,
  "aria-label": ariaLabel,
}: UiDateRangePickerProps) {
  return (
    <RangePicker
      value={value}
      onChange={(next) => onChange(next as [Dayjs | null, Dayjs | null] | null)}
      placeholder={placeholder}
      format={format}
      allowClear={allowClear}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
}
