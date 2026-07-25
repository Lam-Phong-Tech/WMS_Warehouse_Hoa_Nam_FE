import { Button, Space, Typography } from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import {
  DataTable,
  StatusBadge,
  ActionDropdown,
  TopPagination,
  PageSizeSelector,
} from '@/shared/components';
import type { ActionItem, ColumnWithSortType } from '@/shared/components';
import type { Position } from '@/modules/positions/types/positions.types';

const { Text } = Typography;

/** Map columnKey (FE) → tên trường thực tế backend mong đợi ở sort_by. */
const SORT_FIELD_MAP: Record<string, string> = {
  code: 'code',
  name: 'name',
  grade: 'grade',
  active: 'status',
};

export interface PositionsTableProps {
  data: Position[];
  loading?: boolean;
  /** Id đang vô hiệu (để hiện loading trên đúng dòng). */
  inactivatingId?: number;
  /** Id đang khôi phục (để hiện loading trên đúng dòng). */
  restoringId?: number;
  onView?: (position: Position) => void;
  onEdit: (position: Position) => void;
  onInactive: (id: number) => void;
  onRestore?: (id: number) => void;
  page?: number;
  perPage?: number;
  total?: number;
  onPaginationChange?: (page: number, pageSize: number) => void;
  /** Danh sách khóa đang được chọn để xóa hàng loạt. */
  selectedRowKeys?: React.Key[];
  /** Callback khi thay đổi danh sách chọn. */
  onSelectionChange?: (
    selectedRowKeys: React.Key[],
    selectedRows: Position[],
  ) => void;
  /** Sắp xếp server-side (chỉ áp dụng cột trực tiếp trên positions). */
  onSortChange?: (field?: string, order?: 'asc' | 'desc') => void;
}

/** Bảng danh sách chức vụ + thao tác sửa/xóa (gating theo quyền). */
export function PositionsTable({
  data,
  loading,
  inactivatingId,
  restoringId,
  onView,
  onEdit,
  onInactive,
  onRestore,
  page = 1,
  perPage = 15,
  total = 0,
  onPaginationChange,
  selectedRowKeys,
  onSelectionChange,
  onSortChange,
}: PositionsTableProps) {
  const columns: ColumnWithSortType<Position> = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      sorter: true,
    },
    {
      title: 'Tên chức danh',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'grade',
      key: 'grade',
      width: 200,
      sorter: true,
      render: (grade: string) => <Text strong>{grade}</Text>,
    },
    {
      title: 'Số NV',
      key: 'count',
      width: 90,
      // Số nhân sự được lấy từ BE (trường employeeCount đã được map từ employees_count)
      // không có trường tương ứng ở backend để sort, không bật sorter cho cột này.
      render: (_, record) => record.employeeCount ?? 0,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'active',
      key: 'active',
      width: 140,
      sortType: 'value' as const,
      sorter: true,
      render: (active: boolean) => (
        <StatusBadge active={active} inactiveLabel="Vô hiệu" />
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 170,
      align: 'right',
      render: (_, record) => {
        const items: ActionItem[] = [];
        items.push({
          key: 'edit',
          icon: <EditOutlined />,
          label: 'Sửa',
          onClick: () => onEdit(record),
          module: 'positions',
          action: 'edit',
        });
        if (record.active) {
          items.push({
            key: 'softDelete',
            icon: <DeleteOutlined />,
            label: 'Vô hiệu hóa',
            danger: true,
            disabled: !record.active,
            loading: inactivatingId === record.id,
            onClick: () => onInactive(record.id),
            module: 'positions',
            action: 'delete',
          });
        } else {
          items.push({
            key: 'restore',
            icon: <RollbackOutlined />,
            label: 'Khôi phục',
            loading: restoringId === record.id,
            onClick: () => onRestore?.(record.id),
            module: 'positions',
            action: 'restore',
          });
        }
        return (
          <Space>
            {onView && (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => onView(record)}
              ></Button>
            )}
            <ActionDropdown items={items} />
          </Space>
        );
      },
    },
  ];

  return (
    <>
      {onPaginationChange && (
        <div style={{ marginBottom: 12 }}>
          <PageSizeSelector
            current={page}
            pageSize={perPage}
            pageSizeOptions={[10, 15, 20, 50, 100]}
            onChange={onPaginationChange}
          />
        </div>
      )}
      <DataTable<Position>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
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
      {onPaginationChange && (
        <TopPagination
          total={total}
          current={page}
          pageSize={perPage}
          unitName="chức vụ"
          pageSizeOptions={[10, 15, 20, 50, 100]}
          onChange={onPaginationChange}
          placement="bottom"
          showSizeChanger={false}
        />
      )}
    </>
  );
}
