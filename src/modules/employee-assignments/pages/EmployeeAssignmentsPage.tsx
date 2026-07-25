import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Card, Tag, Input, Select, Space } from 'antd';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  PageHeader,
  ApiErrorAlert,
  EmptyState,
  ActionDropdown,
  useSortTooltipColumns,
} from '@/shared/components';
import { DataTable } from '@/shared/components/data-display/DataTable';
import type { ActionItem } from '@/shared/components';
import { Can } from '@/shared/components/permission';
import { TransferFormModal } from '@/modules/employee-assignments/components/TransferFormModal';
import { AssignmentDetailDrawer } from '@/modules/employee-assignments/components/AssignmentDetailDrawer';
import {
  useEmployeeAssignments,
  useSoftDeleteAssignment,
  useEmployeeAssignment,
  type EmployeeAssignment,
} from '@/modules/employee-assignments/hooks/use-employee-assignments';
import { useEmployees } from '@/modules/employees/hooks/use-employees';
import { useOrgUnits } from '@/modules/org-units/hooks/use-org-units';
import { useDepartments } from '@/modules/departments/hooks/use-departments';
import { usePositions } from '@/modules/positions/hooks/use-positions';
import { getMutationErrorMessage } from '@/shared/api/api-error';

function AssignmentsTab() {
  const { modal } = App.useApp();
  const [searchParams] = useSearchParams();
  const employeeIdParam = searchParams.get('employee_id');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeAssignment | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Filter state — pre-set keyword from ?employee_id URL param
  const [keyword, setKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<number | 'all'>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  // Reference data
  const { data: employees = [] } = useEmployees();

  // Set keyword from employee_id param after employees load
  const employeeFromUrl = useMemo(() => {
    if (!employeeIdParam || !employees.length) return null;
    const empId = Number(employeeIdParam);
    return employees.find((e) => e.id === empId) ?? null;
  }, [employeeIdParam, employees]);

  // Pre-set keyword when navigating from employee detail
  const keywordInitializedRef = useRef(false);
  useEffect(() => {
    if (employeeFromUrl && !keywordInitializedRef.current) {
      setKeyword(`${employeeFromUrl.code} — ${employeeFromUrl.fullName}`);
      keywordInitializedRef.current = true;
    }
  }, [employeeFromUrl]);

  const employeeIdFilter = employeeIdParam
    ? Number(employeeIdParam)
    : undefined;

  const listParams = useMemo(
    () => ({
      page,
      limit: perPage,
      keyword: keyword || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      org_unit_id: orgFilter !== 'all' ? orgFilter : undefined,
      employee_id: employeeIdFilter,
    }),
    [page, perPage, keyword, statusFilter, orgFilter, employeeIdFilter],
  );

  const {
    data: pagedResult,
    isLoading,
    error,
    refetch,
  } = useEmployeeAssignments(listParams);

  const tableData = pagedResult?.data ?? [];
  const total = pagedResult?.meta?.total ?? 0;
  const { data: orgUnits = [] } = useOrgUnits({ enabled: true });
  const { data: departments = [] } = useDepartments();
  const { data: positions = [] } = usePositions();

  const orgUnitOptions = useMemo(
    () => orgUnits.map((o) => ({ value: o.id, label: o.name })),
    [orgUnits],
  );

  const { data: detail, isLoading: detailLoading } =
    useEmployeeAssignment(detailId);

  const softDeleteMutation = useSoftDeleteAssignment();

  const isFiltering =
    keyword !== '' || statusFilter !== 'all' || orgFilter !== 'all';

  const hasSelection = selectedRowKeys.length > 0;

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (item: EmployeeAssignment) => {
    setEditing(item);
    setOpen(true);
  };

  const handleSubmit = () => {
    setOpen(false);
    setEditing(null);
    setSelectedRowKeys([]);
  };

  const handleDelete = (id: number) => {
    softDeleteMutation.mutate(id, {
      onSuccess: () => toast.success('Đã xóa phân công nhân sự'),
      onError: (err) => toast.error(getMutationErrorMessage(err)),
    });
  };

  const handleBulkSoftDelete = () => {
    if (selectedRowKeys.length === 0) return;
    modal.confirm({
      title: 'Xóa phân công',
      content: `Bạn có chắc muốn xóa ${selectedRowKeys.length} phân công đã chọn?`,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      onOk: () => {
        let completed = 0;
        selectedRowKeys.forEach((id) => {
          softDeleteMutation.mutate(id as number, {
            onSuccess: () => {
              completed++;
              if (completed === selectedRowKeys.length) {
                toast.success(`Đã xóa ${selectedRowKeys.length} phân công`);
                setSelectedRowKeys([]);
              }
            },
            onError: (err) => toast.error(getMutationErrorMessage(err)),
          });
        });
      },
    });
  };

  const getEmployeeName = (item: EmployeeAssignment) => {
    if (item.employee?.full_name) return item.employee.full_name;
    const emp = employees.find((e) => e.id === item.employee_id);
    return emp?.fullName || 'N/A';
  };

  const getEmployeeCode = (item: EmployeeAssignment) => {
    if (item.employee?.code) return item.employee.code;
    const emp = employees.find((e) => e.id === item.employee_id);
    return emp?.code || 'N/A';
  };

  const getOrgUnitName = (item: EmployeeAssignment) =>
    item.org_unit?.name ??
    orgUnits.find((o) => o.id === item.org_unit_id)?.name ??
    'N/A';

  const getDepartmentName = (item: EmployeeAssignment) =>
    item.department?.name ??
    departments.find((d) => d.id === item.department_id)?.name ??
    'N/A';

  const getPositionName = (item: EmployeeAssignment) =>
    item.position?.name ??
    positions.find((p) => p.id === item.position_id)?.name ??
    'N/A';

  const columns = [
    {
      title: 'Nhân sự',
      key: 'employee',
      sorter: (a: EmployeeAssignment, b: EmployeeAssignment) =>
        getEmployeeName(a).localeCompare(getEmployeeName(b)),
      render: (_: unknown, item: EmployeeAssignment) => (
        <div>
          <div
            style={{
              fontWeight: 700,
              fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
              fontSize: 15,
            }}
          >
            {getEmployeeName(item)}
          </div>
          <div style={{ fontSize: 12, color: '#8c887e' }}>
            {getEmployeeCode(item)}
          </div>
        </div>
      ),
    },
    {
      title: 'Đơn vị / Phòng ban',
      key: 'org',
      sorter: (a: EmployeeAssignment, b: EmployeeAssignment) =>
        getOrgUnitName(a).localeCompare(getOrgUnitName(b)),
      render: (_: unknown, item: EmployeeAssignment) => (
        <div>
          <div>{getOrgUnitName(item)}</div>
          <div style={{ fontSize: 12, color: '#8c887e' }}>
            {getDepartmentName(item)}
          </div>
        </div>
      ),
    },
    {
      title: 'Chức vụ',
      key: 'position',
      sorter: (a: EmployeeAssignment, b: EmployeeAssignment) =>
        getPositionName(a).localeCompare(getPositionName(b)),
      render: (_: unknown, item: EmployeeAssignment) => getPositionName(item),
    },
    {
      title: 'Chính',
      dataIndex: 'is_primary',
      key: 'is_primary',
      width: 80,
      sortType: 'value' as const,
      sorter: (a: EmployeeAssignment, b: EmployeeAssignment) =>
        Number(a.is_primary) - Number(b.is_primary),
      render: (v: boolean) => (v ? <Tag color="blue">Chính</Tag> : '—'),
    },
    {
      title: 'Từ ngày',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 110,
      sortType: 'value' as const,
      sorter: (a: EmployeeAssignment, b: EmployeeAssignment) =>
        new Date(a.start_date ?? 0).getTime() -
        new Date(b.start_date ?? 0).getTime(),
      render: (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Đến ngày',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 110,
      sortType: 'value' as const,
      sorter: (a: EmployeeAssignment, b: EmployeeAssignment) =>
        new Date(a.end_date ?? 0).getTime() -
        new Date(b.end_date ?? 0).getTime(),
      render: (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      sortType: 'value' as const,
      sorter: (a: EmployeeAssignment, b: EmployeeAssignment) =>
        Number(a.status) - Number(b.status),
      render: (status: boolean) => (
        <Tag color={status ? 'success' : 'default'}>
          {status ? 'Đang hiệu lực' : 'Ngưng hiệu lực'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_: unknown, item: EmployeeAssignment) => {
        const actionItems: ActionItem[] = [];

        actionItems.push({
          key: 'edit',
          icon: <EditOutlined />,
          label: 'Sửa',
          permission: 'EMP_ASSIGNMENT_EDIT',
          onClick: () => openEdit(item),
        });
        actionItems.push({
          key: 'softDelete',
          icon: <DeleteOutlined />,
          label: 'Xóa',
          danger: true,
          permission: 'EMP_ASSIGNMENT_DELETE',
          loading:
            softDeleteMutation.isPending &&
            softDeleteMutation.variables === item.id,
          onClick: () => handleDelete(item.id),
        });

        return (
          <Space>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailId(item.id)}
              title="Xem"
            />
            <ActionDropdown items={actionItems} />
          </Space>
        );
      },
    },
  ];

  const { columns: sortedColumns, onSorterChange } =
    useSortTooltipColumns(columns);

  return (
    <>
      <Card variant="borderless">
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Input
            placeholder="Tìm nhân sự…"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            style={{ width: 200, height: 36 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            style={{ width: 180, height: 36 }}
            options={[
              { value: 'all', label: 'Trạng thái: Tất cả' },
              { value: '1', label: 'Đang hiệu lực' },
              { value: '0', label: 'Ngưng hiệu lực' },
            ]}
          />
          <Select
            value={orgFilter}
            onChange={(val) => {
              setOrgFilter(val);
              setPage(1);
            }}
            style={{ width: 220, height: 36 }}
            showSearch
            optionFilterProp="label"
            options={[
              { value: 'all', label: 'Đơn vị: Tất cả' },
              ...orgUnitOptions,
            ]}
          />
          <div style={{ flex: 1 }} />
          {hasSelection && (
            <Space>
              <Can permission="EMP_ASSIGNMENT_DELETE">
                <Button
                  size="small"
                  danger
                  onClick={handleBulkSoftDelete}
                  style={{ height: 36 }}
                >
                  Xóa ({selectedRowKeys.length})
                </Button>
              </Can>
            </Space>
          )}
          <Can permission="EMP_ASSIGNMENT_CREATE">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
              style={{ height: 36 }}
            >
              Điều chuyển
            </Button>
          </Can>
        </div>

        {error && (
          <ApiErrorAlert
            error={error}
            title="Không tải được dữ liệu"
            onRetry={refetch}
            style={{ marginBottom: 16 }}
          />
        )}

        {!isLoading && tableData.length === 0 ? (
          <EmptyState
            title={
              isFiltering
                ? 'Không có bản ghi phù hợp'
                : 'Chưa có điều chuyển nào'
            }
            description={
              isFiltering
                ? 'Thử bỏ bộ lọc để xem toàn bộ.'
                : 'Tạo điều chuyển đầu tiên để bắt đầu.'
            }
          >
            <Can permission="EMP_ASSIGNMENT_CREATE">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                + Điều chuyển
              </Button>
            </Can>
          </EmptyState>
        ) : (
          <DataTable
            dataSource={tableData}
            columns={sortedColumns}
            rowKey="id"
            loading={isLoading}
            onChange={(_p, _f, sorter) => onSorterChange(sorter)}
            showTopPagination
            topPaginationPlacement="bottom"
            serverPagination={{
              total,
              current: page,
              pageSize: perPage,
              onChange: (p, ps) => {
                setPage(p);
                setPerPage(ps);
              },
            }}
            topPaginationConfig={{
              total,
              current: page,
              pageSize: perPage,
              unitName: 'bản ghi',
              pageSizeOptions: [15, 20, 50, 100],
              onChange: (p, ps) => {
                setPage(p);
                setPerPage(ps);
              },
            }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys as React.Key[]),
            }}
          />
        )}
      </Card>

      <TransferFormModal
        open={open}
        editing={editing}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        employees={employees}
        orgUnits={orgUnits}
        departments={departments}
        positions={positions}
      />

      <AssignmentDetailDrawer
        open={detailId != null}
        assignment={detail ?? null}
        loading={detailLoading}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          if (detail) {
            setDetailId(null);
            openEdit(detail);
          }
        }}
      />
    </>
  );
}

export function EmployeeAssignmentsPage() {
  return (
    <div>
      <PageHeader
        title="Điều chuyển công tác"
        subtitle="Quản lý phân công, điều chuyển nhân sự."
      />
      <AssignmentsTab />
    </div>
  );
}
