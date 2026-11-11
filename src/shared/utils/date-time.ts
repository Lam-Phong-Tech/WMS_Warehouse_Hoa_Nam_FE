import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useInterfacePreferencesStore } from "@/shared/store/interface-preferences.store";

dayjs.extend(utc);
dayjs.extend(timezone);

export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Vietnam calendar label in a local Dayjs container, compatible with date pickers. */
export function businessToday() {
  return dayjs(dayjs().tz(BUSINESS_TIMEZONE).format("YYYY-MM-DD"));
}

export function getDisplayTimezone(): string {
  const zone = useInterfacePreferencesStore.getState().preferences?.timezone;
  if (zone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
      return zone;
    } catch {
      /* Fall back while preferences are absent or invalid. */
    }
  }
  return BUSINESS_TIMEZONE;
}

/**
 * Ngày lịch (YYYY-MM-DD) của một mốc dữ liệu theo giờ Việt Nam.
 *
 * Dùng cho các cột `date`/ngày chứng từ khi API có thể trả về timestamp ISO
 * (có `Z` hoặc offset). Cắt chuỗi `.slice(0, 10)` sẽ lấy ngày UTC và bị lùi
 * một ngày với mốc nửa đêm Việt Nam (17:00Z hôm trước).
 */
export function businessDateOnly(value?: string | null): string {
  if (!value) return "";
  const parsed = parseDateTime(value, BUSINESS_TIMEZONE);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : "";
}

/** Legacy offset-free API timestamps are Vietnam wall clocks, never device time. */
export function parseDateTime(
  value: dayjs.ConfigType = undefined,
  zone = getDisplayTimezone(),
) {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return parsed;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parsed;
    if (
      /^\d{4}-\d{2}-\d{2}[ T]/.test(value) &&
      !/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(value)
    ) {
      return dayjs.tz(value, BUSINESS_TIMEZONE).tz(zone);
    }
  }
  return parsed.tz(zone);
}

/** Date pickers contain calendar labels in the account zone, not device instants. */
export function dateFilterBoundary(date: string, end: boolean): string {
  const local = dayjs.tz(
    `${date} ${end ? "23:59:59" : "00:00:00"}`,
    getDisplayTimezone(),
  );
  return (
    local.format("YYYY-MM-DD[T]HH:mm:ss") +
    (end ? ".999999" : "") +
    local.format("Z")
  );
}
