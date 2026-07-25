import { useMemo, useState } from 'react';
import type React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Button, DatePicker, Select, Table, Tag } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import {
  PageHeader,
  TableContainer,
  TopPagination,
  PageSizeSelector,
  useSortTooltipColumns,
} from '@/shared/components';
import { useTablePattern } from '@/shared/hooks/useTablePattern';
import { Can } from '@/shared/components/permission';
import {
  EmployeeStatusModal,
  type EmployeeStatusPayload,
} from '@/modules/employees/components/EmployeeStatusModal';
import { useEmployeeStatusHistories } from '@/modules/employee-status/hooks/use-employee-status';
import {
  useEmployees,
  useChangeEmployeeStatus,
} from '@/modules/employees/hooks/use-employees';
import { useUsers } from '@/modules/users/hooks/use-users';
import { usersService } from '@/modules/users/services/users.service';
import { userRoleScopesService } from '@/modules/roles/services/user-role-scopes.service';
import { getMutationErrorMessage } from '@/shared/api/api-error';
import {
  EmployeeStatus,
  EMPLOYEE_STATUS_LABELS,
  type EmployeeStatusHistory,
  type EmployeeStatusChangePayload,
  type Employee,
} from '@/modules/employees/types/employees.types';
import { StatusHistoryDetailDrawer } from '@/modules/employee-status/components/StatusHistoryDetailDrawer';

const { RangePicker } = DatePicker;

const STATUS_BADGE: Record<EmployeeStatus, { color: string; icon: string }> = {
  [EmployeeStatus.INTERN]: { color: 'processing', icon: '◔' },
  [EmployeeStatus.PROBATION]: { color: 'blue', icon: '◔' },
  [EmployeeStatus.OFFICIAL]: { color: 'success', icon: '●' },
  [EmployeeStatus.SUSPENDED]: { color: 'warning', icon: '◐' },
  [EmployeeStatus.RESIGNED]: { color: 'error', icon: '✕' },
  [EmployeeStatus.ARCHIVED]: { color: 'default', icon: '📦' },
};

function StatusTag({ status }: { status: EmployeeStatus | null | undefined }) {
  if (status == null) {
    return <Tag>— Mới tạo</Tag>;
  }
  const badge = STATUS_BADGE[status];
  return (
    <Tag color={badge?.color}>
      {badge?.icon}{' '}
      {EMPLOYEE_STATUS_LABELS[status as EmployeeStatus] ?? String(status)}
    </Tag>
  );
}

