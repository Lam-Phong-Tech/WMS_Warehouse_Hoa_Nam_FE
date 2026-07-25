import type { ReactNode } from 'react';
import { Select } from 'antd';
import { FilterBar, SearchInput } from '@/shared/components';
import {
  EMPLOYEE_STATUS_LABELS,
  ACCOUNT_STATUS_LABELS,
} from '@/modules/employees/types/employees.types';

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  ...Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const accountStatusOptions = [
  { value: 'all', label: 'Tất cả tài khoản' },
  ...Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

export interface EmployeesFilterProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  orgFilter: number | 'all';
  onOrgFilterChange: (value: number | 'all') => void;
  deptFilter: number | 'all';
  onDeptFilterChange: (value: number | 'all') => void;
  positionFilter: number | 'all';
  onPositionFilterChange: (value: number | 'all') => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  accountStatusFilter: string;
  onAccountStatusFilterChange: (value: string) => void;
  orgOptions: { value: number; label: string }[];
  deptOptions: { value: number; label: string }[];
  positionOptions: { value: number; label: string }[];
  actions?: ReactNode;
}

export function EmployeesFilter({
  keyword,
  onKeywordChange,
  orgFilter,
  onOrgFilterChange,
  deptFilter,
  onDeptFilterChange,
  positionFilter,
  onPositionFilterChange,
  statusFilter,
  onStatusFilterChange,
  accountStatusFilter,
  onAccountStatusFilterChange,
  orgOptions,
  deptOptions,
  positionOptions,
  actions,
}: EmployeesFilterProps) {
  return (
    <FilterBar actions={actions}>
      <SearchInput
        placeholder="Tìm tên, mã, email, SĐT..."
        value={keyword}
        onChange={onKeywordChange}
        width={240}
      />
      <Select
        value={orgFilter}
        onChange={onOrgFilterChange}
        style={{ width: 180 }}
        options={[{ value: 'all', label: 'Tất cả đơn vị' }, ...orgOptions]}
      />
      <Select
        value={deptFilter}
        onChange={onDeptFilterChange}
        style={{ width: 180 }}
        options={[{ value: 'all', label: 'Tất cả phòng ban' }, ...deptOptions]}
      />
      <Select
        value={positionFilter}
        onChange={onPositionFilterChange}
        style={{ width: 180 }}
        options={[
          { value: 'all', label: 'Tất cả chức vụ' },
          ...positionOptions,
        ]}
      />
      <Select
        value={statusFilter}
        onChange={onStatusFilterChange}
        style={{ width: 160 }}
        options={statusOptions}
      />
      <Select
        value={accountStatusFilter}
        onChange={onAccountStatusFilterChange}
        style={{ width: 170 }}
        options={accountStatusOptions}
      />
    </FilterBar>
  );
}
