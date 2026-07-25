import { Button, Space, Tooltip } from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  StopOutlined,
  UndoOutlined,
  DeleteOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import {
  DataTable,
  EmptyState,
  StatusTag,
  ActionDropdown,
} from '@/shared/components';
import type { ActionItem, ColumnWithSortType } from '@/shared/components';
import {
  usePermission,
  usePermissionState,
  canActionOnRowWithScope,
} from '@/shared/components/permission';
import {
  DEPARTMENT_STATUS_LABELS,
  getDepartmentStatus,
  getDaysRemaining,
  type DepartmentTreeNode,
} from '@/modules/departments/types/departments.types';
import { ORG_UNIT_STATUS_COLORS } from '@/modules/org-units/types/org-units.types';

export interface DepartmentsTableProps {
  data: DepartmentTreeNode[];
  loading?: boolean;
  inactivatingId?: number;
  activatingId?: number;
  softDeletingId?: number;
  restoringId?: number;
  /** Phân trang server-side — controlled mode. */
  serverPagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  onView: (dept: DepartmentTreeNode) => void;
  onEdit: (dept: DepartmentTreeNode) => void;
  /** Vô hiệu hóa (active → inactive). PUT /departments/{id} status=0. */
  onInactive: (dept: DepartmentTreeNode) => void;
  /** Kích hoạt lại (inactive → active). PUT /departments/{id} status=1. */
  onActivate: (dept: DepartmentTreeNode) => void;
  /** Xóa mềm (active/inactive → soft_deleted). DELETE /departments/{id}/soft-delete. */
  onSoftDelete: (dept: DepartmentTreeNode) => void;
  /** Khôi phục (soft_deleted → active). PATCH /departments/{id}/restore. */
  onRestore: (dept: DepartmentTreeNode) => void;
  /** Mở form thêm mới, prefill sẵn phòng ban cha = dept này (chỉ áp dụng cho phòng ban, không phải nhóm/tổ). */
  onCreateSubgroup?: (dept: DepartmentTreeNode) => void;
  /** Danh sách khóa đang được chọn để xóa hàng loạt. */
  selectedRowKeys?: React.Key[];
  /** Callback khi thay đổi danh sách chọn. */
  onSelectionChange?: (
    selectedRowKeys: React.Key[],
    selectedRows: DepartmentTreeNode[],
  ) => void;
  /** Sắp xếp server-side (chỉ áp dụng cột trực tiếp: mã, tên). */
  onSortChange?: (field?: string, order?: 'asc' | 'desc') => void;
}

