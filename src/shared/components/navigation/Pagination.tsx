import { Pagination as AntPagination } from "antd";
import type { PaginationProps } from "antd";

export type { PaginationProps };

/**
 * Phân trang chung (wrapper antd Pagination).
 * `DataTable` đã có phân trang tích hợp; dùng component này cho danh sách
 * không phải bảng (lưới thẻ, danh sách tuỳ biến).
 */
export function Pagination(props: PaginationProps) {
  return <AntPagination showSizeChanger={false} {...props} />;
}
