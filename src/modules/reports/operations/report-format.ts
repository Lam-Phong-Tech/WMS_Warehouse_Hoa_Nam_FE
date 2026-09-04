import type { MessageKey } from "@/shared/i18n/messages";
import type { TranslateFn } from "@/shared/i18n/useT";
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

/**
 * Kỳ dựng sẵn của mọi màn báo cáo.
 *
 * Bộ cũ chỉ có "tuần này / tháng này / quý này / năm nay" và cả bốn đều là kỳ
 * ĐẾN HIỆN TẠI (`[đầu kỳ → hôm nay]`). Hai vấn đề thật đã gặp:
 *
 *  1. Nhãn nói sai: mùng 4 bấm "Tháng này" ra 4 ngày dữ liệu, nhưng người đọc
 *     hiểu là cả tháng. Nay nhãn ghi thẳng "(đến nay)".
 *  2. Thiếu đúng thứ kho hay tra: không có "Hôm nay"/"Hôm qua" để soát ca vừa
 *     chạy, và không có KỲ ĐÃ ĐÓNG ("Tháng trước") — thứ mà đối soát/quyết
 *     toán luôn cần, vì kỳ đang chạy thì con số còn thay đổi.
 *
 * Chia hai nhóm theo cách người dùng nghĩ: nhóm CUỘN LÙI đếm ngược từ hôm nay,
 * nhóm THEO LỊCH bám mốc lịch. `custom` là trạng thái rơi vào khi tự chọn ngày,
 * không phải một mục bấm được.
 */
export type PeriodPreset =
  | "today"
  | "yesterday"
  | "last-7"
  | "last-30"
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "this-year"
  | "custom";

/** Kỳ cuộn lùi: đếm ngược từ hôm nay. */
export const ROLLING_PRESETS = [
  "today",
  "yesterday",
  "last-7",
  "last-30",
] as const satisfies ReadonlyArray<PeriodPreset>;

/** Kỳ theo lịch: bám mốc đầu tháng / quý / năm. */
export const CALENDAR_PRESETS = [
  "this-month",
  "last-month",
  "this-quarter",
  "this-year",
] as const satisfies ReadonlyArray<PeriodPreset>;

/** Mọi kỳ bấm được, đúng thứ tự hiển thị. */
export const PERIOD_PRESETS: ReadonlyArray<Exclude<PeriodPreset, "custom">> = [
  ...ROLLING_PRESETS,
  ...CALENDAR_PRESETS,
];

const PRESET_LABEL_KEYS = {
  today: "reports.period.today",
  yesterday: "reports.period.yesterday",
  "last-7": "reports.period.last7",
  "last-30": "reports.period.last30",
  "this-month": "reports.period.thisMonth",
  "last-month": "reports.period.lastMonth",
  "this-quarter": "reports.period.thisQuarter",
  "this-year": "reports.period.thisYear",
  custom: "reports.period.custom",
} as const satisfies Record<PeriodPreset, MessageKey>;

export function periodPresetLabel(
  preset: PeriodPreset,
  t: TranslateFn,
): string {
  return t(PRESET_LABEL_KEYS[preset]);
}

export const periodPresetOptions = (
  t: TranslateFn,
): Array<{ value: PeriodPreset; label: string }> => [
  ...PERIOD_PRESETS.map((preset) => ({
    value: preset as PeriodPreset,
    label: periodPresetLabel(preset, t),
  })),
  { value: "custom", label: t("reports.period.custom") },
];

/**
 * Khoảng ngày của một preset, tính TẠI THỜI ĐIỂM GỌI.
 *
 * `custom` không có khoảng riêng — rơi vào đây thì trả về kỳ mặc định để hàm
 * luôn tổng; nơi gọi tự giữ khoảng người dùng đã chọn.
 */
export function presetRange(preset: PeriodPreset): [Dayjs, Dayjs] {
  const today = dayjs().startOf("day");
  switch (preset) {
    case "today":
      return [today, today];
    case "yesterday": {
      const yesterday = today.subtract(1, "day");
      return [yesterday, yesterday];
    }
    // "7 ngày qua" tính CẢ hôm nay → lùi 6 ngày, không phải 7. Lùi 7 sẽ ra 8
    // mốc, lệch hẳn một ngày so với con số ghi trên nhãn.
    case "last-7":
      return [today.subtract(6, "day"), today];
    case "last-30":
      return [today.subtract(29, "day"), today];
    case "last-month": {
      const previous = today.subtract(1, "month");
      return [
        previous.startOf("month"),
        previous.endOf("month").startOf("day"),
      ];
    }
    case "this-quarter": {
      // Đầu quý = tháng đầu tiên của quý hiện tại (tránh phụ thuộc plugin
      // quarterOfYear).
      const quarterStartMonth = Math.floor(today.month() / 3) * 3;
      return [today.month(quarterStartMonth).startOf("month"), today];
    }
    case "this-year":
      return [today.startOf("year"), today];
    case "this-month":
    case "custom":
    default:
      return [today.startOf("month"), today];
  }
}

export const API_DATE = "YYYY-MM-DD";

/** Nhãn ngày ngắn cho trục hoành chart theo ngày (dd-MM). */
export function axisDayLabel(isoDate: string): string {
  const parsed = dayjs(isoDate);
  return parsed.isValid() ? parsed.format("DD-MM") : isoDate;
}

// ── Phân loại hàng hóa (Sản phẩm / Linh kiện) ────────────────────────────

export type ItemKind = "all" | "PRODUCT" | "COMPONENT";

export const itemKindOptions = (
  t: TranslateFn,
): Array<{ value: ItemKind; label: string }> => [
  { value: "all", label: t("reports.itemKind.all") },
  { value: "PRODUCT", label: t("reports.itemKind.product") },
  { value: "COMPONENT", label: t("reports.itemKind.component") },
];

export const ITEM_KIND_LABEL_KEYS: Readonly<Record<string, MessageKey>> = {
  PRODUCT: "reports.itemKind.product",
  COMPONENT: "reports.itemKind.component",
};

export function itemKindLabel(kind: string, t: TranslateFn): string {
  const key = ITEM_KIND_LABEL_KEYS[kind];
  return key ? t(key) : t("reports.itemKind.unclassified");
}

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