/** Nội dung tab "Lịch sử trạng thái nhân sự" — dùng lại ở cả EmployeeStatusPage và EmployeeAssignmentsPage. */
export function EmployeeStatusHistoryPanel({
  onViewDetail,
}: {
  onViewDetail?: (recordId: number) => void;
} = {}) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | 'all'>(
    'all',
  );
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [detailRecordId, setDetailRecordId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const {
    page,
    setPage,
    pageSize: perPage,
    setPageSize: setPerPage,
  } = useTablePattern({ initialPageSize: 15 });

  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'all'>(
    'all',
  );
  const [updatedByFilter, setUpdatedByFilter] = useState<number | 'all'>('all');
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);

  const { data: employees = [] } = useEmployees();
  const { data: users = [] } = useUsers();

  const employeeOptions = useMemo(
    () =>
      employees.map((e) => ({
        value: e.id,
        label: `${e.code} — ${e.fullName}`,
      })),
    [employees],
  );

  const selectedEmployee: Employee | null =
    selectedEmployeeId !== 'all'
      ? (employees.find((e) => e.id === selectedEmployeeId) ?? null)
      : null;

  const historyParams = useMemo(
    () => ({
      page,
      limit: perPage,
      employee_id: selectedEmployee ? selectedEmployee.id : undefined,
    }),
    [page, perPage, selectedEmployee],
  );

  const {
    data: pagedResult,
    isLoading,
    error,
    refetch,
  } = useEmployeeStatusHistories(historyParams);

  const history = useMemo(() => {
    return (pagedResult?.data ?? []).filter((item) => {
      if (statusFilter !== 'all' && item.new_status !== statusFilter)
        return false;
      if (updatedByFilter !== 'all' && item.changed_by !== updatedByFilter)
        return false;
      if (dateRange && dateRange[0] && dateRange[1] && item.effective_date) {
        const d = dayjs(item.effective_date);
        if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day'))
          return false;
      }
      return true;
    });
  }, [pagedResult, statusFilter, updatedByFilter, dateRange]);
  const total = pagedResult?.meta?.total ?? 0;

  const lastEffectiveDate = useMemo(() => {
    if (!selectedEmployee) return null;
    const own = (pagedResult?.data ?? []).filter(
      (item) => item.employee_id === selectedEmployee.id,
    );
    if (own.length === 0) return null;
    return own.reduce((latest, item) =>
      dayjs(item.effective_date).isAfter(dayjs(latest.effective_date))
        ? item
        : latest,
    ).effective_date;
  }, [pagedResult, selectedEmployee]);

  const changeStatusMutation = useChangeEmployeeStatus();
  const queryClient = useQueryClient();

  const handleChangeStatus = (payload: EmployeeStatusPayload) => {
    if (!selectedEmployee) return;
    const apiPayload: EmployeeStatusChangePayload = {
      employee_status: payload.employeeStatus as EmployeeStatus,
      effective_date: payload.effectiveDate,
      note: payload.note ?? null,
    };
    changeStatusMutation.mutate(
      { id: selectedEmployee.id, ...apiPayload },
      {
        onSuccess: async () => {
          toast.success('Cập nhật trạng thái thành công');
          setStatusModalOpen(false);
          refetch();

          const isDeactivating =
            apiPayload.employee_status === EmployeeStatus.SUSPENDED ||
            apiPayload.employee_status === EmployeeStatus.RESIGNED;

          if (isDeactivating && selectedEmployee.user_id) {
            if (selectedEmployee.accountStatus === 1) {
              try {
                await usersService.inactive(selectedEmployee.user_id, {
                  reason:
                    apiPayload.note ??
                    'Thay đổi trạng thái nhân sự sang Tạm ngưng/Nghỉ việc',
                  effective_date: apiPayload.effective_date || undefined,
                });
                toast.success('Đồng thời đã vô hiệu hóa tài khoản liên kết');
              } catch (err) {
                toast.error(
                  'Lỗi khi vô hiệu hóa tài khoản liên kết: ' +
                    getMutationErrorMessage(err),
                );
              }
            }
            try {
              const userId = selectedEmployee.user_id;
              const [roleScopesResult, dataScopes] = await Promise.all([
                userRoleScopesService.getUserRoles({
                  user_id: userId,
                  per_page: 100,
                }),
                userRoleScopesService.getUserDataScopes(userId),
              ]);
              const activeRoleScopes = roleScopesResult.data.filter(
                (r) => !r.revoked_at,
              );
              const activeDataScopes = dataScopes.filter((d) => !d.revoked_at);
              const autoRevokeReason =
                'Nhân viên chuyển trạng thái Tạm ngưng/Nghỉ việc';
              await Promise.all([
                ...activeRoleScopes.map((r) =>
                  userRoleScopesService.revokeRoleFromUser(
                    r.id,
                    autoRevokeReason,
                  ),
                ),
                ...activeDataScopes.map((d) =>
                  userRoleScopesService.revokeDataScope(d.id, autoRevokeReason),
                ),
              ]);
              if (activeRoleScopes.length || activeDataScopes.length) {
                toast.success(
                  `Đã thu hồi ${activeRoleScopes.length} vai trò và ${activeDataScopes.length} phạm vi dữ liệu liên kết`,
                );
                queryClient.invalidateQueries({
                  queryKey: ['user-role-scopes'],
                });
                queryClient.invalidateQueries({ queryKey: ['data-scopes'] });
              }
            } catch (err) {
              toast.error(
                'Lỗi khi thu hồi vai trò/quyền hạn: ' +
                  getMutationErrorMessage(err),
              );
            }
          } else if (
            !isDeactivating &&
            selectedEmployee.user_id &&
            selectedEmployee.accountStatus === 0
          ) {
            try {
              await usersService.restore(selectedEmployee.user_id);
              toast.success('Đồng thời đã tái kích hoạt tài khoản liên kết');
            } catch (err) {
              toast.error(
                'Lỗi khi tái kích hoạt tài khoản liên kết: ' +
                  getMutationErrorMessage(err),
              );
            }
          }
        },
        onError: (err) => toast.error(getMutationErrorMessage(err)),
      },
    );
  };

  const handleViewDetail = onViewDetail ?? setDetailRecordId;

  const columns = [
    {
      title: 'Nhân sự',
      key: 'employee',
      sorter: (a: EmployeeStatusHistory, b: EmployeeStatusHistory) =>
        (a.employee?.fullName ?? '').localeCompare(b.employee?.fullName ?? ''),
      render: (_: unknown, item: EmployeeStatusHistory) => (
        <div>
          <div style={{ fontWeight: 700 }}>
            {item.employee?.fullName ?? `ID: ${item.employee_id}`}
          </div>
          <div style={{ fontSize: 12, color: '#8c887e' }}>
            {item.employee?.code ?? ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      sortType: 'value' as const,
      sorter: (a: EmployeeStatusHistory, b: EmployeeStatusHistory) =>
        (a.new_status ?? -1) - (b.new_status ?? -1),
      render: (_: unknown, item: EmployeeStatusHistory) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusTag status={item.old_status} />
          <span style={{ color: '#9a968c' }}>→</span>
          <StatusTag status={item.new_status} />
        </div>
      ),
    },
    {
      title: 'Ngày hiệu lực',
      dataIndex: 'effective_date',
      key: 'effective_date',
      width: 130,
      sortType: 'value' as const,
      sorter: (a: EmployeeStatusHistory, b: EmployeeStatusHistory) =>
        new Date(a.effective_date ?? 0).getTime() -
        new Date(b.effective_date ?? 0).getTime(),
      render: (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Lý do / Ghi chú',
      key: 'note',
      render: (_: unknown, item: EmployeeStatusHistory) =>
        item.reason ?? item.note ?? '—',
    },
    {
      title: 'Người cập nhật',
      key: 'changed_by',
      render: (_: unknown, item: EmployeeStatusHistory) => (
        <div>
          <div>
            {item.created_by_name ??
              item.changed_by_user?.fullName ??
              (item.changed_by ? `ID: ${item.changed_by}` : '—')}
          </div>
          {item.created_by_email && (
            <div style={{ fontSize: 12, color: '#8c887e' }}>
              {item.created_by_email}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Thời gian',
      key: 'created_at',
      width: 140,
      sortType: 'value' as const,
      sorter: (a: EmployeeStatusHistory, b: EmployeeStatusHistory) =>
        new Date(a.created_at ?? 0).getTime() -
        new Date(b.created_at ?? 0).getTime(),
      render: (_: unknown, item: EmployeeStatusHistory) =>
        item.created_at
          ? new Date(item.created_at).toLocaleString('vi-VN')
          : '—',
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 60,
      render: (_: unknown, item: EmployeeStatusHistory) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(item.id)}
          title="Xem chi tiết"
        />
      ),
    },
  ];

  const { columns: sortedColumns, onSorterChange } =
    useSortTooltipColumns(columns);

  const toolbarFilters = (
    <>
      <RangePicker
        format="DD/MM/YYYY"
        placeholder={['Từ ngày', 'Đến ngày']}
        value={dateRange as [dayjs.Dayjs, dayjs.Dayjs] | null}
        onChange={(val) =>
          setDateRange(val as [dayjs.Dayjs, dayjs.Dayjs] | null)
        }
      />
      <Select
        style={{ width: 180 }}
        value={statusFilter}
        onChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        options={[
          { value: 'all', label: 'Tất cả trạng thái' },
          ...Object.values(EmployeeStatus).map((s) => ({
            value: s,
            label: EMPLOYEE_STATUS_LABELS[s],
          })),
        ]}
      />
      <Select
        showSearch
        optionFilterProp="label"
        style={{ width: 220 }}
        value={updatedByFilter}
        onChange={(v) => {
          setUpdatedByFilter(v);
          setPage(1);
        }}
        options={[
          { value: 'all', label: 'Tất cả người cập nhật' },
          ...users.map((u) => ({
            value: u.id,
            label: u.name || u.email || `User #${u.id}`,
          })),
        ]}
      />
    </>
  );

  const toolbarActions = (
    <>
      {selectedEmployee && (
        <Can permission="EMP_STATUS">
          <Button type="primary" onClick={() => setStatusModalOpen(true)}>
            Đổi trạng thái
          </Button>
        </Can>
      )}
    </>
  );

  return (
    <>
      <TableContainer
        toolbar={{
          searchPlaceholder: 'Tìm nhân sự...',
          searchValue: '',
          onSearchChange: () => {},
          filters: toolbarFilters,
          actions: toolbarActions,
        }}
        loading={isLoading}
        error={error as Error | null}
        errorTitle="Không tải được lịch sử trạng thái"
        onRetry={refetch}
        isEmpty={!isLoading && history.length === 0}
        emptyState={{
          title:
            selectedEmployeeId !== 'all'
              ? 'Chưa có lịch sử trạng thái'
              : 'Chưa có dữ liệu trạng thái',
          description:
            selectedEmployeeId !== 'all'
              ? 'Nhân sự này chưa có bản ghi thay đổi trạng thái.'
              : 'Chọn nhân sự để xem lịch sử trạng thái.',
        }}
      >
        {selectedEmployee && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: '#f6f4ee',
              border: '1.5px solid #e3e0d8',
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#dfe6ee',
                flex: 'none',
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {selectedEmployee.fullName}
              </div>
              <div style={{ fontSize: 12, color: '#8c887e' }}>
                {selectedEmployee.code}
              </div>
            </div>
            <div>
              Hiện tại:{' '}
              <StatusTag
                status={
                  (selectedEmployee.employeeStatus ??
                    EmployeeStatus.OFFICIAL) as EmployeeStatus
                }
              />
            </div>
          </div>
        )}

        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Chọn nhân sự để xem lịch sử"
          options={[
            { value: 'all', label: 'Tất cả nhân sự' },
            ...employeeOptions,
          ]}
          value={selectedEmployeeId}
          onChange={(val) => {
            setSelectedEmployeeId(val);
            setPage(1);
          }}
          style={{ width: 320, marginBottom: 16 }}
        />

        <div style={{ marginBottom: 12 }}>
          <PageSizeSelector
            current={page}
            pageSize={perPage}
            pageSizeOptions={[15, 30, 50, 100]}
            onChange={(p, ps) => {
              setPage(p);
              setPerPage(ps);
            }}
          />
        </div>

        {selectedRowKeys.length > 0 && (
          <div
            style={{
              padding: '8px 16px',
              background: '#e6f4ff',
              border: '1px solid #91caff',
              borderRadius: 4,
              marginBottom: 12,
            }}
          >
            Đã chọn <strong>{selectedRowKeys.length}</strong> bản ghi
          </div>
        )}

        <Table
          dataSource={history}
          columns={sortedColumns}
          rowKey="id"
          loading={isLoading}
          onChange={(_p, _f, sorter) => onSorterChange(sorter)}
          pagination={false}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
        />
        <TopPagination
          total={total}
          current={page}
          pageSize={perPage}
          unitName="bản ghi"
          pageSizeOptions={[15, 30, 50, 100]}
          onChange={(p, ps) => {
            setPage(p);
            setPerPage(ps);
          }}
          placement="bottom"
          showSizeChanger={false}
        />
      </TableContainer>

      {selectedEmployee && (
        <EmployeeStatusModal
          open={statusModalOpen}
          employee={selectedEmployee}
          lastEffectiveDate={lastEffectiveDate}
          loading={changeStatusMutation.isPending}
          onCancel={() => setStatusModalOpen(false)}
          onConfirm={handleChangeStatus}
        />
      )}

      <StatusHistoryDetailDrawer
        open={detailRecordId != null}
        recordId={detailRecordId}
        onClose={() => setDetailRecordId(null)}
      />
    </>
  );
}

export function EmployeeStatusPage() {
  return (
    <div>
      <PageHeader
        title="Vòng đời trạng thái nhân sự"
        subtitle="Theo dõi và quản lý trạng thái nhân sự theo thời gian."
      />
      <EmployeeStatusHistoryPanel />
    </div>
  );
}
