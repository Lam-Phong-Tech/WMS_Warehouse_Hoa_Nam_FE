import { Button, Space, Tag } from 'antd';
import { EditOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { DataTable, StatusBadge, ActionDropdown } from '@/shared/components';
import type { ActionItem, ColumnWithSortType } from '@/shared/components';
import { PermissionGuard } from '@/shared/components';
import type { Role } from '@/modules/roles/types/roles.types';

export interface RolesTableProps {
  data: Role[];
  loading?: boolean;
  deletingId?: number;
  onView: (id: number) => void;
  onEdit: (role: Role) => void;
  onDelete: (id: number) => void;
  /** Danh sách khóa đang được chọn để xóa hàng loạt. */
  selectedRowKeys?: React.Key[];
  /** Callback khi thay đổi danh sách chọn. */
  onSelectionChange?: (
    selectedRowKeys: React.Key[],
    selectedRows: Role[],
  ) => void;
}

/** Bảng danh sách vai trò + thao tác xem/sửa/xoá. */
export function RolesTable({
  data,
  loading,
  deletingId,
  onView,
  onEdit,
  onDelete,
  selectedRowKeys,
  onSelectionChange,
}: RolesTableProps) {
  const columns: ColumnWithSortType<Role> = [
    {
      title: 'Tên vai trò',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{record.code}</div>
        </div>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      sorter: (a, b) =>
        (a.description ?? '').localeCompare(b.description ?? ''),
      render: (desc) => desc || '—',
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      sorter: (a, b) => a.type.localeCompare(b.type),
      render: (type: string) =>
        type === 'co_dinh' ? (
          <Tag color="blue">Cố định</Tag>
        ) : (
          <Tag>Tùy chỉnh</Tag>
        ),
    },
    {
      title: 'Số quyền',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 120,
      align: 'center',
      sortType: 'value',
      sorter: (a, b) =>
        (a.permissions?.length ?? 0) - (b.permissions?.length ?? 0),
      render: (permissions: unknown[]) => permissions?.length ?? 0,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      sortType: 'value',
      sorter: (a, b) => a.status - b.status,
      render: (status: number) => <StatusBadge active={status === 1} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 170,
      align: 'center',
      render: (_, record) => {
        const actionItems: ActionItem[] = [];

        actionItems.push({
          key: 'edit',
          icon: <EditOutlined />,
          label: 'Sửa',
          onClick: () => onEdit(record),
          permission: 'ROLE_MANAGE',
        });
        actionItems.push({
          key: 'delete',
          icon: <DeleteOutlined />,
          label: 'Xoá',
          danger: true,
          loading: deletingId === record.id,
          onClick: () => onDelete(record.id),
          permission: 'ROLE_MANAGE',
        });

        return (
          <Space>
            <PermissionGuard module="roles" action="view">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => onView(record.id)}
              ></Button>
            </PermissionGuard>
            <ActionDropdown items={actionItems} />
          </Space>
        );
      },
    },
  ];

  return (
    <DataTable<Role>
      columns={columns}
      dataSource={data}
      loading={loading}
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
