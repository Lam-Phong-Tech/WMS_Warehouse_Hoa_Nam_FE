import dayjs from "dayjs";

import { EMPTY_TEXT } from "@/shared/constants/display";

/**
 * Quy chuẩn hiển thị ngày giờ toàn hệ thống: dd-mm-yyyy (giờ: + HH:mm, 24h).
 * Ngày/tháng/giờ/phút đều đệm số 0 (vd: 02-09-2026 16:52).
 */
const DATE_FORMAT = "DD-MM-YYYY";
const DATE_TIME_FORMAT = "DD-MM-YYYY HH:mm";
// Ngày chưa có / không hợp lệ hiển thị "Chưa có" (không dùng dấu gạch — xem
// display.ts). Đọc EMPTY_TEXT tại thời điểm gọi (live binding, song ngữ) —
// KHÔNG chép ra hằng cấp module kẻo đóng băng theo ngôn ngữ lúc import.

/**
 * Format date string to standard display format (dd-mm-yyyy)
 * @param dateString - ISO date string
 * @returns Formatted date string, or "-" if empty/invalid
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return EMPTY_TEXT;
  const parsed = dayjs(dateString);
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : EMPTY_TEXT;
}

/**
 * Format datetime string to standard display format (dd-mm-yyyy HH:mm)
 * @param dateString - ISO date string
 * @returns Formatted datetime string, or "-" if empty/invalid
 */
export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return EMPTY_TEXT;
  const parsed = dayjs(dateString);
  return parsed.isValid() ? parsed.format(DATE_TIME_FORMAT) : EMPTY_TEXT;
}
