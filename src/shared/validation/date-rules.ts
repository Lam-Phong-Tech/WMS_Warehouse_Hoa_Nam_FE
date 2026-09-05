/**
 * LUẬT NGÀY DÙNG CHUNG — giới hạn tuyệt đối cho mọi ô chọn ngày.
 *
 * Vì sao cần: bộ chọn ngày (antd DatePicker) cho GÕ TAY; không có `minDate/
 * maxDate` thì "31-12-9999" hay "01-01-0001" đều được nhận (phản hồi người dùng
 * 05/09/2026). Mọi ô ngày của dự án — kể cả bộ lọc báo cáo — phải nằm trong
 * một cửa sổ hữu hạn; màn nào cần chặt hơn (ngày sinh, ngày chứng từ) thì
 * dùng bộ mốc hẹp hơn ở đây chứ không tự nghĩ số.
 *
 * Mọi hàm trả về `Dayjs` ĐÃ `startOf("day")`/`endOf("day")` để so sánh theo
 * ngày, không lệch vì giờ.
 */
import dayjs, { type Dayjs } from "dayjs";
import { tStatic } from "@/shared/i18n/useT";

export const DATE_LIMITS = {
  /** Mốc sớm nhất của mọi ngày nghiệp vụ — hệ thống không có dữ liệu trước đó. */
  businessMinYear: 2000,
  /** Ngày kế hoạch/hạn xa nhất được phép: hôm nay + N năm. */
  futureMaxYears: 10,
  /** Ngày sinh sớm nhất. */
  birthMinYear: 1900,
  /** Tuổi lao động tối thiểu của tài khoản nhân viên. */
  minWorkingAge: 18,
} as const;

export interface DateBounds {
  minDate: Dayjs;
  maxDate: Dayjs;
}

/** Cửa sổ mặc định cho MỌI ô ngày: 01-01-2000 → hôm nay + 10 năm. */
export function defaultDateBounds(now: Dayjs = dayjs()): DateBounds {
  return {
    minDate: dayjs(`${DATE_LIMITS.businessMinYear}-01-01`).startOf("day"),
    maxDate: now.add(DATE_LIMITS.futureMaxYears, "year").endOf("day"),
  };
}

/** Ngày ĐÃ XẢY RA (ngày chứng từ, ngày mua, ngày nhận, bộ lọc lịch sử): ≤ hôm nay. */
export function pastDateBounds(now: Dayjs = dayjs()): DateBounds {
  return {
    minDate: dayjs(`${DATE_LIMITS.businessMinYear}-01-01`).startOf("day"),
    maxDate: now.endOf("day"),
  };
}

/** Ngày sinh: 1900 → đủ tuổi lao động tính đến hôm nay. */
export function birthDateBounds(now: Dayjs = dayjs()): DateBounds {
  return {
    minDate: dayjs(`${DATE_LIMITS.birthMinYear}-01-01`).startOf("day"),
    maxDate: now.subtract(DATE_LIMITS.minWorkingAge, "year").endOf("day"),
  };
}

/** Ngày HẠN/kế hoạch (hạn bảo hành, ngày dự kiến): hôm nay → +10 năm. */
export function futureDateBounds(now: Dayjs = dayjs()): DateBounds {
  return {
    minDate: now.startOf("day"),
    maxDate: now.add(DATE_LIMITS.futureMaxYears, "year").endOf("day"),
  };
}

export type DateCheck =
  | { ok: true; value: Dayjs | null }
  | { ok: false; message: string };

export interface DateRule extends Partial<DateBounds> {
  required?: boolean;
}

const MESSAGE_FORMAT = "DD/MM/YYYY";

/**
 * Parse chuỗi ISO (giá trị của <input type="date"> hoặc đã lưu) một cách
 * NGHIÊM NGẶT: dayjs mặc định "cuộn" tháng 22 thành tháng 10 năm sau thay vì
 * báo lỗi, nên phải đối chiếu lại chuỗi sau khi format.
 */
function parseIsoDateStrict(raw: string): Dayjs | null {
  const text = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return null;
  const parsed = dayjs(text);
  if (!parsed.isValid()) return null;
  return parsed.format("YYYY-MM-DD") === text.slice(0, 10) ? parsed : null;
}

