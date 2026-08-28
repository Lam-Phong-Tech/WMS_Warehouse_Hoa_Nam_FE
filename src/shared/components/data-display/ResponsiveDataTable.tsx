import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { ReactNode } from "react";
import { MvpSelectionCheckbox } from "@/shared/components/mvp/MvpSelectionCell";
import type { RowSelectionState } from "@/shared/hooks/useRowSelection";
import { SortableTh } from "./SortableTh";
import { useClientSort } from "./useClientSort";
import type { ClientSortState, SortAccessor } from "./useClientSort";
import type { SortWordingType } from "./useSortTooltipColumns";
import { ActionButton } from "@/shared/components/actions";

export interface ResponsiveTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Nhãn hiển thị trên card ở mobile — mặc định dùng `header` nếu không truyền. */
  mobileLabel?: ReactNode;
  align?: "left" | "right" | "center";
  width?: string | number;
  /** Có prop này thì cột này bấm được để sắp xếp CLIENT-SIDE (toàn bộ `rows` đang có trong tay). */
  sortAccessor?: SortAccessor<T>;
  /** Cột bấm được để sắp xếp nhưng việc sort xảy ra ở nơi khác (vd gọi lại API) —
   * dùng cùng `sortState`/`onSortChange` ở mức bảng thay vì `sortAccessor`. */
  sortable?: boolean;
  sortType?: SortWordingType;
  /** Ẩn hẳn cột này ở mobile (bảng lẫn card) — dùng cho cột phụ ít quan trọng, giữ card gọn. */
  hideOnMobile?: boolean;
}

export interface ResponsiveDataTableProps<T> {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyText?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Khối nút hành động cho từng dòng (Xem/Sửa/Xoá...) — hiển thị ở cả bảng lẫn card. */
  renderRowActions?: (row: T) => ReactNode;
  /** Breakpoint chuyển sang card list, mặc định `md` (768px, khớp mui-theme.ts). */
  mobileBreakpoint?: "sm" | "md" | "lg";
  /**
   * Sort CÓ KIỂM SOÁT từ ngoài (vd sort server-side qua API): truyền cùng lúc
   * `sortState` + `onSortChange` để bảng KHÔNG tự sort nội bộ nữa — `rows` coi
   * như đã được sắp xếp sẵn từ nơi gọi, bấm cột chỉ phát sự kiện ra ngoài.
   * Cột muốn bấm được để sort kiểu này khai `sortable: true` (không phải
   * `sortAccessor`). Bỏ trống 2 prop này thì mọi cột có `sortAccessor` vẫn
   * sort nội bộ (client-side) như trước.
   */
  sortState?: ClientSortState;
  onSortChange?: (key: string) => void;
  /**
   * Bật cột chọn nhiều dòng (checkbox) — truyền thẳng giá trị của
   * `useRowSelection(rows, rowKey)`. Lựa chọn chỉ tính trong trang hiện tại,
   * đúng như các bảng đã có checkbox (IamUserScreen, ApiMasterScreens).
   */
  rowSelection?: RowSelectionState;
  /** Nhãn a11y cho checkbox từng dòng — mặc định "Chọn dòng <rowKey>". */
  selectionLabel?: (row: T) => string;
}

/**
 * Bảng dữ liệu dùng chung: HTML `<table>` + `SortableTh` trên desktop (cùng
 * baseline đã dùng ở IamUserScreen/ApiMasterScreens), tự chuyển sang danh sách
 * card trên mobile/tablet hẹp thay vì bắt cuộn ngang một bảng nhiều cột bị bóp
 * nhỏ. Không phụ thuộc CSS toàn cục (`.table-wrap`/`.hn-data-table` chỉ có tác
 * dụng trong wrapper `.hn-mvp-source-screen` khi vào qua `?screen=` — xem
 * gotcha responsive cũ) — style tự đủ qua `sx` để hiển thị đúng ở mọi route.
 */
