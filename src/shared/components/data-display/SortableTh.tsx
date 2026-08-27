import { Tooltip } from "@mui/material";
import { renderSortIcon } from "./renderSortIcon";
import type { ClientSortState } from "./useClientSort";
import type { SortWordingType } from "./useSortTooltipColumns";

export interface SortableThProps {
  /** Nhãn cột hiển thị, cũng dùng để dựng câu tooltip. */
  label: React.ReactNode;
  /** Khoá cột — phải trùng với key khai báo trong `accessors` của `useClientSort`. */
  sortKey: string;
  sortState: ClientSortState;
  onSort: (key: string) => void;
  /** 'text' (mặc định) → tooltip "A → Z"/"Z → A"; 'value' → "tăng dần"/"giảm dần". */
  sortType?: SortWordingType;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * `<th>` có thể bấm để sắp xếp, dùng cho bảng HTML thô (không phải antd Table).
 * Cùng hành vi bấm (chưa sort → tăng dần → giảm dần → bỏ sort) và cùng lối
 * viết tooltip tiếng Việt như `useSortTooltipColumns` dùng cho antd Table, để
 * trải nghiệm sắp xếp nhất quán trên toàn bộ ứng dụng.
 */
export function SortableTh({
  label,
  sortKey,
  sortState,
  onSort,
  sortType = "text",
  className,
  style,
}: SortableThProps) {
  const isActive = sortState.key === sortKey;
  const direction = isActive ? sortState.direction : undefined;
  const [asc, desc] =
    sortType === "value" ? ["tăng dần", "giảm dần"] : ["A → Z", "Z → A"];

  const tooltipTitle =
    typeof label === "string"
      ? direction === "asc"
        ? `Nhấp để sắp xếp theo ${label} ${desc}`
        : direction === "desc"
          ? `Nhấp để bỏ sắp xếp ${label}`
          : `Nhấp để sắp xếp theo ${label} ${asc}`
      : "";

  const icon = renderSortIcon({
    sortOrder:
      direction === "asc" ? "ascend" : direction === "desc" ? "descend" : null,
  });

  const button = (
    <button
      type="button"
      className="hn-sortable-th"
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
      onClick={() => onSort(sortKey)}
    >
      <span>{label}</span>
      {icon}
    </button>
  );

  return (
    <th className={className} style={style}>
      {tooltipTitle ? (
        <Tooltip
          title={tooltipTitle}
          slotProps={{
            tooltip: { sx: { whiteSpace: "nowrap", maxWidth: "none" } },
          }}
        >
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </th>
  );
}
