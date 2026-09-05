import { useCallback, useMemo, useState } from "react";

/**
 * Cột chữ (mã, tên, email...) sort theo alphabet → tooltip/aria nói "A → Z";
 * cột số/ngày (`'value'`) → "tăng dần"/"giảm dần". (Chuyển về đây từ
 * useSortTooltipColumns.ts khi adapter antd Table bị xoá ở Part 5.)
 */
export type SortWordingType = "text" | "value";

export type SortDirection = "asc" | "desc" | undefined;

export interface ClientSortState {
  key?: string;
  direction: SortDirection;
}

export type SortAccessor<T> = (
  row: T,
) => string | number | Date | null | undefined;

/**
 * Sắp xếp phía FE cho bảng HTML thô (không dùng antd Table). Dùng chung với
 * `SortableTh` để có cùng hành vi click (chưa sort → tăng dần → giảm dần →
 * bỏ sort) và cùng nội dung tooltip tiếng Việt như `useSortTooltipColumns`.
 *
 * `accessors` khai báo 1 lần, key trùng với `sortKey` truyền cho `SortableTh`.
 */
export function useClientSort<T>(
  rows: T[],
  accessors: Record<string, SortAccessor<T>>,
) {
  const [sortState, setSortState] = useState<ClientSortState>({
    direction: undefined,
  });

  const requestSort = (key: string) => {
    setSortState((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: undefined, direction: undefined };
    });
  };

  const sortedRows = useMemo(() => {
    if (!sortState.key || !sortState.direction) return rows;
    const accessor = accessors[sortState.key];
    if (!accessor) return rows;

    const withIndex = rows.map((row, index) => ({ row, index }));
    withIndex.sort((a, b) => {
      const va = accessor(a.row);
      const vb = accessor(b.row);
      if (va == null && vb == null) return a.index - b.index;
      if (va == null) return 1;
      if (vb == null) return -1;

      let cmp: number;
      if (va instanceof Date && vb instanceof Date) {
        cmp = va.getTime() - vb.getTime();
      } else if (typeof va === "number" && typeof vb === "number") {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), "vi", {
          numeric: true,
          sensitivity: "base",
        });
      }
      if (cmp === 0) return a.index - b.index;
      return sortState.direction === "asc" ? cmp : -cmp;
    });

    return withIndex.map((entry) => entry.row);
  }, [rows, accessors, sortState]);

  /**
   * Vị trí của dòng trong DANH SÁCH GỐC (chưa sắp xếp) — cột STT lấy số từ đây
   * để số thứ tự đi theo dòng dữ liệu khi bấm sắp xếp, thay vì đứng yên thành
   * cái thang 1..n. Cùng quy ước với các bảng dùng ResponsiveDataTable
   * (`rows.indexOf(row)`), chỉ khác là tra bằng Map nên không quét lại mảng
   * cho từng dòng.
   */
  const originalIndex = useMemo(() => {
    const map = new Map<T, number>();
    rows.forEach((row, index) => map.set(row, index));
    return map;
  }, [rows]);

  const originalIndexOf = useCallback(
    (row: T) => originalIndex.get(row) ?? 0,
    [originalIndex],
  );

  return { sortedRows, sortState, requestSort, originalIndexOf };
}
