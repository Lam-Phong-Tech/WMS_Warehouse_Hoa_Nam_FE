/**
 * Chuỗi hiển thị chuẩn khi một trường CHƯA CÓ dữ liệu.
 *
 * Quy ước toàn hệ thống (yêu cầu người dùng 2026-08-31): ô/giá trị rỗng phải hiển
 * thị rõ ràng là "Chưa có" — TUYỆT ĐỐI không để dấu gạch ("—" / "-") vì người dùng
 * không phân biệt được "rỗng" với "lỗi". Mọi placeholder rỗng nên tham chiếu hằng
 * này thay vì gõ lại chuỗi gạch inline.
 */
export const EMPTY_TEXT = "Chưa có";

/**
 * Trả về text hiển thị cho một giá trị có thể rỗng: null / undefined / chuỗi rỗng
 * (đã trim) đều coi là "chưa có". Số 0 và false là giá trị THẬT nên giữ nguyên.
 */
export function orEmpty(value: unknown, fallback: string = EMPTY_TEXT): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" && value.trim() === "") return fallback;
  return String(value);
}
