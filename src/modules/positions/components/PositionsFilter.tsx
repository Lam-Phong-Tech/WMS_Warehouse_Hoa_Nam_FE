import { Input, Select, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

export interface PositionsFilterProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  gradeFilter: string;
  onGradeFilterChange: (value: string) => void;
  gradeOptions: { value: string; label: string }[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

/** Thanh lọc chức vụ: tìm theo mã/tên + lọc theo cấp bậc + trạng thái. */
export function PositionsFilter({
  keyword,
  onKeywordChange,
  gradeFilter,
  onGradeFilterChange,
  gradeOptions,
  statusFilter,
  onStatusFilterChange,
}: PositionsFilterProps) {
  return (
    <Space wrap>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Tìm chức vụ..."
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        style={{ width: 260 }}
      />
      <Select
        value={gradeFilter}
        onChange={onGradeFilterChange}
        style={{ width: 180 }}
        options={[{ value: 'all', label: 'Cấp bậc' }, ...gradeOptions]}
      />
      <Select
        value={statusFilter}
        onChange={onStatusFilterChange}
        style={{ width: 180 }}
        options={[
          { value: 'all', label: 'Trạng thái: Tất cả' },
          { value: 'active', label: 'Hoạt động' },
          { value: 'inactive', label: 'Vô hiệu' },
        ]}
      />
    </Space>
  );
}