/**
 * Kiểm tra một ngày theo mốc. Nhận `Dayjs | null` (giá trị chuẩn của mọi ô
 * ngày trong dự án) hoặc chuỗi ISO (giá trị đã lưu). Không truyền mốc thì áp
 * cửa sổ mặc định — không bao giờ có ô ngày "vô hạn".
 */
export function checkDate(
  raw: Dayjs | string | null | undefined,
  rule: DateRule = {},
): DateCheck {
  if (raw == null || raw === "") {
    if (rule.required) {
      return { ok: false, message: tStatic("shared.validation.dateRequired") };
    }
    return { ok: true, value: null };
  }

  const value = typeof raw === "string" ? parseIsoDateStrict(raw) : raw;
  if (value == null || !value.isValid()) {
    return { ok: false, message: tStatic("shared.validation.dateInvalid") };
  }

  const fallback = defaultDateBounds();
  const minDate = rule.minDate ?? fallback.minDate;
  const maxDate = rule.maxDate ?? fallback.maxDate;

  if (value.isBefore(minDate, "day")) {
    return {
      ok: false,
      message: tStatic("shared.validation.dateMin", {
        min: minDate.format(MESSAGE_FORMAT),
      }),
    };
  }
  if (value.isAfter(maxDate, "day")) {
    return {
      ok: false,
      message: tStatic("shared.validation.dateMax", {
        max: maxDate.format(MESSAGE_FORMAT),
      }),
    };
  }
  return { ok: true, value };
}

/** Khoảng ngày: từng đầu mút hợp lệ và "từ" không sau "đến". */
export function checkDateRange(
  from: Dayjs | null | undefined,
  to: Dayjs | null | undefined,
  rule: DateRule = {},
): DateCheck {
  const fromCheck = checkDate(from, rule);
  if (!fromCheck.ok) return fromCheck;
  const toCheck = checkDate(to, rule);
  if (!toCheck.ok) return toCheck;
  if (
    fromCheck.value &&
    toCheck.value &&
    fromCheck.value.isAfter(toCheck.value, "day")
  ) {
    return { ok: false, message: tStatic("shared.validation.dateRangeOrder") };
  }
  return { ok: true, value: fromCheck.value };
}

/** Kẹp một khoảng ngày (vd từ query string/URL) vào trong mốc — dùng cho bộ lọc. */
export function clampDateRange(
  from: Dayjs | null,
  to: Dayjs | null,
  bounds: DateBounds = defaultDateBounds(),
): [Dayjs | null, Dayjs | null] {
  const clamp = (d: Dayjs | null) => {
    if (d == null || !d.isValid()) return null;
    if (d.isBefore(bounds.minDate, "day")) return bounds.minDate;
    if (d.isAfter(bounds.maxDate, "day")) return bounds.maxDate;
    return d;
  };
  let f = clamp(from);
  let t = clamp(to);
  if (f && t && f.isAfter(t, "day")) {
    [f, t] = [t, f];
  }
  return [f, t];
}

/**
 * Thuộc tính `min`/`max` cho `<input type="date">` gốc (UiTextField type="date").
 * Chỉ giới hạn LỊCH của trình duyệt — không thay được `checkDate()` lúc submit,
 * vì mọi dialog của dự án lưu bằng onClick/`noValidate` nên trình duyệt không
 * bao giờ tự chặn.
 */
export function dateInputBounds(bounds: DateBounds = defaultDateBounds()): {
  min: string;
  max: string;
} {
  return {
    min: bounds.minDate.format("YYYY-MM-DD"),
    max: bounds.maxDate.format("YYYY-MM-DD"),
  };
}

/** Như `dateInputBounds` nhưng cho `<input type="datetime-local">`. */
export function dateTimeInputBounds(bounds: DateBounds = defaultDateBounds()): {
  min: string;
  max: string;
} {
  return {
    min: bounds.minDate.format("YYYY-MM-DDTHH:mm"),
    max: bounds.maxDate.format("YYYY-MM-DDTHH:mm"),
  };
}
