import type { CSSProperties, ReactNode } from 'react';
import { Space } from 'antd';

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
 * <FilterBar actions={<Button type="primary">Thêm mới</Button>}>
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
  return (
    <div
      role="search"
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        ...style,
      }}
    >
      <Space wrap size={8}>
        {children}
      </Space>
      {actions && (
        <Space wrap size={8}>
          {actions}
        </Space>
      )}
    </div>
  );
}
