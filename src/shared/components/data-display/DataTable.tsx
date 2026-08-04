import { useMemo } from "react";
import { Table } from "antd";
import type { TablePaginationConfig, TableProps } from "antd";
import { DESIGN_TOKENS } from "@/app/theme";
import { EmptyState } from "./EmptyState";
import { TopPagination, type TopPaginationProps } from "./TopPagination";
import { PageSizeSelector } from "./PageSizeSelector";
import { useSortTooltipColumns } from "./useSortTooltipColumns";

/** Cấu hình server-side pagination tiện ích — truyền thay vì dùng `pagination` thủ công. */
export interface ServerPagination {
  total: number;
  current: number;
  pageSize?: number;
  onChange: (page: number, pageSize: number) => void;
}

export interface DataTableProps<T extends object> extends TableProps<T> {
  /**
   * Bật server-side pagination: truyền `total`, `current`, `pageSize` và `onChange`.
   * Khi dùng prop này thì KHÔNG truyền thêm `pagination`.
   */
  serverPagination?: ServerPagination;
  /**
   * Tự động hiển thị cột số thứ tự (STT) ở đầu bảng. Mặc định là true.
   */
  showSTT?: boolean;
  /**
   * Bật chế độ chọn nhiều dòng bằng checkbox. Mặc định là false.
   * Khi bật, cột checkbox sẽ được thêm vào đầu bảng (trước STT nếu có).
   */
  rowSelection?: {
    type?: "checkbox" | "radio";
    selectedRowKeys?: React.Key[];
    onChange?: (selectedRowKeys: React.Key[], selectedRows: T[]) => void;
    getCheckboxProps?: (record: T) => { disabled?: boolean; name?: string };
  };
  /**
   * Hiển thị thanh phân trang đơn giản ở phía trên bảng (chỉ dropdown chọn page size).
   * Mặc định là false (pagination hiển thị ở dưới như cũ).
   */
  showTopPagination?: boolean;
  /**
   * Cấu hình cho top pagination (chỉ dùng khi showTopPagination = true).
   */
  topPaginationConfig?: TopPaginationProps;
  /**
   * Vị trí hiển thị top pagination: 'top' (mặc định, phía trên bảng) hoặc
   * 'bottom' (phía dưới bảng).
   */
  topPaginationPlacement?: "top" | "bottom";
}

/**
 * Bọc antd Table với mặc định hợp lý: rowKey="id", phân trang, cuộn ngang,
 * và trạng thái rỗng dùng EmptyState. Mọi prop của antd Table đều truyền qua được.
 *
 * Server-side: truyền `serverPagination` thay vì tự cấu hình `pagination`.
 * Responsive: dùng `column.responsive` (vd `['sm']`) để ẩn cột trên màn nhỏ.
 */
export function DataTable<T extends object>({
  serverPagination,
  showSTT = true,
  rowSelection,
  showTopPagination = false,
  topPaginationConfig,
  topPaginationPlacement = "top",
  ...props
}: DataTableProps<T>) {
  const {
    rowKey = "id",
    pagination,
    scroll,
    locale,
    size,
    onChange,
    columns,
    ...rest
  } = props;

  const resolvedPagination: TablePaginationConfig | false = useMemo(
    () =>
      pagination === false
        ? false
        : serverPagination
          ? {
              total: serverPagination.total,
              current: serverPagination.current,
              pageSize: serverPagination.pageSize ?? 10,
              showSizeChanger: !showTopPagination,
              showTotal: showTopPagination
                ? undefined
                : (total: number) => `Tổng ${total} bản ghi`,
              hideOnSinglePage: !showTopPagination,
              placement: showTopPagination ? [] : undefined,
            }
          : {
              pageSize: 10,
              showSizeChanger: !showTopPagination,
              hideOnSinglePage: !showTopPagination,
              placement: showTopPagination ? [] : undefined,
              ...pagination,
            },
    [pagination, serverPagination, showTopPagination],
  );

  const { columns: sortTooltipColumns, onSorterChange } =
    useSortTooltipColumns(columns);

  const handleChange: NonNullable<TableProps<T>["onChange"]> = (
    paginationInfo,
    filters,
    sorter,
    extra,
  ) => {
    if (serverPagination && paginationInfo.current && paginationInfo.pageSize) {
      serverPagination.onChange(
        paginationInfo.current,
        paginationInfo.pageSize,
      );
    }
    onSorterChange(sorter);
    onChange?.(paginationInfo, filters, sorter, extra);
  };

  const modifiedColumns = useMemo(() => {
    if (!sortTooltipColumns || sortTooltipColumns.length === 0 || !showSTT) {
      return sortTooltipColumns;
    }

    const firstColumnFixed = sortTooltipColumns[0]?.fixed;

    const sttColumn = {
      title: "STT",
      key: "stt_index",
      width: 60,
      align: "center" as const,
      fixed:
        firstColumnFixed === "left" || firstColumnFixed === true
          ? ("left" as const)
          : undefined,
      render: (_value: unknown, _record: unknown, index: number) => {
        let page = 1;
        let pageSize = 10;

        if (serverPagination) {
          page = serverPagination.current || 1;
          pageSize = serverPagination.pageSize || 10;
        } else if (
          resolvedPagination &&
          typeof resolvedPagination === "object"
        ) {
          page = resolvedPagination.current || 1;
          pageSize = resolvedPagination.pageSize || 10;
        }

        return (page - 1) * pageSize + index + 1;
      },
    };

    return [sttColumn, ...sortTooltipColumns];
  }, [sortTooltipColumns, showSTT, serverPagination, resolvedPagination]);

  const tableRowSelection = rowSelection
    ? {
        type: rowSelection.type || "checkbox",
        selectedRowKeys: rowSelection.selectedRowKeys || [],
        onChange: rowSelection.onChange,
        getCheckboxProps: rowSelection.getCheckboxProps,
      }
    : undefined;

  const isBottomPlacement = topPaginationPlacement === "bottom";

  const topPaginationElement = showTopPagination && topPaginationConfig && (
    <TopPagination
      total={topPaginationConfig.total}
      current={topPaginationConfig.current}
      pageSize={topPaginationConfig.pageSize}
      unitName={topPaginationConfig.unitName}
      pageSizeOptions={topPaginationConfig.pageSizeOptions}
      onChange={topPaginationConfig.onChange}
      placement={topPaginationPlacement}
      showSizeChanger={!isBottomPlacement}
    />
  );

  const pageSizeSelectorElement = showTopPagination &&
    topPaginationConfig &&
    isBottomPlacement && (
      <PageSizeSelector
        current={topPaginationConfig.current}
        pageSize={topPaginationConfig.pageSize}
        pageSizeOptions={topPaginationConfig.pageSizeOptions}
        onChange={topPaginationConfig.onChange}
      />
    );

  return (
    <div className="hn-data-table">
      {isBottomPlacement && pageSizeSelectorElement && (
        <div style={{ marginBottom: 12 }}>{pageSizeSelectorElement}</div>
      )}
      {!isBottomPlacement && topPaginationElement}
      <Table<T>
        rowKey={rowKey}
        size={size ?? DESIGN_TOKENS.table.size}
        scroll={scroll ?? { x: "max-content" }}
        locale={{ emptyText: <EmptyState />, ...locale }}
        pagination={resolvedPagination}
        onChange={handleChange}
        columns={modifiedColumns}
        rowSelection={tableRowSelection}
        {...rest}
      />
      {topPaginationPlacement === "bottom" && topPaginationElement}
    </div>
  );
}
