/**
 * Định dạng số DUY NHẤT của dự án (locale vi-VN, tối đa 2 chữ số thập phân).
 *
 * Trước đây mỗi màn tự `new Intl.NumberFormat("vi-VN")` (6 bản sao) hoặc gọi
 * `.toLocaleString("vi-VN")` inline — chỉ Dashboard giới hạn số lẻ nên cùng
 * một số lượng hiển thị khác nhau giữa các màn. Mọi nơi hiển thị số lượng
 * phải dùng helper này.
 */
const QUANTITY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

/** Định dạng số lượng; giá trị null/undefined/không phải số trả về "-". */
export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  return QUANTITY_FORMATTER.format(value);
}
