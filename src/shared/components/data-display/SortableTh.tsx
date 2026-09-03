import { Tooltip } from "@mui/material";
import { renderSortIcon } from "./renderSortIcon";
import type { ClientSortState } from "./useClientSort";
import type { SortWordingType } from "./useClientSort";
import { useT } from "@/shared/i18n/useT";

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
  /** Căn lề cột — bảng khai rule theo thuộc tính này (xem ResponsiveDataTable). */
  "data-align"?: "left" | "center" | "right";
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
  "data-align": dataAlign,
}: SortableThProps) {
  const t = useT();
  const isActive = sortState.key === sortKey;
  const direction = isActive ? sortState.direction : undefined;
  const [asc, desc] =
    sortType === "value"
      ? [t("shared.table.sortAsc"), t("shared.table.sortDesc")]
      : [t("shared.table.sortAZ"), t("shared.table.sortZA")];

  const tooltipTitle =
    typeof label === "string"
      ? direction === "asc"
        ? t("shared.table.sortByTooltip", { label, direction: desc })
        : direction === "desc"
          ? t("shared.table.clearSortTooltip", { label })
          : t("shared.table.sortByTooltip", { label, direction: asc })
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
    <th className={className} style={style} data-align={dataAlign}>
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
