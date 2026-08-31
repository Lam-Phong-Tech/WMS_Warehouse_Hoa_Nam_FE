import dayjs, { type Dayjs } from "dayjs";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";

export type Raw = Record<string, unknown>;

export type SelectOption = { value: string; label: string };

/** Số lượng — luôn qua formatQuantity để mọi bảng/chart cùng một cách đọc số. */
export const fmt = (value: unknown) => formatQuantity(Number(value ?? 0));

export const text = (value: unknown, fallback: string = EMPTY_TEXT): string =>
  value === null || value === undefined || value === ""
    ? fallback
    : String(value);

export const n = (value: unknown, fallback = 0): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const fmtDate = (value: unknown) => formatDate(text(value, ""));
export const fmtDateTime = (value: unknown) => formatDateTime(text(value, ""));

/** Tỉ lệ phần trăm hiển thị — 1 chữ số thập phân, không đuôi ".0" thừa. */
export function pct(part: number, total: number): string {
  if (!total) return "0%";
  const value = (part / total) * 100;
  return `${Number(value.toFixed(1))}%`;
}

/** Ngày trong `occurred_at`/`created_at` dạng ISO hoặc "YYYY-MM-DD HH:mm:ss". */
export function dayKey(value: unknown): string {
  const raw = text(value, "");
  if (raw === "") return "";
  return raw.slice(0, 10);
}

/** Giờ:phút của một mốc thời gian, dùng cho bộ lọc khung giờ. */
export function minuteOfDay(value: unknown): number | null {
  const raw = text(value, "");
  const match = /[T ](\d{2}):(\d{2})/u.exec(raw);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function parseHourMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/u.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function objectOf(value: unknown): Raw {
  return value && typeof value === "object" ? (value as Raw) : {};
}

export function listOf(value: unknown): Raw[] {
  return Array.isArray(value) ? (value as Raw[]) : [];
}

// ── Bộ lọc thời gian dùng chung cho 7 tab ────────────────────────────────

export type PeriodPreset =
  | "this-week"
  | "this-month"
  | "this-quarter"
  | "this-year"
  | "custom";

export const PERIOD_PRESET_OPTIONS: Array<{
  value: PeriodPreset;
  label: string;
}> = [
  { value: "this-week", label: "Tuần này" },
  { value: "this-month", label: "Tháng này" },
  { value: "this-quarter", label: "Quý này" },
  { value: "this-year", label: "Năm này" },
  { value: "custom", label: "Tùy chọn" },
];

/**
 * Khoảng ngày của một preset. Tuần bắt đầu từ THỨ HAI (dayjs mặc định Chủ
 * nhật) — kho vận hành theo tuần làm việc, một báo cáo "tuần này" bắt đầu vào
 * Chủ nhật sẽ lệch hẳn một ngày so với cách người dùng đọc lịch.
 */
export function presetRange(preset: PeriodPreset): [Dayjs, Dayjs] {
  const today = dayjs();
  if (preset === "this-month") {
    return [today.startOf("month"), today];
  }
  if (preset === "this-quarter") {
    // Đầu quý = tháng đầu tiên của quý hiện tại (tránh phụ thuộc plugin quarterOfYear).
    const quarterStartMonth = Math.floor(today.month() / 3) * 3;
    return [today.month(quarterStartMonth).startOf("month"), today];
  }
  if (preset === "this-year") {
    return [today.startOf("year"), today];
  }
  const weekday = (today.day() + 6) % 7;
  return [today.subtract(weekday, "day").startOf("day"), today];
}

export const API_DATE = "YYYY-MM-DD";

/** Nhãn ngày ngắn cho trục hoành chart theo ngày (dd/MM). */
export function axisDayLabel(isoDate: string): string {
  const parsed = dayjs(isoDate);
  return parsed.isValid() ? parsed.format("DD/MM") : isoDate;
}

// ── Phân loại hàng hóa (Sản phẩm / Linh kiện) ────────────────────────────

export type ItemKind = "all" | "PRODUCT" | "COMPONENT";

export const ITEM_KIND_OPTIONS: Array<{ value: ItemKind; label: string }> = [
  { value: "all", label: "Tất cả loại hàng" },
  { value: "PRODUCT", label: "Sản phẩm" },
  { value: "COMPONENT", label: "Linh kiện" },
];

export const ITEM_KIND_LABELS: Readonly<Record<string, string>> = {
  PRODUCT: "Sản phẩm",
  COMPONENT: "Linh kiện",
};

/** Chuỗi ngày liên tục [from, to] — chart theo ngày phải có cả ngày trống. */
export function dateSpan(from: string, to: string): string[] {
  const start = dayjs(from);
  const end = dayjs(to);
  if (!start.isValid() || !end.isValid() || end.isBefore(start, "day")) {
    return [];
  }
  const days: string[] = [];
  let cursor = start.startOf("day");
  // Chặn trần cùng ngưỡng BE (366 ngày) để một khoảng lọc sai không dựng
  // hàng nghìn cột rồi treo trình duyệt.
  while (!cursor.isAfter(end, "day") && days.length <= 366) {
    days.push(cursor.format(API_DATE));
    cursor = cursor.add(1, "day");
  }
  return days;
}
