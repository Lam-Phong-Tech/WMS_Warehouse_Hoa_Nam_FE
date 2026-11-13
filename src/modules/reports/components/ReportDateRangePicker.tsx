import { businessToday } from "@/shared/utils/date-time";
import { useMemo } from "react";
import { useT } from "@/shared/i18n/useT";
import {
  UiVuexyDateRangePicker,
  type UiVuexyDateRangePickerProps,
} from "@/shared/ui/forms/UiVuexyDateRangePicker";
import { reportRangePresets } from "../operations/report-range-presets";
import "./report-date-range-picker.css";

/** Một kiểu chọn khoảng ngày cho mọi báo cáo, gồm lịch và các kỳ chọn nhanh. */
export function ReportDateRangePicker({
  presets,
  className,
  popupClassName,
  maxDate,
  showFieldPrefixes = false,
  ...props
}: UiVuexyDateRangePickerProps) {
  const t = useT();
  const defaultPresets = useMemo(() => reportRangePresets(t), [t]);

  return (
    <UiVuexyDateRangePicker
      {...props}
      allowClear={false}
      showFieldPrefixes={showFieldPrefixes}
      format="DD/MM/YYYY"
      presets={presets ?? defaultPresets}
      maxDate={maxDate ?? businessToday().endOf("day")}
      className={
        className
          ? `hn-report-date-range hn-vuexy-date-range ${className}`
          : "hn-report-date-range hn-vuexy-date-range"
      }
      popupClassName={
        popupClassName
          ? `hn-report-date-popup hn-vuexy-date-popup ${popupClassName}`
          : "hn-report-date-popup hn-vuexy-date-popup"
      }
    />
  );
}
