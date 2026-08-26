import dayjs from "dayjs";

/**
 * Quy chuẩn hiển thị ngày giờ toàn hệ thống: d-m-yyyy (giờ: + HH:mm, 24h).
 * Ngày/tháng không đệm số 0 (vd: 8-6-2026), giờ/phút đệm số 0 (vd: 04:10).
 */
const DATE_FORMAT = "D-M-YYYY";
const DATE_TIME_FORMAT = "D-M-YYYY HH:mm";
const EMPTY_PLACEHOLDER = "-";

/**
 * Format date string to standard display format (dd-mm-yyyy)
 * @param dateString - ISO date string
 * @returns Formatted date string, or "-" if empty/invalid
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return EMPTY_PLACEHOLDER;
  const parsed = dayjs(dateString);
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : EMPTY_PLACEHOLDER;
}

/**
 * Format datetime string to standard display format (dd-mm-yyyy HH:mm)
 * @param dateString - ISO date string
 * @returns Formatted datetime string, or "-" if empty/invalid
 */
export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return EMPTY_PLACEHOLDER;
  const parsed = dayjs(dateString);
  return parsed.isValid() ? parsed.format(DATE_TIME_FORMAT) : EMPTY_PLACEHOLDER;
}
