import { useMemo, useState } from "react";
import type { SorterResult } from "antd/es/table/interface";
import type { TableColumnsType } from "antd";

type SortState = { key?: React.Key; order?: "ascend" | "descend" };

/**
 * Cột chữ (mã, tên, email...) sort theo alphabet → tooltip nói "A → Z"/"Z → A".
 * Cột số/ngày/boolean (số lượng, ngày sinh, trạng thái...) sort theo giá trị
 * → tooltip nói "tăng dần"/"giảm dần" (không có ý nghĩa gì khi nói "A → Z" cho
 * một ngày tháng hay một con số). Mặc định 'text' vì đa số cột là chữ.
 */
export type SortWordingType = "text" | "value";

/**
 * Cho phép khai báo `sortType` trên column definition của antd Table.
 * Dùng type này thay cho `TableColumnsType<T>` ở khai báo `const columns: ...`
 * của bảng khi cần đánh dấu cột số/ngày là `sortType: 'value'`.
 */
export type ColumnWithSortType<T> = Array<
  TableColumnsType<T>[number] & { sortType?: SortWordingType }
>;

/**
 * Tự viết tooltip cho cột có `sorter`, nêu rõ tên cột + hướng sắp xếp theo
 * đúng bản chất dữ liệu cột đó, thay vì tooltip mặc định chung chung của antd:
 * - Cột chữ (mặc định): "Nhấp để sắp xếp theo Họ tên A → Z" → "...Z → A" →
 *   "Nhấp để bỏ sắp xếp Họ tên".
 * - Cột số/ngày (`sortType: 'value'`): "Nhấp để sắp xếp theo Ngày sinh tăng dần"
 *   → "...giảm dần" → "Nhấp để bỏ sắp xếp Ngày sinh".
 *
 * Chỉ áp dụng cho cột có `sorter` VÀ `title` là chuỗi (bỏ qua cột title dạng
 * ReactNode tuỳ biến vì không có tên rõ ràng để nhét vào câu tooltip).
 * Dùng chung cho cả `DataTable` lẫn `<Table>` thô: gọi hook, dùng
 * `columns` trả về để render, và gọi `onSorterChange(sorter)` trong
 * `onChange` của Table.
 */
export function useSortTooltipColumns<T>(
  columns: TableColumnsType<T> | undefined,
) {
  const [sortState, setSortState] = useState<SortState>({});

  const onSorterChange = (
    sorter: SorterResult<T> | SorterResult<T>[] | undefined,
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    setSortState({
      key: s?.columnKey ?? (s?.field as React.Key | undefined),
      order: s?.order ?? undefined,
    });
  };

  const columnsWithTooltip = useMemo(() => {
    if (!columns) return columns;
    return (columns as ColumnWithSortType<T>).map((col) => {
      if (!("sorter" in col) || !col.sorter || typeof col.title !== "string") {
        return col;
      }
      const label = col.title;
      const key = col.key ?? ("dataIndex" in col ? col.dataIndex : undefined);
      const isActive = sortState.key === key;
      const [asc, desc] =
        col.sortType === "value"
          ? ["tăng dần", "giảm dần"]
          : ["A → Z", "Z → A"];

      const text =
        isActive && sortState.order === "ascend"
          ? `Nhấp để sắp xếp theo ${label} ${desc}`
          : isActive && sortState.order === "descend"
            ? `Nhấp để bỏ sắp xếp ${label}`
            : `Nhấp để sắp xếp theo ${label} ${asc}`;

      return { ...col, showSorterTooltip: { title: text } };
    });
  }, [columns, sortState]);

  return { columns: columnsWithTooltip, onSorterChange };
}
