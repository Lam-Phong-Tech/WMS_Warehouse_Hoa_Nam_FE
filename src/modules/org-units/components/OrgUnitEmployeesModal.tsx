import { useMemo, useRef, useState } from 'react';
import { Modal } from 'antd';
import { EmptyState, LoadingState, ApiErrorAlert } from '@/shared/components';
import { EmployeesFilter } from '@/modules/employees/components/EmployeesFilter';
import { EmployeesTable } from '@/modules/employees/components/EmployeesTable';
import { EmployeeDetailDrawer } from '@/modules/employees/components/EmployeeDetailDrawer';
import { useEmployeeList } from '@/modules/employees/hooks/use-employees';
import { useDepartments } from '@/modules/departments/hooks/use-departments';
import { usePositions } from '@/modules/positions/hooks/use-positions';
import type { OrgUnit } from '@/modules/org-units/types/org-units.types';
import type { Employee } from '@/modules/employees/types/employees.types';

const toOptions = (refs: { id: number; code: string; name: string }[]) =>
  refs.map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }));

export interface OrgUnitEmployeesModalProps {
  open: boolean;
  unit: OrgUnit | null;
  onClose: () => void;
}

/** Modal xem nhanh danh sách nhân sự của một đơn vị tổ chức, kèm bộ lọc giống trang Nhân sự. */
export function OrgUnitEmployeesModal({
  open,
  unit,
  onClose,
}: OrgUnitEmployeesModalProps) {
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [deptFilter, setDeptFilter] = useState<number | 'all'>('all');
  const [positionFilter, setPositionFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [accountStatusFilter, setAccountStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleKeywordChange = (val: string) => {
    setKeyword(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedKeyword(val);
      setPage(1);
    }, 400);
  };

  const listParams = useMemo(
    () => ({
      page,
      per_page: perPage,
      keyword: debouncedKeyword || undefined,
      org_unit_id: unit?.id,
      department_id: deptFilter !== 'all' ? deptFilter : undefined,
      position_id: positionFilter !== 'all' ? positionFilter : undefined,
      employee_status: statusFilter !== 'all' ? statusFilter : undefined,
      account_status:
        accountStatusFilter !== 'all' ? accountStatusFilter : undefined,
    }),
    [
      page,
      perPage,
      debouncedKeyword,
      unit?.id,
      deptFilter,
      positionFilter,
      statusFilter,
      accountStatusFilter,
    ],
  );

  const {
    data: pagedResult,
    isLoading,
    isError,
    error,
    refetch,
  } = useEmployeeList(open && unit ? listParams : {});

  const { data: departments = [] } = useDepartments();
  const { data: positions = [] } = usePositions();
  const departmentOptions = useMemo(
    () => toOptions(departments),
    [departments],
  );
  const positionOptions = useMemo(() => toOptions(positions), [positions]);

  const tableData = useMemo(() => pagedResult?.data ?? [], [pagedResult?.data]);
  const total = pagedResult?.meta?.total ?? 0;

  const isFiltering =
    debouncedKeyword !== '' ||
    deptFilter !== 'all' ||
    positionFilter !== 'all' ||
    statusFilter !== 'all' ||
    accountStatusFilter !== 'all';

  return (
    <Modal
      key={unit?.id}
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      title={`Danh sách nhân sự — ${unit?.name ?? ''}`}
      destroyOnHidden
    >
      <EmployeesFilter
        keyword={keyword}
        onKeywordChange={handleKeywordChange}
        orgFilter={unit?.id ?? 'all'}
        onOrgFilterChange={() => {}}
        deptFilter={deptFilter}
        onDeptFilterChange={(v) => {
          setDeptFilter(v);
          setPage(1);
        }}
        positionFilter={positionFilter}
        onPositionFilterChange={(v) => {
          setPositionFilter(v);
          setPage(1);
        }}
        orgOptions={unit ? [{ value: unit.id, label: unit.name }] : []}
        deptOptions={departmentOptions}
        positionOptions={positionOptions}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        accountStatusFilter={accountStatusFilter}
        onAccountStatusFilterChange={(v: string) => {
          setAccountStatusFilter(v);
          setPage(1);
        }}
      />

      {isError && (
        <ApiErrorAlert
          error={error}
          title="Không tải được danh sách nhân sự"
          onRetry={refetch}
          style={{ marginTop: 16 }}
        />
      )}

      {isLoading && tableData.length === 0 ? (
        <LoadingState tip="Đang tải dữ liệu..." minHeight={240} />
      ) : !isLoading && tableData.length === 0 ? (
        <EmptyState
          title={
            isFiltering
              ? 'Chưa có nhân sự nào khớp bộ lọc'
              : 'Đơn vị này chưa có nhân sự'
          }
          description={
            isFiltering ? 'Thử xóa bộ lọc để xem toàn bộ danh sách.' : undefined
          }
        />
      ) : (
        <div style={{ marginTop: 16 }}>
          <EmployeesTable
            data={tableData}
            loading={isLoading}
            serverPagination={{
              current: page,
              pageSize: perPage,
              total,
              onChange: (p, ps) => {
                setPage(p);
                setPerPage(ps);
              },
            }}
            onView={setDetailEmployee}
            readOnly
          />
        </div>
      )}

      <EmployeeDetailDrawer
        open={detailEmployee !== null}
        employee={detailEmployee}
        onClose={() => setDetailEmployee(null)}
      />
    </Modal>
  );
}
