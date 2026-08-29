import { useMemo, useState, type ReactNode } from "react";
import type { ResponsiveTableColumn } from "@/shared/components/data-display/ResponsiveDataTable";
import type { ClientSortState } from "@/shared/components/data-display/useClientSort";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import type { Raw } from "./report-format";

/**
 * Cột báo cáo dạng antd-like (title/dataIndex/sorter/children) — GIỮ NGUYÊN
 * shape này làm nguồn dữ liệu cột duy nhất: hợp đồng flow06 pin literal
 * `dataIndex:`/`sorter`/`title:` trong source, còn modal chi tiết dựng field
 * từ chính bộ cột. Bảng thật render qua ResponsiveDataTable bằng adapter
 * `toResponsiveColumns` bên dưới.
 */
export interface ReportColumn {
  title: ReactNode;
  key?: string;
  dataIndex?: string;
  width?: number;
  align?: "left" | "right" | "center";
  /** Metadata từ thời antd (cột ghim) — adapter không dùng, giữ để đọc hiểu. */
  fixed?: "left" | "right";
  /** Metadata từ thời antd (cắt chữ "…") — ResponsiveDataTable tự wrap chữ. */
  ellipsis?: boolean;
  sortType?: ResponsiveTableColumn<Raw>["sortType"];
  sorter?: (a: Raw, b: Raw) => number;
  render?: (value: unknown, row: Raw, index: number) => ReactNode;
  children?: ReportColumn[];
  /** Ẩn khỏi bảng ngoài (vẫn hiện trong modal chi tiết). */
  detailOnly?: boolean;
  hideOnMobile?: boolean;
}

/** Trải phẳng cột nhóm (cột có `children`, ví dụ Nhập/Xuất ở waterfall XNT). */
export function flattenReportColumns(
  columns: readonly ReportColumn[],
  parentTitle = "",
): Array<{ title: string; column: ReportColumn }> {
  return columns.flatMap((column) => {
    const ownTitle =
      typeof column.title === "string"
        ? column.title
        : String(column.key ?? "");
    const fullTitle = parentTitle ? `${parentTitle} · ${ownTitle}` : ownTitle;
    const children = column.children;
    if (children?.length) return flattenReportColumns(children, fullTitle);
    return [{ title: fullTitle, column }];
  });
}

/** Key ổn định cho một cột lá — dùng chung giữa adapter render và sort. */
export function reportColumnKey(
  column: ReportColumn,
  leafIndex: number,
): string {
  return String(column.key ?? column.dataIndex ?? `col-${leafIndex}`);
}

/**
 * Adapter cột antd-like → ResponsiveDataTable: flatten cột nhóm về cột lá
 * (header mang đủ đường dẫn nhóm), giữ align/width, đánh dấu `sortable` cho
 * cột có `sorter` (sort có kiểm soát qua `useReportColumnSort`).
 */
export function toResponsiveColumns(
  columns: ReportColumn[],
  displayedRows: Raw[],
): ResponsiveTableColumn<Raw>[] {
  return flattenReportColumns(columns).map(({ title, column }, leafIndex) => ({
    key: reportColumnKey(column, leafIndex),
    header: title,
    align: column.align,
    width: column.width,
    sortable: Boolean(column.sorter),
    sortType: column.sortType,
    hideOnMobile: column.hideOnMobile,
    render: (row: Raw) => {
      const value = column.dataIndex ? row[column.dataIndex] : undefined;
      if (column.render) {
        return column.render(value, row, displayedRows.indexOf(row));
      }
      return (value ?? null) as ReactNode;
    },
  }));
}

/** Cột hiện ngoài bảng — bỏ các cột `detailOnly` (chỉ xem trong modal). */
export function visibleReportColumns(columns: ReportColumn[]): ReportColumn[] {
  return columns.filter((column) => !column.detailOnly);
}

/** Cột STT chuẩn — dùng chung để mọi bảng báo cáo đánh số giống nhau. */
export function sttColumn(page: number, perPage: number): ReportColumn {
  return {
    title: "STT",
    key: "__stt",
    width: 64,
    fixed: "left",
    render: (_value: unknown, _row: Raw, index: number) =>
      mvpRowNumber(page, perPage, index),
  };
}

/**
 * Sort client-side CÓ KIỂM SOÁT: bấm cột chạy đúng comparator `sorter` của cột
 * đó, chu kỳ asc → desc → bỏ sort, tie-break theo thứ tự dòng gốc để sort ổn
 * định.
 */
export function useReportColumnSort(columns: ReportColumn[], rows: Raw[]) {
  const [sortState, setSortState] = useState<ClientSortState>({
    direction: undefined,
  });

  const onSortChange = (key: string) => {
    setSortState((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: undefined, direction: undefined };
    });
  };

  const sortedRows = useMemo(() => {
    if (!sortState.key || !sortState.direction) return rows;
    const leaves = flattenReportColumns(columns);
    const match = leaves.find(
      ({ column }, leafIndex) =>
        reportColumnKey(column, leafIndex) === sortState.key,
    );
    const sorter = match?.column.sorter;
    if (!sorter) return rows;
    const decorated = rows.map((row, index) => ({ row, index }));
    decorated.sort((a, b) => {
      const cmp = sorter(a.row, b.row);
      if (cmp === 0) return a.index - b.index;
      return sortState.direction === "asc" ? cmp : -cmp;
    });
    return decorated.map((entry) => entry.row);
  }, [rows, columns, sortState]);

  return { sortedRows, sortState, onSortChange };
}

/**
 * Phân trang phía client — mọi bảng ở trang này lấy TRỌN tập dữ liệu đã lọc
 * (chart và bảng phải khớp nhau tuyệt đối, nên không thể để server cắt trang
 * cho bảng rồi chart lại tính trên tập khác).
 */
export function useClientPagination<T>(rows: T[], defaultPerPage = 15) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(defaultPerPage);

  const total = rows.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  // Bộ lọc thu hẹp tập dữ liệu có thể đẩy trang hiện tại ra ngoài phạm vi —
  // kẹp lại khi render thay vì để bảng trắng trơn không giải thích được.
  const safePage = Math.min(page, lastPage);
  const pageRows = rows.slice((safePage - 1) * perPage, safePage * perPage);

  return {
    page: safePage,
    perPage,
    total,
    pageRows,
    setPage,
    setPerPage: (next: number) => {
      setPerPage(next);
      setPage(1);
    },
    reset: () => setPage(1),
  };
}
