import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import { tStatic } from "@/shared/i18n/useT";

dayjs.extend(quarterOfYear);

/**
 * BA (2026-08-27): Dashboard chỉ nắm nhanh tình hình theo kỳ preset — xem chi
 * tiết theo ngày/tháng/khoảng ngày tuỳ ý thuộc về Báo cáo, không phải Dashboard.
 */
export type DashboardPeriodPreset =
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "year";

// Getter để `label` đọc theo ngôn ngữ HIỆN TẠI mỗi lần truy cập (API mảng
// {value, label} giữ nguyên cho caller cũ; file thuần TS không gọi được hook).
export const DASHBOARD_PERIOD_PRESETS: Array<{
  value: DashboardPeriodPreset;
  label: string;
}> = [
  {
    value: "today",
    get label() {
      return tStatic("shared.period.today");
    },
  },
  {
    value: "week",
    get label() {
      return tStatic("shared.period.week");
    },
  },
  {
    value: "month",
    get label() {
      return tStatic("shared.period.month");
    },
  },
  {
    value: "quarter",
    get label() {
      return tStatic("shared.period.quarter");
    },
  },
  {
    value: "year",
    get label() {
      return tStatic("shared.period.year");
    },
  },
];

// dayjs.OpUnitType không có "quarter" trừ khi TS thấy augmentation của plugin
// quarterOfYear ngay tại điểm dùng — khai kiểu riêng để không phụ thuộc việc đó.
type PresetUnit = "day" | "week" | "month" | "quarter" | "year";

const PRESET_UNIT: Record<DashboardPeriodPreset, PresetUnit> = {
  today: "day",
  week: "week",
  month: "month",
  quarter: "quarter",
  year: "year",
};

export function getPresetRange(preset: DashboardPeriodPreset): {
  from_date: string;
  to_date: string;
} {
  const unit = PRESET_UNIT[preset] as dayjs.OpUnitType;
  const now = dayjs();
  return {
    from_date: now.startOf(unit).format("YYYY-MM-DD"),
    to_date: now.endOf(unit).format("YYYY-MM-DD"),
  };
}
