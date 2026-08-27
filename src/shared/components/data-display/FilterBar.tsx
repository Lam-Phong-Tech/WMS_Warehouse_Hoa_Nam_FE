import type { CSSProperties, ReactNode } from "react";
import { Space } from "antd";
export interface FilterBarProps {
  /** Ô lọc (trái): SearchInput, Select, DatePicker... */
  children: ReactNode;
  /** Nút thao tác (phải): Export, Thêm mới... */
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Wrapper chuẩn hoá khu vực bộ lọc + nút thao tác của mỗi trang.
 * Layout: filters bên trái, actions bên phải, wrap tự động trên màn nhỏ.
 *
 * ```tsx
 * <FilterBar actions={<ActionButton
  kind="create"
>Thêm mới</ActionButton>}>
 *   <SearchInput ... />
 *   <Select ... />
 * </FilterBar>
 * ```
 */
export function FilterBar({
  children,
  actions,
  className,
  style,
}: FilterBarProps) {
  const rootClassName = ["hn-filter-bar", className].filter(Boolean).join(" ");

  return (
    <div
      role="search"
      className={rootClassName}
      style={{
        marginBottom: 16,
        ...style,
      }}
    >
      <Space className="hn-filter-bar__controls" wrap size={8}>
        {children}
      </Space>
      {actions && (
        <Space className="hn-filter-bar__actions" wrap size={8}>
          {actions}
        </Space>
      )}
    </div>
  );
}
