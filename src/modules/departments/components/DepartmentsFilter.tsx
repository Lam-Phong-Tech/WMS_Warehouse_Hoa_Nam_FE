import type { ReactNode } from 'react';
import { Select } from 'antd';
import { FilterBar, SearchInput } from '@/shared/components';
import { DEPARTMENT_STATUS_LABELS } from '@/modules/departments/types/departments.types';

// Dùng chung nhãn với DEPARTMENT_STATUS_LABELS để tránh mỗi màn hình gọi
// trạng thái "inactive" bằng một từ khác nhau (Vô hiệu/Tạm ngưng/Ngừng hoạt
// động), khiến người dùng tưởng đây là một trạng thái khác với "xóa mềm".
const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: DEPARTMENT_STATUS_LABELS.active },
  { value: 'inactive', label: DEPARTMENT_STATUS_LABELS.inactive },
];

export interface DepartmentsFilterProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  orgFilter: number | 'all';
  onOrgFilterChange: (value: number | 'all') => void;
  orgOptions: { value: number; label: string }[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  /** Nút thao tác bên phải (Export, Thêm mới...) */
  actions?: ReactNode;
}

/** Thanh lọc phòng ban: từ khoá + đơn vị tổ chức + trạng thái. */
export function DepartmentsFilter({
  keyword,
  onKeywordChange,
  orgFilter,
  onOrgFilterChange,
  orgOptions,
  statusFilter,
  onStatusFilterChange,
  actions,
}: DepartmentsFilterProps) {
  return (
    <FilterBar actions={actions}>
      <SearchInput
        placeholder="Tìm theo mã, tên, trưởng phòng"
        value={keyword}
        onChange={onKeywordChange}
        width={280}
      />
      <Select
        value={orgFilter}
        onChange={onOrgFilterChange}
        style={{ width: 220 }}
        options={[{ value: 'all', label: 'Tất cả đơn vị' }, ...orgOptions]}
        aria-label="Lọc theo đơn vị tổ chức"
      />
      <Select
        value={statusFilter}
        onChange={onStatusFilterChange}
        style={{ width: 180 }}
        options={STATUS_OPTIONS}
        aria-label="Lọc theo trạng thái"
      />
    </FilterBar>
  );
}