export function ResponsiveDataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyText = "Không có dữ liệu",
  onRowClick,
  renderRowActions,
  mobileBreakpoint = "md",
  sortState: controlledSortState,
  onSortChange: controlledOnSortChange,
  rowSelection,
  selectionLabel,
}: ResponsiveDataTableProps<T>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down(mobileBreakpoint));

  const isControlledSort =
    controlledSortState !== undefined && controlledOnSortChange !== undefined;

  const sortAccessors = Object.fromEntries(
    columns
      .filter((column) => column.sortAccessor)
      .map((column) => [column.key, column.sortAccessor!]),
  );
  const internalSort = useClientSort(rows, sortAccessors);

  // Sort có kiểm soát (server-side): KHÔNG sort lại `rows` — coi như nơi gọi
  // đã sắp xếp sẵn. Bấm cột chỉ phát `onSortChange(key)` ra ngoài.
  const sortedRows = isControlledSort ? rows : internalSort.sortedRows;
  const sortState = isControlledSort
    ? controlledSortState
    : internalSort.sortState;
  const requestSort = isControlledSort
    ? controlledOnSortChange
    : internalSort.requestSort;

  const rowSelectionLabel = (row: T) =>
    selectionLabel?.(row) ?? `Chọn dòng ${rowKey(row)}`;

  // Thanh tóm tắt: lựa chọn có thể trôi khỏi tầm nhìn khi cuộn/đổi bộ lọc nên
  // luôn nói rõ đang chọn bao nhiêu dòng và cho bỏ chọn nhanh.
  const selectionSummary =
    rowSelection && rowSelection.selectedCount > 0 ? (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 1.5,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: "action.hover",
          border: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="body2">
          Đã chọn {rowSelection.selectedCount} dòng
        </Typography>
        <ActionButton kind="clear" onClick={rowSelection.clear}>
          Bỏ chọn
        </ActionButton>
      </Box>
    ) : null;

  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
        Đang tải...
      </Box>
    );
  }

  if (!sortedRows.length) {
    return (
      <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
        {emptyText}
      </Box>
    );
  }

  if (isMobile) {
    const cardColumns = columns.filter((column) => !column.hideOnMobile);
    return (
      <>
        {selectionSummary}
        <Stack spacing={1.5}>
          {sortedRows.map((row) => (
            <Card
              key={rowKey(row)}
              variant="outlined"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={onRowClick ? { cursor: "pointer" } : undefined}
            >
              <CardContent
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  "&:last-child": { pb: 2 },
                }}
              >
                {rowSelection && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      ml: -0.5,
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MvpSelectionCheckbox
                      checked={rowSelection.isSelected(rowKey(row))}
                      onChange={(checked) =>
                        rowSelection.toggleOne(rowKey(row), checked)
                      }
                      ariaLabel={rowSelectionLabel(row)}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Chọn
                    </Typography>
                  </Box>
                )}
                {cardColumns.map((column) => (
                  <Box
                    key={column.key}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 2,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ flexShrink: 0, pt: "2px" }}
                    >
                      {column.mobileLabel ?? column.header}
                    </Typography>
                    <Box sx={{ textAlign: "right", minWidth: 0 }}>
                      {column.render(row)}
                    </Box>
                  </Box>
                ))}
                {renderRowActions && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 1,
                      mt: 1,
                      pt: 1,
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderRowActions(row)}
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      </>
    );
  }

  const selectionCellStyle = {
    width: 44,
    padding: "10px 4px 10px 12px",
    textAlign: "center" as const,
  };

  return (
    <>
      {selectionSummary}
      <Box
        sx={{
          overflowX: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 2.5,
        }}
      >
        <Box
          component="table"
          sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}
        >
          <Box component="thead">
            <Box component="tr">
              {rowSelection && (
                <Box
                  component="th"
                  sx={{
                    ...selectionCellStyle,
                    bgcolor: "action.hover",
                    borderBottom: 1,
                    borderColor: "divider",
                  }}
                >
                  <MvpSelectionCheckbox
                    checked={rowSelection.isAllSelected}
                    indeterminate={rowSelection.isIndeterminate}
                    onChange={rowSelection.toggleAll}
                    ariaLabel="Chọn tất cả dòng trong trang"
                  />
                </Box>
              )}
              {columns.map((column) => {
                const isSortable = Boolean(
                  column.sortAccessor || column.sortable,
                );
                const headerCellStyle: React.CSSProperties = {
                  textAlign: column.align ?? "left",
                  width: column.width,
                  padding: "10px 12px",
                  fontWeight: 600,
                  fontSize: 13,
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  whiteSpace: "nowrap",
                };

                // SortableTh tự trả về nguyên 1 thẻ <th> — KHÔNG bọc thêm Box
                // component="th" ở ngoài (sẽ ra <th><th>...</th></th> vô hiệu
                // hoá HTML). Cột không sort thì bọc Box component="th" bình
                // thường để dùng được sx theo theme.
                return isSortable ? (
                  <SortableTh
                    key={column.key}
                    label={column.header}
                    sortKey={column.key}
                    sortState={sortState}
                    onSort={requestSort}
                    sortType={column.sortType}
                    style={headerCellStyle}
                  />
                ) : (
                  <Box component="th" key={column.key} sx={headerCellStyle}>
                    {column.header}
                  </Box>
                );
              })}
              {renderRowActions && (
                <Box
                  component="th"
                  sx={{
                    padding: "10px 12px",
                    fontWeight: 600,
                    fontSize: 13,
                    bgcolor: "action.hover",
                    borderBottom: 1,
                    borderColor: "divider",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  Thao tác
                </Box>
              )}
            </Box>
          </Box>
          <Box component="tbody">
            {sortedRows.map((row) => (
              <Box
                component="tr"
                // role tường minh = role ngầm định của <tr>: các test contract
                // (vd WWHN-240) tìm dòng bằng closest('[role="row"]') — selector
                // thuộc tính không thấy implicit role của HTML table.
                role="row"
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={{
                  cursor: onRowClick ? "pointer" : undefined,
                  "&:hover": { bgcolor: "action.hover" },
                  "&:not(:last-of-type)": {
                    borderBottom: 1,
                    borderColor: "divider",
                  },
                }}
              >
                {rowSelection && (
                  <Box
                    component="td"
                    sx={{ ...selectionCellStyle, verticalAlign: "top" }}
                    // Ô checkbox nằm trong dòng có onRowClick (mở modal chi tiết) —
                    // chặn nổi bọt để tick chọn không mở luôn chi tiết.
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MvpSelectionCheckbox
                      checked={rowSelection.isSelected(rowKey(row))}
                      onChange={(checked) =>
                        rowSelection.toggleOne(rowKey(row), checked)
                      }
                      ariaLabel={rowSelectionLabel(row)}
                    />
                  </Box>
                )}
                {columns.map((column) => (
                  <Box
                    component="td"
                    key={column.key}
                    sx={{
                      padding: "10px 12px",
                      verticalAlign: "top",
                      textAlign: column.align ?? "left",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {column.render(row)}
                  </Box>
                ))}
                {renderRowActions && (
                  <Box
                    component="td"
                    sx={{
                      padding: "10px 12px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderRowActions(row)}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </>
  );
}
