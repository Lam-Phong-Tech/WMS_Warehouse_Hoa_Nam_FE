import type { ReactNode } from "react";
import { Card, Button, Skeleton } from "antd";
import { TableToolbar } from "./TableToolbar";
import { EmptyState } from "./EmptyState";
import { ApiErrorAlert } from "../feedback/ApiErrorAlert";

/**
 * Toolbar config object (dùng với TableToolbar component).
 */
export interface ToolbarConfig {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: ReactNode;
  actions?: ReactNode;
}

export interface TableContainerProps {
  /**
   * Toolbar content.
   * - `ToolbarConfig` object: render qua `TableToolbar` (search + filters + actions).
   * - `ReactNode`: custom component (vd: `DepartmentsFilter`, `OrgUnitsToolbar`).
   */
  toolbar?: ToolbarConfig | ReactNode;
  /** Table content */
  children: ReactNode;
  /** Additional class name */
  className?: string;
  /** Additional styles */
  style?: React.CSSProperties;
  /** Card title */
  title?: ReactNode;
  /** Card extra content (top right) */
  extra?: ReactNode;
  /** Loading state — hiển thị skeleton */
  loading?: boolean;
  /** Error state — hiển thị ApiErrorAlert */
  error?: Error | null;
  /** Error title */
  errorTitle?: string;
  /** Retry callback khi có error */
  onRetry?: () => void;
  /** Empty state config — chỉ hiển thị khi không loading, không error, children rỗng */
  emptyState?: {
    title?: string;
    description?: ReactNode;
    action?: ReactNode;
  };
  /** Khi true, cho biết đang có filter active (để hiển thị empty state khác) */
  isFilterActive?: boolean;
  /** Callback để clear filters (dùng khi empty state do filter) */
  onClearFilters?: () => void;
  /**
   * Cờ tường minh cho biết dữ liệu rỗng (vd `data.length === 0`).
   * `children` luôn là 1 React element (vd `<DataTable .../>`) nên không thể
   * suy ra rỗng từ `children` — phải truyền tường minh từ nơi gọi.
   * Nếu không truyền, fallback về kiểm tra `children` cũ (giữ tương thích ngược).
   */
  isEmpty?: boolean;
}

/**
 * Kiểm tra toolbar có phải ToolbarConfig object (không phải React element) không.
 */
function isToolbarConfig(
  toolbar: ToolbarConfig | ReactNode,
): toolbar is ToolbarConfig {
  if (typeof toolbar !== "object" || toolbar === null) return false;
  // React element có $$typeof, object config thì không
  if ("$$typeof" in (toolbar as Record<string, unknown>)) return false;
  // Kiểm tra presence của ít nhất 1 key đặc trưng
  return (
    "searchPlaceholder" in (toolbar as Record<string, unknown>) ||
    "searchValue" in (toolbar as Record<string, unknown>) ||
    "onSearchChange" in (toolbar as Record<string, unknown>) ||
    "filters" in (toolbar as Record<string, unknown>) ||
    "actions" in (toolbar as Record<string, unknown>)
  );
}

/**
 * Standardized container for table pages: Card wrapper + Toolbar + Content area.
 * Combines TableToolbar, Card, EmptyState, loading skeleton, error alert into one component.
 *
 * Hỗ trợ 2 dạng toolbar:
 * - `ToolbarConfig`: dùng `TableToolbar` chuẩn.
 * - `ReactNode`: custom component (vd: `DepartmentsFilter`, `OrgUnitsToolbar`, `EmployeesFilter`).
 *
 * @example
 * ```tsx
 * // ToolbarConfig object
 * <TableContainer
 *   title="Danh sách"
 *   toolbar={{
 *     searchPlaceholder: "Tìm...",
 *     searchValue: search,
 *     onSearchChange: setSearch,
 *     filters: <Select placeholder="Chi nhánh" />,
 *     actions: <Button type="primary">+ Thêm</Button>,
 *   }}
 * >
 *   <DataTable ... />
 * </TableContainer>
 *
 * // Custom component
 * <TableContainer
 *   title="Phòng ban"
 *   toolbar={<DepartmentsFilter ... />}
 * >
 *   <DataTable ... />
 * </TableContainer>
 * ```
 */
export function TableContainer({
  toolbar,
  children,
  className,
  style,
  title,
  extra,
  loading,
  error,
  errorTitle,
  onRetry,
  emptyState,
  isFilterActive,
  onClearFilters,
  isEmpty: isEmptyProp,
}: TableContainerProps) {
  const renderToolbar = () => {
    if (!toolbar) return null;

    if (isToolbarConfig(toolbar)) {
      return (
        <TableToolbar
          searchPlaceholder={toolbar.searchPlaceholder}
          searchValue={toolbar.searchValue}
          onSearchChange={toolbar.onSearchChange}
          filters={toolbar.filters}
          actions={toolbar.actions}
        />
      );
    }

    // Custom ReactNode component
    return toolbar as ReactNode;
  };

  const renderContent = () => {
    // Error state
    if (error) {
      return (
        <ApiErrorAlert
          error={error}
          title={errorTitle ?? "Không thể tải dữ liệu"}
          onRetry={onRetry}
          style={{ marginBottom: 0 }}
        />
      );
    }

    // Loading state
    if (loading) {
      return (
        <div style={{ padding: "8px 0" }}>
          <Skeleton active paragraph={{ rows: 8 }} />
          <div style={{ textAlign: "center", marginTop: 12, color: "#8c8c8c" }}>
            Đang tải dữ liệu...
          </div>
        </div>
      );
    }

    // Empty state — chỉ hiển thị khi rỗng. Ưu tiên cờ tường minh `isEmpty`
    // (children luôn là 1 element nên fallback dưới đây gần như không bao giờ đúng).
    const isEmpty =
      isEmptyProp ??
      (!children || (Array.isArray(children) && children.length === 0));
    if (isEmpty && emptyState) {
      if (isFilterActive) {
        return <FilteredEmptyState onClearFilters={onClearFilters} />;
      }
      return (
        <EmptyState
          title={emptyState.title ?? "Chưa có dữ liệu"}
          description={emptyState.description}
        >
          {emptyState.action}
        </EmptyState>
      );
    }

    return children;
  };

  return (
    <Card
      className={className}
      style={style}
      title={title}
      extra={extra}
      variant="borderless"
    >
      {renderToolbar()}
      {renderContent()}
    </Card>
  );
}

/**
 * Empty state specifically for filtered results (no data matching current filters)
 */
export function FilteredEmptyState({
  onClearFilters,
  activeFilters,
}: {
  onClearFilters?: () => void;
  activeFilters?: ReactNode;
}) {
  return (
    <EmptyState
      title="Không có kết quả phù hợp"
      description={
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeFilters && (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {activeFilters}
            </div>
          )}
          <span>Không có bản ghi nào khớp bộ lọc. Thử bỏ bớt điều kiện.</span>
        </div>
      }
    >
      {onClearFilters && (
        <Button style={{ marginTop: 12 }} onClick={onClearFilters}>
          Xóa bộ lọc
        </Button>
      )}
    </EmptyState>
  );
}
