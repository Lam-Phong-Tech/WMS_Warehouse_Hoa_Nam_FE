/**
 * UiDatePicker / UiDateRangePicker — bộ chọn ngày ĐIỀU KHIỂN TRỰC TIẾP
 * (không RHF) cho toolbar báo cáo/bộ lọc.
 *
 * Underlying adapter: antd DatePicker/RangePicker (token hoá qua antd-adapter)
 * — thay bằng MUI X khi có Decision, cùng lộ trình UiFormDate. Value contract
 * dayjs|null (giữ nguyên như antd) để call site hiện hành không đổi logic.
 */
import { useMemo } from "react";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import { ANTD_PICKER_ICONS, antdAllowClear } from "@/shared/ui/icons";
import { defaultDateBounds } from "@/shared/validation/date-rules";

/**
 * Mốc chung cho mọi ô ngày antd. antd cho GÕ TAY: không có minDate/maxDate thì
 * "31-12-9999" được nhận (phản hồi 05/09/2026). rc-picker gộp minDate/maxDate
 * vào disabledDate và dùng chính hàm đó để từ chối chuỗi gõ tay (useInvalidate),
 * nên đặt mốc ở đây là chặn được cả bàn phím lẫn lịch.
 */
function useDateBounds(minDate?: Dayjs | null, maxDate?: Dayjs | null) {
  const fallback = useMemo(() => defaultDateBounds(), []);
  return {
    minDate: minDate ?? fallback.minDate,
    maxDate: maxDate ?? fallback.maxDate,
  };
}

const { RangePicker } = DatePicker;

export interface UiDatePickerProps {
  value: Dayjs | null;
  onChange: (value: Dayjs | null) => void;
  placeholder?: string;
  format?: string;
  allowClear?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  /** Ngày sớm nhất được chọn/gõ. Bỏ trống = mốc chung của dự án (2000-01-01). */
  minDate?: Dayjs | null;
  /** Ngày muộn nhất được chọn/gõ. Bỏ trống = hôm nay + 10 năm. */
  maxDate?: Dayjs | null;
}

export function UiDatePicker({
  value,
  onChange,
  placeholder,
  format = "DD-MM-YYYY",
  allowClear = true,
  disabled = false,
  "aria-label": ariaLabel,
  minDate: minDateProp,
  maxDate: maxDateProp,
}: UiDatePickerProps) {
  const { minDate, maxDate } = useDateBounds(minDateProp, maxDateProp);
  return (
    <DatePicker
      value={value}
      onChange={onChange}
      minDate={minDate}
      maxDate={maxDate}
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
  /** Ngày sớm nhất được chọn/gõ. Bỏ trống = mốc chung của dự án (2000-01-01). */
  minDate?: Dayjs | null;
  /** Ngày muộn nhất được chọn/gõ. Bỏ trống = hôm nay + 10 năm. */
  maxDate?: Dayjs | null;
}

export function UiDateRangePicker({
  value,
  onChange,
  placeholder,
  format = "DD-MM-YYYY",
  allowClear = true,
  disabled = false,
  "aria-label": ariaLabel,
  minDate: minDateProp,
  maxDate: maxDateProp,
}: UiDateRangePickerProps) {
  const { minDate, maxDate } = useDateBounds(minDateProp, maxDateProp);
  return (
    <RangePicker
      value={value}
      minDate={minDate}
      maxDate={maxDate}
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