/** Bảng phòng ban (cây/phẳng) + thao tác sửa/vô hiệu/xóa mềm/khôi phục. */
export function DepartmentsTable({
  data,
  loading,
  inactivatingId,
  activatingId,
  softDeletingId,
  restoringId,
  serverPagination,
  onView,
  onEdit,
  onInactive,
  onActivate,
  onSoftDelete,
  onRestore,
  onCreateSubgroup,
  selectedRowKeys,
  onSelectionChange,
  onSortChange,
}: DepartmentsTableProps) {
  const { can: canEdit } = usePermission({
    module: 'departments',
    action: 'edit',
  });
  const { can: canInactive } = usePermission({
    module: 'departments',
    action: 'delete',
  });
  const { can: canCreate } = usePermission({
    module: 'departments',
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
   * Row-level scope: 'create' (tạo nhóm/tổ con) yêu cầu scope 'co_so' — so
   * khớp org unit chủ quản của phòng ban (record.orgUnitId). 'edit'/'delete'
   * yêu cầu scope 'phong_ban'/'co_so' tương ứng, dùng chính record.id làm
   * departmentId để so khớp phạm vi phòng ban đang được giao.
   *
   * Ưu tiên dùng `scope_type` từ BE nếu record có, fallback về ID matching.
   */
  function isDepartmentRowActionAllowed(
    hasModulePermission: boolean,
    record: DepartmentTreeNode,
    action: 'edit' | 'delete' | 'create',
  ): boolean {
    return canActionOnRowWithScope(
      hasModulePermission,
      rowScopeContext,
      record,
      { orgUnitId: record.orgUnitId, departmentId: record.id },
      'departments',
      action,
      isSuperAdmin,
    );
  }

  const columns: ColumnWithSortType<DepartmentTreeNode> = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      sorter: true,
    },
    {
      title: 'Tên phòng ban',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
    },
    {
      title: 'Đơn vị trực thuộc',
      dataIndex: 'orgUnitName',
      key: 'orgUnitName',
      // Không có sorter: đây là trường quan hệ (join), backend chưa hỗ trợ
      // sort theo cột này — bật sorter client-side sẽ chỉ đúng trong 1 trang.
      render: (orgUnitName?: string) => orgUnitName || '—',
    },
    {
      title: 'Trưởng phòng',
      dataIndex: 'managerName',
      key: 'managerName',
      responsive: ['md'], // P2.5: Ẩn trên màn nhỏ
      render: (managerName?: string) => managerName || '—',
    },
    {
      title: 'Số NV',
      dataIndex: 'employeeCount',
      key: 'employeeCount',
      responsive: ['lg'], // P2.5: Ẩn trên màn nhỏ và vừa
      width: 100,
      render: (count?: number) => count ?? 0,
    },
    {
      title: 'Trạng thái',
      key: 'active',
      render: (_, record) => {
        const status = getDepartmentStatus(record);
        const daysRemaining = getDaysRemaining(record.restoreDeadline);

        const statusTag = (
          <StatusTag
            status={status}
            colorMap={ORG_UNIT_STATUS_COLORS}
            labelMap={DEPARTMENT_STATUS_LABELS}
          />
        );

        if (status === 'soft_deleted' && daysRemaining != null) {
          return (
            <Tooltip title={`Có thể khôi phục trong ${daysRemaining} ngày tới`}>
              {statusTag}
            </Tooltip>
          );
        }

        return statusTag;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const status = getDepartmentStatus(record);
        const isActionPending =
          inactivatingId === record.id ||
          activatingId === record.id ||
          softDeletingId === record.id ||
          restoringId === record.id;

        const actionItems: ActionItem[] = [];

        if (
          status === 'active' &&
          isDepartmentRowActionAllowed(canEdit, record, 'edit')
        ) {
          actionItems.push({
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Sửa',
            onClick: () => onEdit(record),
            disabled: isActionPending,
          });
        }

        if (
          status === 'active' &&
          record.departmentType === 'phong_ban' &&
          onCreateSubgroup &&
          isDepartmentRowActionAllowed(canCreate, record, 'create')
        ) {
          actionItems.push({
            key: 'createSubgroup',
            icon: <ApartmentOutlined />,
            label: 'Tạo nhóm/tổ con',
            onClick: () => onCreateSubgroup(record),
            disabled: isActionPending,
          });
        }

        if (
          status === 'active' &&
          isDepartmentRowActionAllowed(canInactive, record, 'delete')
        ) {
          actionItems.push({
            key: 'inactive',
            icon: <StopOutlined />,
            label: 'Ngừng hoạt động',
            danger: true,
            onClick: () => onInactive(record),
            disabled: isActionPending,
            loading: inactivatingId === record.id,
          });
        }

        if (
          status === 'inactive' &&
          isDepartmentRowActionAllowed(canInactive, record, 'delete')
        ) {
          actionItems.push({
            key: 'activate',
            icon: <UndoOutlined />,
            label: 'Kích hoạt lại',
            onClick: () => onActivate(record),
            disabled: isActionPending,
            loading: activatingId === record.id,
          });
        }

        if (
          (status === 'active' || status === 'inactive') &&
          isDepartmentRowActionAllowed(canInactive, record, 'delete')
        ) {
          actionItems.push({
            key: 'softDelete',
            icon: <DeleteOutlined />,
            label: 'Xóa',
            danger: true,
            onClick: () => onSoftDelete(record),
            disabled: isActionPending,
            loading: softDeletingId === record.id,
          });
        }

        if (
          status === 'soft_deleted' &&
          isDepartmentRowActionAllowed(canInactive, record, 'delete')
        ) {
          actionItems.push({
            key: 'restore',
            icon: <UndoOutlined />,
            label: 'Khôi phục',
            onClick: () => onRestore(record),
            disabled: isActionPending,
            loading: restoringId === record.id,
          });
        }

        return (
          <Space>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onView(record)}
            ></Button>
            {actionItems.length > 0 && <ActionDropdown items={actionItems} />}
          </Space>
        );
      },
    },
  ];

  return (
    <DataTable<DepartmentTreeNode>
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
              unitName: 'phòng ban',
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
      locale={{ emptyText: <EmptyState /> }}
      onChange={(_pagination, _filters, sorter) => {
        if (!onSortChange) return;
        const s = Array.isArray(sorter) ? sorter[0] : sorter;
        const field = s?.order ? (s.columnKey as string) : undefined;
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
