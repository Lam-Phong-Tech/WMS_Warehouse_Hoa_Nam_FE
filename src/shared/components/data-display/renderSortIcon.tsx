import {
  SortAscendingOutlined,
  SortDescendingOutlined,
} from "@/shared/components/icons";

type SortOrder = "ascend" | "descend" | null | undefined;

/**
 * Icon sắp xếp DÙNG CHUNG cho cả antd `<Table>` (qua `column.sortIcon` trong
 * `useSortTooltipColumns`) lẫn bảng HTML thô (`SortableTh`): luôn hiện 2 mũi
 * tên lên/xuống xếp chồng, tô màu mũi tên đang active — thay vì để mỗi nơi tự
 * vẽ icon riêng (antd Table mặc định dùng icon gốc @ant-design/icons, khác bộ
 * icon Flaticon mà toàn bộ app đang dùng) gây lệch hình dạng icon giữa các
 * trang.
 */
export function renderSortIcon({ sortOrder }: { sortOrder: SortOrder }) {
  return (
    <span className="hn-sort-icon-stack">
      <SortAscendingOutlined
        className={
          sortOrder === "ascend"
            ? "hn-sortable-th__icon hn-sortable-th__icon--active"
            : "hn-sortable-th__icon"
        }
      />
      <SortDescendingOutlined
        className={
          sortOrder === "descend"
            ? "hn-sortable-th__icon hn-sortable-th__icon--active"
            : "hn-sortable-th__icon"
        }
      />
    </span>
  );
}
