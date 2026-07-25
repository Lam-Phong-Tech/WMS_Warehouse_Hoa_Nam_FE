import { Button, Grid, Space, Tag } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SwapOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { DataTable, StatusTag, ActionDropdown } from '@/shared/components';
import type { ActionItem, ColumnWithSortType } from '@/shared/components';
import { EMPLOYEE_STATUS_COLOR_MAP } from '@/shared/components';
import {
  usePermission,
  usePermissionState,
  canActionOnRowWithScope,
} from '@/shared/components/permission';
import {
  type Employee,
  EMPLOYEE_STATUS_LABELS,
} from '@/modules/employees/types/employees.types';

/** Nhãn trạng thái tài khoản đăng nhập — đồng bộ với EmployeeDetailDrawer. */
function getAccountStatusLabel(status: number | null | undefined): {
  label: string;
  color: string;
} {
  if (status == null) return { label: 'Chưa cấp tài khoản', color: 'default' };
  if (status === 1) return { label: 'Đang hoạt động', color: 'blue' };
  if (status === 0) return { label: 'Đã khóa', color: 'red' };
  return { label: String(status), color: 'default' };
}

export interface EmployeesTableProps {
  data: Employee[];
  loading?: boolean;
  isChangingStatus?: boolean;
  /** Phân trang server-side — controlled mode. */
  serverPagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  onView: (emp: Employee) => void;
  onEdit?: (emp: Employee) => void;
  onChangeStatus?: (emp: Employee) => void;
  onDelete?: (emp: Employee) => void;
  /** Cấp/tạo lại tài khoản đăng nhập cho nhân sự chưa có tài khoản. */
  onCreateAccount?: (emp: Employee) => void;
  isDeleting?: boolean;
  /** Chỉ hiển thị nút Xem, ẩn Sửa/Đổi trạng thái/Xóa mềm (dùng cho các view lồng chỉ đọc). */
  readOnly?: boolean;
  /** Danh sách khóa đang được chọn để xóa hàng loạt. */
  selectedRowKeys?: React.Key[];
  /** Callback khi thay đổi danh sách chọn. */
  onSelectionChange?: (
    selectedRowKeys: React.Key[],
    selectedRows: Employee[],
  ) => void;
  /** Khôi phục nhân sự đã xóa mềm. */
  onRestore?: (emp: Employee) => void;
  /** Sắp xếp server-side (chỉ áp dụng cột trực tiếp trên employees). */
  onSortChange?: (field?: string, order?: 'asc' | 'desc') => void;
  /** Điều hướng đến trang Điều chuyển công tác cho nhân sự này. */
  onTransfer?: (emp: Employee) => void;
}

/** Map columnKey (FE) → tên trường thực tế backend mong đợi ở sort_by. */
const SORT_FIELD_MAP: Record<string, string> = {
  code: 'code',
  fullName: 'full_name',
  gender: 'gender',
  birthday: 'birthday',
  hireDate: 'hire_date',
  employeeStatus: 'employee_status',
};

