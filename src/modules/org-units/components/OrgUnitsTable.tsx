import { useMemo } from 'react';
import { Button, Space, Grid } from 'antd';
import {
  EditOutlined,
  StopOutlined,
  UndoOutlined,
  InboxOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { DataTable, StatusTag, ActionDropdown } from '@/shared/components';
import type { ActionItem, ColumnWithSortType } from '@/shared/components';
import {
  usePermission,
  usePermissionState,
  canActionOnRowWithScope,
} from '@/shared/components/permission';
import {
  UNIT_TYPE_LABELS,
  ORG_UNIT_STATUS_LABELS,
  ORG_UNIT_STATUS_COLORS,
  getOrgUnitStatus,
  type OrgUnit,
  type OrgUnitTreeNode,
} from '@/modules/org-units/types/org-units.types';
import { isBulkSelectable } from '@/modules/org-units/utils/org-units.helpers';

export interface OrgUnitsTableProps {
  /** Dữ liệu dạng cây (có `children`) để hỗ trợ sổ/thu công ty con, chi nhánh. */
  data: OrgUnitTreeNode[];
  loading?: boolean;
  nameById: Map<number, string>;
  deactivatingId?: number;
  restoringId?: number;
  archivingId?: number;
  onEdit: (unit: OrgUnit) => void;
  /** Mở khung xem chi tiết đơn vị (split-view desktop WF-02). */
  onView?: (unit: OrgUnit) => void;
  onDeactivate: (unit: OrgUnit) => void;
  onRestore?: (unit: OrgUnit) => void;
  onArchive?: (unit: OrgUnit) => void;
  /**
   * P0.1: chế độ "Quản lý chi nhánh" (`?mode=branch`) — Công ty mẹ/con chỉ
   * còn hiển thị trong bảng để làm ancestor context của cây, không phải đối
   * tượng thao tác. Khóa toàn bộ action (Sửa/Vô hiệu/Khôi phục/Lưu trữ) và
   * checkbox chọn hàng loạt đối với các node này.
   */
  isBranchMode?: boolean;
  /**
   * Phân trang controlled (controlledPagination) — cha component tự filter +
   * sort trên toàn bộ dataset đã tải rồi cắt trang client-side, prop này chỉ
   * điều khiển UI phân trang (total/current/pageSize/onChange).
   * Tên `controlledPagination` thể hiện đúng bản chất: đây là client-side
   * pagination được control bởi parent component, không phải server-side
   * pagination gọi API theo trang (xem docs/P1_BRANCH_MANAGEMENT_SERVER_SIDE_PAGINATION.md).
   */
  controlledPagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  /** Permissions for column visibility control (P1.4) */
  permissions?: {
    canViewManager?: boolean;
    canViewProvince?: boolean;
  };
  /** Callback when clicking add child company */
  onAddChild?: (parent: OrgUnit) => void;
  /** Callback when clicking add branch */
  onAddBranch?: (parent: OrgUnit) => void;
  /** Danh sách khóa đang được chọn để xóa hàng loạt. */
  selectedRowKeys?: React.Key[];
  /** Callback khi thay đổi danh sách chọn. */
  onSelectionChange?: (
    selectedRowKeys: React.Key[],
    selectedRows: OrgUnit[],
  ) => void;
  /**
   * Sắp xếp trên toàn bộ dataset đã tải (không phải chỉ trang hiện tại) —
   * cha component áp dụng sort trước khi cắt trang, xem `sortOrgUnitTree`.
   */
  onSortChange?: (field?: string, order?: 'asc' | 'desc') => void;
}

/** Bảng danh sách đơn vị tổ chức theo WF-02: mã, tên, loại, đơn vị cha, tỉnh/TP, người đại diện, trạng thái, thao tác. */
export function OrgUnitsTable({
  data,
  loading,
  nameById,
  deactivatingId,
  restoringId,
  archivingId,
  onEdit,
  onView,
  onDeactivate,
  onRestore,
  onArchive,
  isBranchMode = false,
  permissions,
  selectedRowKeys,
  onSelectionChange,
  onSortChange,
  controlledPagination,
}: OrgUnitsTableProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  // BE xác nhận catalog chính thức không có ORG_VIEW_MANAGER/ORG_VIEW_PROVINCE
  // (field-level) — dùng chung ORG_VIEW để tránh ẩn cột với mọi user.
  const { can: canViewManagerHook } = usePermission({
    module: 'org_units',
    action: 'view',
  });
  const { can: canViewProvinceHook } = usePermission({
    module: 'org_units',
    action: 'view',
  });

  const canViewManager = permissions?.canViewManager ?? canViewManagerHook;
  const canViewProvince = permissions?.canViewProvince ?? canViewProvinceHook;

  const { can: canEdit } = usePermission({
    module: 'org_units',
    action: 'edit',
  });
  const { can: canDeactivate } = usePermission({
    module: 'org_units',
    action: 'delete',
  });
  const { can: canRestorePerm } = usePermission({
    module: 'org_units',
    action: 'restore',
  });
  const { can: canArchive } = usePermission({
    module: 'org_units',
    action: 'delete',
    permissionCode: 'ORG_FORCE_DELETE',
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
   * Row-level scope: org unit CHÍNH LÀ đơn vị 'co_so' — so khớp trực tiếp
   * `record.id` với `orgUnitId` của context đang active (khác Employees/
   * Departments vốn chỉ tham chiếu org unit qua field quan hệ).
   *
   * Ưu tiên dùng `scope_type` từ BE nếu record có, fallback về ID matching.
   */
  function isOrgUnitRowActionAllowed(
    hasModulePermission: boolean,
    record: OrgUnit,
    action: 'edit' | 'delete' | 'restore',
  ): boolean {
    return canActionOnRowWithScope(
      hasModulePermission,
      rowScopeContext,
      record,
      { orgUnitId: record.id },
      'org_units',
      action,
      isSuperAdmin,
    );
  }

  const visibleData = useMemo(() => {
    if (isSuperAdmin) return data;

    switch (currentScopeType) {
      case 'co_so': {
        if (currentOrgUnitId == null) return data;
        return data.filter((record) => {
          const targetOrgUnitId = record.orgUnitId ?? record.id;
          return targetOrgUnitId === currentOrgUnitId;
        });
      }
      case 'phong_ban': {
        if (currentDepartmentId == null) return data;
        return data.filter((record) => {
          const targetDepartmentId =
            (
              record as OrgUnitTreeNode & {
                departmentId?: number | null;
                department_id?: number | null;
              }
            ).departmentId ??
            (record as OrgUnitTreeNode & { department_id?: number | null })
              .department_id ??
            record.parentId;
          return (
            targetDepartmentId == null ||
            targetDepartmentId === currentDepartmentId
          );
        });
      }
      default:
        return data;
    }
  }, [
    data,
    currentDepartmentId,
    currentOrgUnitId,
    currentScopeType,
    isSuperAdmin,
  ]);

  const columns: ColumnWithSortType<OrgUnitTreeNode> = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      sorter: true,
    },
    {
      title: 'Tên đơn vị',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      ellipsis: true,
      sorter: true,
    },
    {
      title: 'Loại',
      dataIndex: 'unitType',
      key: 'unitType',
      width: 130,
      responsive: ['md'],
      sorter: true,
      render: (unitType: string) => UNIT_TYPE_LABELS[unitType] ?? unitType,
    },
    {
      title: 'Đơn vị cha',
      key: 'parentUnit',
      width: 200,
      ellipsis: true,
      sorter: true,
      render: (_value: unknown, record: OrgUnit) =>
        record.parentId ? (nameById.get(record.parentId) ?? '—') : '—',
    },
    ...(canViewProvince
      ? [
          {
            title: 'Tỉnh/TP',
            dataIndex: 'province',
            key: 'province',
            width: 130,
            sorter: true,
            render: (value: string | null | undefined) => value || '—',
          } as const,
        ]
      : []),
    ...(canViewManager
      ? [
          {
            title: 'Người đại diện',
            key: 'representative',
            width: 170,
            sorter: true,
            render: (_value: unknown, record: OrgUnit) =>
              record.representativeName ?? record.manager?.full_name ?? '—',
          } as const,
        ]
      : []),
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      sorter: true,
      render: (_, record) => {
        const status = getOrgUnitStatus(record);
        return (
          <StatusTag
            status={status}
            colorMap={ORG_UNIT_STATUS_COLORS}
            labelMap={ORG_UNIT_STATUS_LABELS}
          />
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => {
        const status = getOrgUnitStatus(record);
        // P0.1: trong chế độ Chi nhánh, Công ty mẹ/con chỉ là ancestor context
        // của cây — không phải đối tượng thao tác (Sửa/Vô hiệu/Khôi phục/Lưu trữ).
        const isBranchRecord = !isBranchMode || record.unitType === 'chi_nhanh';
        const isActionPending =
          deactivatingId === record.id ||
          restoringId === record.id ||
          archivingId === record.id;

        let remainingDays = 14;
        if (record.deletedAt) {
          const deletedDate = new Date(record.deletedAt);
          const deadlineDate = new Date(deletedDate);
          deadlineDate.setDate(deadlineDate.getDate() + 14);
          const now = new Date();
          remainingDays = Math.max(
            0,
            Math.ceil(
              (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            ),
          );
        }
        const isRestoreDisabled =
          (status === 'soft_deleted' && remainingDays <= 0) ||
          record.canRestore === false ||
          record.can_restore === false;

        const actionItems: ActionItem[] = [];

        // P0: Gate action theo quyền
        // Sửa: chỉ hiển thị khi active, có quyền ORG_EDIT và record thuộc
        // phạm vi (org_unit_id) của context đang active (row-level scope).
        if (
          isBranchRecord &&
          status === 'active' &&
          isOrgUnitRowActionAllowed(canEdit, record, 'edit')
        ) {
          actionItems.push({
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Sửa',
            onClick: () => onEdit(record),
            disabled: isActionPending,
            module: 'org_units',
            action: 'edit',
          });
        }

        // Vô hiệu: chỉ hiển thị khi active, có quyền ORG_INACTIVE, scope đủ
        // rộng lẫn record thuộc phạm vi context đang active.
        if (
          isBranchRecord &&
          status === 'active' &&
          isOrgUnitRowActionAllowed(canDeactivate, record, 'delete')
        ) {
          actionItems.push({
            key: 'deactivate',
            icon: <StopOutlined />,
            label: 'Vô hiệu',
            danger: true,
            onClick: () => onDeactivate(record),
            disabled: isActionPending,
            loading: deactivatingId === record.id,
            module: 'org_units',
            action: 'delete',
          });
        }

        // Khôi phục: chỉ hiển thị khi inactive/soft_deleted, có quyền
        // ORG_INACTIVE, scope đủ rộng lẫn record thuộc phạm vi context.
        if (
          isBranchRecord &&
          (status === 'soft_deleted' || status === 'inactive') &&
          onRestore &&
          isOrgUnitRowActionAllowed(canRestorePerm, record, 'restore')
        ) {
          actionItems.push({
            key: 'restore',
            icon: <UndoOutlined />,
            label: 'Khôi phục',
            onClick: () => onRestore(record),
            disabled: isActionPending || isRestoreDisabled,
            loading: restoringId === record.id,
            module: 'org_units',
            action: 'restore',
          });
        }

        // Lưu trữ: chỉ hiển thị khi inactive/soft_deleted, có quyền ORG_FORCE_DELETE,
        // scope đủ rộng (dùng permissionCode tùy biến nhưng vẫn giữ scope
        // requirement của action 'delete' — xem MODULE_SCOPE_REQUIREMENTS.org_units)
        // lẫn record thuộc phạm vi context đang active.
        if (
          isBranchRecord &&
          (status === 'soft_deleted' || status === 'inactive') &&
          onArchive &&
          isOrgUnitRowActionAllowed(canArchive, record, 'delete')
        ) {
          actionItems.push({
            key: 'archive',
            icon: <InboxOutlined />,
            label: 'Lưu trữ',
            onClick: () => onArchive(record),
            disabled: isActionPending,
            loading: archivingId === record.id,
            module: 'org_units',
            action: 'delete',
            permissionCode: 'ORG_FORCE_DELETE',
          });
        }

        return (
          <Space size={isMobile ? 2 : 4}>
            {onView && (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => onView(record)}
                aria-label={`Xem đơn vị ${record.name}`}
                title="Xem chi tiết"
              ></Button>
            )}
            {actionItems.length > 0 && <ActionDropdown items={actionItems} />}
          </Space>
        );
      },
    },
  ];

  return (
    <DataTable<OrgUnitTreeNode>
      columns={columns}
      dataSource={visibleData}
      loading={loading}
      rowKey="id"
      scroll={{ x: 1450 }}
      size={isMobile ? 'small' : undefined}
      showTopPagination={!!controlledPagination}
      topPaginationPlacement="bottom"
      topPaginationConfig={
        controlledPagination
          ? {
              total: controlledPagination.total,
              current: controlledPagination.current,
              pageSize: controlledPagination.pageSize,
              unitName: 'đơn vị',
              pageSizeOptions: [15, 20, 50, 100],
              onChange: controlledPagination.onChange,
            }
          : undefined
      }
      serverPagination={
        controlledPagination
          ? {
              total: controlledPagination.total,
              current: controlledPagination.current,
              pageSize: controlledPagination.pageSize,
              onChange: controlledPagination.onChange,
            }
          : undefined
      }
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
              getCheckboxProps: (record: OrgUnitTreeNode) => ({
                disabled: !isBulkSelectable(record, isBranchMode),
              }),
            }
          : undefined
      }
    />
  );
}
