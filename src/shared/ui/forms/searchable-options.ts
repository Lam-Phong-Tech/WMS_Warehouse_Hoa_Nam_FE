/**
 * Quy tắc CHUNG cho mọi dropdown của app: danh sách dài thì phải gõ được để
 * tìm, không bắt người dùng cuộn hết menu.
 *
 * Ngưỡng đặt ở 8 vì menu MUI (size small) hiện trọn khoảng ngần đó dòng trong
 * một tầm nhìn; quá số này là bắt đầu phải cuộn. Danh mục lấy từ API (SKU,
 * hãng, model, kho, vai trò, quyền, người dùng…) gần như luôn vượt ngưỡng nên
 * tự động thành ô tìm kiếm, còn enum ngắn (trạng thái, loại, số dòng/trang)
 * giữ nguyên dropdown thường.
 */
import type { ReactNode } from "react";

export const SEARCHABLE_OPTION_THRESHOLD = 8;

/**
 * Autocomplete lọc theo chuỗi nhãn nên option có nhãn ReactNode (badge, icon)
 * KHÔNG tự đổi sang ô tìm kiếm — muốn vậy thì truyền `searchable` tay và đưa
 * nhãn về chuỗi.
 */
export function resolveSearchable(
  options: ReadonlyArray<{ label: ReactNode }>,
  override?: boolean,
): boolean {
  if (override !== undefined) return override;
  if (options.length <= SEARCHABLE_OPTION_THRESHOLD) return false;
  return options.every((option) => typeof option.label === "string");
}
