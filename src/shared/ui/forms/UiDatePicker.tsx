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
import { ANTD_PICKER_ICONS, antdAllowClear } from "@/shared/ui/icons";

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
  format = "DD-MM-YYYY",
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
      // antd mặc định vẽ CalendarOutlined/CloseCircleFilled của @ant-design/icons
      // — ép về Flaticon Uicons (@/shared/ui/icons).
      suffixIcon={ANTD_PICKER_ICONS.suffixIcon}
      allowClear={antdAllowClear(allowClear)}
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
  format = "DD-MM-YYYY",
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
      suffixIcon={ANTD_PICKER_ICONS.suffixIcon}
      // Dấu ngăn giữa 2 ô mặc định là SwapRightOutlined (@ant-design/icons).
      separator={ANTD_PICKER_ICONS.separator}
      allowClear={antdAllowClear(allowClear)}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
}
