import { Select, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { orgUnitsService } from '@/modules/org-units/services/org-units.service';
import { departmentsService } from '@/modules/departments/services/departments.service';
import { warehousesService } from '@/modules/warehouses/services/warehouses.service';

interface ScopeSelectorProps {
  scopeType: string;
  value?: number;
  onChange?: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ScopeSelector({
  scopeType,
  value,
  onChange,
  disabled = false,
}: ScopeSelectorProps) {
  // Load org units (companies/branches)
  const { data: orgUnitsData, isLoading: orgUnitsLoading } = useQuery({
    queryKey: ['org-units', 'select'],
    queryFn: () => orgUnitsService.list(),
    enabled:
      scopeType === 'org_unit' ||
      scopeType === 'company' ||
      scopeType === 'cong_ty' ||
      scopeType === 'chi_nhanh' ||
      scopeType === 'he_thong',
  });

  // Load departments
  const { data: departmentsData, isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments', 'select'],
    queryFn: () => departmentsService.getDepartments(),
    enabled: scopeType === 'department' || scopeType === 'phong_ban',
  });

  // Load warehouses (data scope theo kho — BR yêu cầu công ty/chi nhánh/kho)
  const { data: warehousesData, isLoading: warehousesLoading } = useQuery({
    queryKey: ['warehouses', 'select'],
    queryFn: () => warehousesService.list(),
    enabled: scopeType === 'warehouse' || scopeType === 'kho',
  });

  const handleChange = (newValue: number | undefined) => {
    onChange?.(newValue);
  };

  // Determine which data to show based on scope_type
  const getOptions = () => {
    if (scopeType === 'department' || scopeType === 'phong_ban') {
      return (
        departmentsData?.map((dept) => ({
          label: `${dept.name} (${dept.code})`,
          value: dept.id,
        })) || []
      );
    }

    if (scopeType === 'warehouse' || scopeType === 'kho') {
      return (
        warehousesData?.map((wh) => ({
          label: `${wh.name} (${wh.code})`,
          value: wh.id,
        })) || []
      );
    }

    // Default: org units (company/branch/system)
    return (
      orgUnitsData?.map((ou) => ({
        label: `${ou.name} (${ou.code})`,
        value: ou.id,
      })) || []
    );
  };

  const isLoading = orgUnitsLoading || departmentsLoading || warehousesLoading;

  const getPlaceholder = () => {
    if (isLoading) return 'Đang tải...';
    if (scopeType === 'department' || scopeType === 'phong_ban') {
      return 'Chọn phòng ban';
    }
    if (scopeType === 'warehouse' || scopeType === 'kho') {
      return 'Chọn kho';
    }
    return 'Chọn chi nhánh/công ty';
  };

  return (
    <Select
      value={value}
      onChange={handleChange}
      placeholder={getPlaceholder()}
      disabled={disabled || isLoading}
      showSearch
      optionFilterProp="label"
      style={{ width: '100%' }}
      notFoundContent={isLoading ? <Spin size="small" /> : 'Không có dữ liệu'}
      options={getOptions()}
    />
  );
}
