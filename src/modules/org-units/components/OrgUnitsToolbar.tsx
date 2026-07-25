import type { ReactNode } from 'react';
import { Segmented, Select, Space } from 'antd';
import { ApartmentOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { FilterBar, SearchInput } from '@/shared/components';
import { type OrgUnitStatus } from '@/modules/org-units/types/org-units.types';
import { UNIT_TYPE_OPTIONS } from '@/modules/org-units/types/org-units.types';

export type OrgUnitsViewMode = 'tree' | 'table';

export interface OrgUnitsToolbarProps {
  viewMode: OrgUnitsViewMode;
  keyword: string;
  /**
   * Branch-mode (`/org-units?mode=branch`): ẩn hẳn dropdown "Loại đơn vị" —
   * unitType đã bị khóa cứng về `chi_nhanh` ở filter hook, hiển thị dropdown
   * cho phép đổi sẽ chỉ gây nhầm lẫn (filter đổi không có tác dụng) hoặc tệ
   * hơn là lộ ra option đổi sang loại khác trong khi form Sửa vẫn khóa
   * `lockedUnitType='chi_nhanh'` (P1 fix).
   */
  hideUnitTypeFilter?: boolean;
  filterUnitType?: string;
  filterProvince?: string;
  filterStatus?: OrgUnitStatus;
  filterCompany?: number;
  provinceOptions: { value: string; label: string }[];
  /** Danh sách công ty cha (unitType === 'cong_ty_me' hoặc 'cong_ty_con') để hiển thị trong dropdown filter. */
  companyOptions: { value: number; label: string }[];
  /** Khi true, hiển thị skeleton thay cho filter selects (dữ liệu chưa load). */
  loading?: boolean;
  onViewModeChange: (v: OrgUnitsViewMode) => void;
  onKeywordChange: (v: string) => void;
  onFilterUnitType: (v: string | undefined) => void;
  onFilterProvince: (v: string | undefined) => void;
  onFilterStatus: (v: OrgUnitStatus | undefined) => void;
  onFilterCompany: (v: number | undefined) => void;
  /** Nút "Thêm đơn vị" (đã wrap Can ở page, truyền vào như slot). */
  actionSlot: ReactNode;
}

/**
 * Ant Design Select không phát sinh onChange khi chọn lại option có
 * value: undefined (so với value hiện tại "coi như không đổi"), nên option
 * "Tất cả..." phải dùng sentinel string thay vì undefined mới bấm lại được.
 */
const ALL_VALUE = '__all__';

const STATUS_FILTER_OPTIONS: {
  value: OrgUnitStatus | typeof ALL_VALUE;
  label: string;
}[] = [
  { value: ALL_VALUE, label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Ngừng hoạt động' },
  { value: 'soft_deleted', label: 'Đã xóa chờ khôi phục' },
  { value: 'archived', label: 'Lưu trữ' },
];

export function OrgUnitsToolbar({
  viewMode,
  keyword,
  hideUnitTypeFilter,
  filterUnitType,
  filterProvince,
  filterStatus,
  filterCompany,
  provinceOptions,
  companyOptions,
  onViewModeChange,
  onKeywordChange,
  onFilterUnitType,
  onFilterProvince,
  onFilterStatus,
  onFilterCompany,
  actionSlot,
}: OrgUnitsToolbarProps) {
  return (
    <FilterBar
      actions={
        <>
          <Segmented
            value={viewMode}
            onChange={(v) => onViewModeChange(v as OrgUnitsViewMode)}
            options={[
              {
                value: 'tree',
                icon: <ApartmentOutlined />,
                label: 'Dạng cây',
              },
              {
                value: 'table',
                icon: <UnorderedListOutlined />,
                label: 'Danh sách',
              },
            ]}
          />
          {actionSlot}
        </>
      }
    >
      <Space size="small" wrap>
        <SearchInput
          placeholder="Tìm theo tên, mã..."
          value={keyword}
          onChange={onKeywordChange}
          width={220}
        />
        <Select
          placeholder="Công ty/Đơn vị cha"
          value={filterCompany ?? ALL_VALUE}
          onChange={(v) =>
            onFilterCompany(v === ALL_VALUE ? undefined : (v as number))
          }
          options={[
            { value: ALL_VALUE, label: 'Tất cả công ty/đơn vị cha' },
            ...companyOptions,
          ]}
          style={{ width: 160 }}
          allowClear={false}
        />
        {!hideUnitTypeFilter && (
          <Select
            placeholder="Loại đơn vị"
            value={filterUnitType ?? ALL_VALUE}
            onChange={(v) => onFilterUnitType(v === ALL_VALUE ? undefined : v)}
            options={[
              { value: ALL_VALUE, label: 'Tất cả loại' },
              ...UNIT_TYPE_OPTIONS,
            ]}
            style={{ width: 140 }}
          />
        )}
        <Select
          placeholder="Tỉnh/Thành"
          value={filterProvince ?? ALL_VALUE}
          onChange={(v) => onFilterProvince(v === ALL_VALUE ? undefined : v)}
          options={[
            { value: ALL_VALUE, label: 'Tất cả tỉnh/ thành' },
            ...provinceOptions,
          ]}
          style={{ width: 150 }}
        />
        <Select
          placeholder="Trạng thái"
          value={filterStatus ?? ALL_VALUE}
          onChange={(v) =>
            onFilterStatus(v === ALL_VALUE ? undefined : (v as OrgUnitStatus))
          }
          options={STATUS_FILTER_OPTIONS}
          style={{ width: 150 }}
        />
      </Space>
    </FilterBar>
  );
}
