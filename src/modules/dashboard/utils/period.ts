import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import isoWeek from "dayjs/plugin/isoWeek";
import type { MessageKey } from "@/shared/i18n/messages";
import type { TranslateFn } from "@/shared/i18n/useT";

dayjs.extend(quarterOfYear);
dayjs.extend(isoWeek);

/** Kỳ xem của chart "Nhập – Xuất theo thời gian". */
export type FlowPeriod = "week" | "month" | "quarter" | "year";

/**
 * Kỳ xem của chart "Xu hướng tồn kho". Trước đây chỉ tuần/tháng; mở rộng đủ 4
 * kỳ (tuần/tháng/quý/năm) theo yêu cầu vận hành mục 1 — kỳ dài được gộp bucket
 * để đường tồn còn đọc được xu hướng thay vì một dải điểm ngày đặc.
 */
export type TrendPeriod = FlowPeriod;

export const FLOW_PERIOD_OPTIONS: Array<{
  value: FlowPeriod;
  labelKey: MessageKey;
}> = [
  { value: "week", labelKey: "dashboard.period.week" },
  { value: "month", labelKey: "dashboard.period.month" },
  { value: "quarter", labelKey: "dashboard.period.quarter" },
  { value: "year", labelKey: "dashboard.period.year" },
];

export const TREND_PERIOD_OPTIONS: Array<{
  value: TrendPeriod;
  labelKey: MessageKey;
}> = FLOW_PERIOD_OPTIONS;

export function getPeriodRange(period: FlowPeriod): {
  from_date: string;
  to_date: string;
} {
  const now = dayjs();
  const unit = period as dayjs.OpUnitType;
  return {
    from_date: now.startOf(unit).format("YYYY-MM-DD"),
    to_date: now.endOf(unit).format("YYYY-MM-DD"),
  };
}

/**
 * Độ mịn hiển thị của từng kỳ.
 *
 * BE chỉ phát hành chuỗi theo NGÀY (DATE_TRUNC là PostgreSQL-only trong khi repo
 * gate cả SQLite), nên việc gộp nằm ở đây. Kỳ càng dài thì bucket càng thô: 365 điểm
 * ngày vẽ thành một dải đặc không đọc được xu hướng nào cả — đúng thứ mà chart này
 * tồn tại để thể hiện.
 */
const GRAIN: Record<FlowPeriod, "day" | "isoWeek" | "month"> = {
  week: "day",
  month: "day",
  quarter: "isoWeek",
  year: "month",
};

type Dated = { date: string };

function bucketKey(date: string, grain: "day" | "isoWeek" | "month"): string {
  return dayjs(date).startOf(grain).format("YYYY-MM-DD");
}

function bucketLabel(
  key: string,
  grain: "day" | "isoWeek" | "month",
  t?: TranslateFn,
): string {
  const value = dayjs(key);
  if (grain === "month") {
    const month = value.month() + 1;
    const year = value.year();
    return t
      ? t("dashboard.period.monthBucket", { month, year })
      : `Th${month}/${year}`;
  }
  if (grain === "isoWeek") {
    const index = value.isoWeek();
    return t ? t("dashboard.period.weekBucket", { index }) : `Tuần ${index}`;
  }
  return value.format("DD/MM");
}

/**
 * Gộp chuỗi ngày theo độ mịn của kỳ. `reduce` quyết định cách hợp nhất các ngày
 * trong cùng bucket — lượng nhập/xuất thì CỘNG, còn tồn cuối kỳ thì lấy giá trị
 * NGÀY CUỐI (cộng dồn tồn cuối lại với nhau là vô nghĩa).
 */
export function bucketSeries<T extends Dated>(
  points: T[],
  period: FlowPeriod,
  reduce: (accumulated: T, next: T) => T,
  /** Bỏ trống thì nhãn bucket giữ nguyên tiếng Việt (dùng cho test/util thuần). */
  t?: TranslateFn,
): Array<{ label: string; point: T }> {
  const grain = GRAIN[period];
  const buckets = new Map<string, T>();
  for (const point of points) {
    const key = bucketKey(point.date, grain);
    const existing = buckets.get(key);
    buckets.set(key, existing ? reduce(existing, point) : point);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, point]) => ({ label: bucketLabel(key, grain, t), point }));
}

/** Kỳ "tuần" vẽ cột nhóm; từ "tháng" trở đi chuyển sang đường (spec mục 1). */
export function isColumnPeriod(period: FlowPeriod): boolean {
  return period === "week";
}