/** Bảng nhân sự (kèm phân công chính) + thao tác xem/sửa/đổi trạng thái. */
export function EmployeesTable({
  data,
  loading,
  isChangingStatus,
  serverPagination,
  onView,
  onEdit,
  onChangeStatus,
  onDelete,
  onCreateAccount,
  isDeleting,
  readOnly = false,
  selectedRowKeys,
  onSelectionChange,
  onRestore,
  onSortChange,
  onTransfer,
}: EmployeesTableProps) {
  const { xs } = Grid.useBreakpoint();
  const { can: canEdit } = usePermission({
    module: 'employees',
    action: 'edit',
  });

  const { can: canChangeStatus } = usePermission({
    module: 'employee_status',
    action: 'create',
  });
  const { can: canInactive } = usePermission({
    module: 'employees',
    action: 'delete',
  });
  const { can: canCreateAccount } = usePermission({
    permissionCode: 'EMP_ACCOUNT_CREATE',
  });
  const { can: canRestore } = usePermission({
    permissionCode: 'EMP_RESTORE',
  });
  const { can: canTransfer } = usePermission({
    module: 'employee_assignments',
    action: 'create',
  });
  const {
    isSuperAdmin,
    currentScopeType,
    currentOrgUnitId,
    currentDepartmentId,
  } = usePermissionState();
  const rowScopeContext = {
    scopeType: currentScopeType,
    orgUnitId: currentOrgUnitId,
    departmentId: currentDepartmentId,
  };

  /**
   * Row-level scope: BE chưa trả `scope`/`scope_type` theo từng nhân sự, nên
   * so khớp trực tiếp `org_unit_id`/`department_id` của assignment chính với
   * ID của context đang active (xem `isRecordInScopeById` trong
   * `permission.scope.ts`). PII nhân sự — ẩn hẳn action ngoài phạm vi thay vì
   * chỉ disable.
   *
   * Ưu tiên dùng `scope_type` từ BE nếu record có, fallback về ID matching.
   */
  function isRowActionAllowed(
    hasModulePermission: boolean,
    record: Employee,
    module: string,
    action: 'edit' | 'delete' | 'create',
  ): boolean {
    const target = {
      orgUnitId: record.primaryAssignment?.org_unit_id,
      departmentId: record.primaryAssignment?.department_id,
    };
    return canActionOnRowWithScope(
      hasModulePermission,
      rowScopeContext,
      record,
      target,
      module,
      action,
      isSuperAdmin,
    );
  }

  const columns: ColumnWithSortType<Employee> = [
    {
      title: 'Mã nhân sự',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      fixed: 'left',
      sorter: true,
    },
    {
      title: 'Họ tên',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 160,
      sorter: true,
    },
    {
      title: 'Đơn vị',
      key: 'org_unit',
      width: 160,
      // Trường quan hệ (join) — backend chưa hỗ trợ sort theo cột này.
      render: (_, record) => record.primaryAssignment?.org_unit?.name ?? '—',
    },
    {
      title: 'Phòng ban',
      key: 'department',
      width: 150,
      responsive: ['sm'],
      render: (_, record) => record.primaryAssignment?.department?.name ?? '—',
    },
    {
      title: 'Chức vụ',
      key: 'position',
      width: 130,
      render: (_, record) => {
        const name = record.primaryAssignment?.position?.name;
        return name ? <Tag color="purple">{name}</Tag> : '—';
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'employeeStatus',
      key: 'employeeStatus',
      width: 130,
      sortType: 'value',
      sorter: true,
      render: (_, record) => (
        <StatusTag
          status={record.employeeStatus ?? -1}
          colorMap={EMPLOYEE_STATUS_COLOR_MAP}
          labelMap={EMPLOYEE_STATUS_LABELS}
        />
      ),
    },
    {
      title: 'Tài khoản',
      dataIndex: 'accountStatus',
      key: 'accountStatus',
      width: 140,
      responsive: ['md'],
      // Trường quan hệ (user) — backend chưa hỗ trợ sort theo cột này.
      render: (_, record) => {
        const { label, color } = getAccountStatusLabel(record.accountStatus);
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: xs ? 100 : 170,
      fixed: 'right',
      render: (_, record) => {
        const actionItems: ActionItem[] = [];

        if (!readOnly) {
          if (
            onEdit &&
            isRowActionAllowed(canEdit, record, 'employees', 'edit')
          ) {
            actionItems.push({
              key: 'edit',
              icon: <EditOutlined />,
              label: 'Sửa',
              onClick: () => onEdit(record),
            });
          }
          if (
            onChangeStatus &&
            isRowActionAllowed(
              canChangeStatus,
              record,
              'employee_status',
              'create',
            )
          ) {
            actionItems.push({
              key: 'changeStatus',
              icon: <SwapOutlined />,
              label: 'Đổi TT',
              loading: isChangingStatus,
              onClick: () => onChangeStatus(record),
            });
          }
          if (
            onDelete &&
            isRowActionAllowed(canInactive, record, 'employees', 'delete')
          ) {
            actionItems.push({
              key: 'delete',
              icon: <DeleteOutlined />,
              label: 'Xóa',
              danger: true,
              loading: isDeleting,
              onClick: () => onDelete(record),
            });
          }
          if (
            onCreateAccount &&
            !record.user_id &&
            isRowActionAllowed(canCreateAccount, record, 'employees', 'create')
          ) {
            actionItems.push({
              key: 'createAccount',
              icon: <UserAddOutlined />,
              label: 'Cấp tài khoản',
              onClick: () => onCreateAccount(record),
            });
          }
          if (
            onRestore &&
            isRowActionAllowed(canRestore, record, 'employees', 'create')
          ) {
            actionItems.push({
              key: 'restore',
              icon: <SwapOutlined />,
              label: 'Khôi phục',
              onClick: () => onRestore(record),
            });
          }
          if (
            onTransfer &&
            isRowActionAllowed(
              canTransfer,
              record,
              'employee_assignments',
              'create',
            )
          ) {
            actionItems.push({
              key: 'transfer',
              icon: <SwapOutlined />,
              label: 'Điều chuyển công tác',
              onClick: () => onTransfer(record),
            });
          }
        }

        return (
          <Space size={4}>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onView(record)}
              aria-label={`Xem nhân sự ${record.fullName}`}
            >
              {!xs && ''}
            </Button>
            {actionItems.length > 0 && <ActionDropdown items={actionItems} />}
          </Space>
        );
      },
    },
  ];

  return (
    <DataTable<Employee>
      columns={columns}
      dataSource={data}
      loading={loading}
      showTopPagination={!!serverPagination}
      topPaginationPlacement="bottom"
      topPaginationConfig={
        serverPagination
          ? {
              total: serverPagination.total,
              current: serverPagination.current,
              pageSize: serverPagination.pageSize,
              unitName: 'nhân sự',
              pageSizeOptions: [15, 20, 50, 100],
              onChange: serverPagination.onChange,
            }
          : undefined
      }
      serverPagination={
        serverPagination
          ? {
              total: serverPagination.total,
              current: serverPagination.current,
              pageSize: serverPagination.pageSize,
              onChange: serverPagination.onChange,
            }
          : undefined
      }
      onChange={(_pagination, _filters, sorter) => {
        if (!onSortChange) return;
        const s = Array.isArray(sorter) ? sorter[0] : sorter;
        const feKey = s?.order ? (s.columnKey as string) : undefined;
        const field = feKey ? SORT_FIELD_MAP[feKey] : undefined;
        const order =
          s?.order === 'ascend'
            ? 'asc'
            : s?.order === 'descend'
              ? 'desc'
              : undefined;
        onSortChange(field, order);
      }}
      rowSelection={
        selectedRowKeys !== undefined || onSelectionChange !== undefined
          ? {
              selectedRowKeys: selectedRowKeys || [],
              onChange: onSelectionChange,
            }
          : undefined
      }
    />
  );
}
