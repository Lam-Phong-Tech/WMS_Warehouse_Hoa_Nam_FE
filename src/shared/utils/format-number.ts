/**
 * Định dạng số lượng dùng chung (vi-VN hoặc zh-CN, tối đa 2 chữ số thập phân).
 *
 * Trước đây mỗi màn tự `new Intl.NumberFormat("vi-VN")` (6 bản sao) hoặc gọi
 * `.toLocaleString("vi-VN")` inline — chỉ Dashboard giới hạn số lẻ nên cùng
 * một số lượng hiển thị khác nhau giữa các màn. Mọi nơi hiển thị số lượng
 * phải dùng helper này.
 */
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useLanguageStore } from "@/shared/i18n/language.store";

const QUANTITY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});
const CHINESE_QUANTITY_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});

/** Định dạng số lượng; giá trị null/undefined/không phải số trả về "Chưa có". */
export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY_TEXT;
  }
  return (
    useLanguageStore.getState().language === "zh"
      ? CHINESE_QUANTITY_FORMATTER
      : QUANTITY_FORMATTER
  ).format(value);
}
