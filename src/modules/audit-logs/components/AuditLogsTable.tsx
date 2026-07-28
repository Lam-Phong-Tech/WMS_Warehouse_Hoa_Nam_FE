import { Button, Space, Typography, Tag } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { DataTable, TopPagination } from '@/shared/components';
import type { ColumnWithSortType } from '@/shared/components';
import type { AuditLog } from '../types/audit-logs.types';
import { formatDateTime } from '@/shared/utils/format-date';

const { Text } = Typography;

/**
 * Mapping action sang màu và nhãn hiển thị
 */
const ACTION_CONFIG: Record<string, { color: string; label: string }> = {
  CREATE: { color: 'green', label: 'Tạo mới' },
  UPDATE: { color: 'blue', label: 'Cập nhật' },
  DELETE: { color: 'red', label: 'Xóa' },
  REVOKE_ROLE_SCOPE: { color: 'orange', label: 'Thu hồi quyền' },
  SYNC_ROLE_SCOPES: { color: 'purple', label: 'Đồng bộ quyền' },
  SUBMIT: { color: 'cyan', label: 'Nộp' },
  CANCEL: { color: 'magenta', label: 'Hủy' },
  ARCHIVE: { color: 'gray', label: 'Lưu trữ' },
  RESTORE: { color: 'lime', label: 'Khôi phục' },
};

/**
 * Mapping module sang nhãn hiển thị
 */
const MODULE_LABELS: Record<string, string> = {
  Employees: 'Nhân sự',
  User: 'Người dùng',
  order: 'Đơn hàng',
  OrgUnits: 'Đơn vị',
  Departments: 'Phòng ban',
  Roles: 'Vai trò',
};

export interface AuditLogsTableProps {
  data: AuditLog[];
  loading?: boolean;
  onView?: (auditLog: AuditLog) => void;
  page?: number;
  perPage?: number;
  total?: number;
  onPaginationChange?: (page: number, pageSize: number) => void;
  /** Sắp xếp server-side (chỉ áp dụng cột trực tiếp: thời gian). */
  onSortChange?: (field?: string, order?: 'asc' | 'desc') => void;
}

/** Bảng danh sách audit logs */
export function AuditLogsTable({
  data,
  loading,
  onView,
  page = 1,
  perPage = 15,
  total = 0,
  onPaginationChange,
  onSortChange,
}: AuditLogsTableProps) {
  const columns: ColumnWithSortType<AuditLog> = [
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: true,
      render: (created_at: string) => <Text>{formatDateTime(created_at)}</Text>,
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action: string) => {
        const config = ACTION_CONFIG[action] || {
          color: 'default',
          label: action,
        };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Module',
      dataIndex: 'module',
      key: 'module',
      width: 120,
      render: (module: string) => (
        <Text>{MODULE_LABELS[module] || module}</Text>
      ),
    },
    {
      title: 'Đối tượng',
      dataIndex: 'auditable_type',
      key: 'auditable_type',
      width: 180,
      render: (auditable_type: string, record: AuditLog) => (
        <Text>
          {auditable_type} #{record.auditable_id}
        </Text>
      ),
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'user',
      key: 'user_email',
      width: 200,
      render: (user: AuditLog['user']) => (
        <Text copyable>{user?.email || 'N/A'}</Text>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140,
      render: (ip_address: string) => <Text copyable>{ip_address}</Text>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (description: string) => <Text ellipsis>{description}</Text>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <Space>
          {onView && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onView(record)}
            ></Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {onPaginationChange && (
        <TopPagination
          total={total}
          current={page}
          pageSize={perPage}
          unitName="bản ghi"
          pageSizeOptions={[10, 15, 20, 50, 100]}
          onChange={onPaginationChange}
        />
      )}
      <DataTable<AuditLog>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        rowKey="id"
        onChange={(_pagination, _filters, sorter) => {
          if (!onSortChange) return;
          const s = Array.isArray(sorter) ? sorter[0] : sorter;
          const field = s?.order ? (s.field as string) : undefined;
          const order =
            s?.order === 'ascend'
              ? 'asc'
              : s?.order === 'descend'
                ? 'desc'
                : undefined;
          onSortChange(field, order);
        }}
      />
    </>
  );
}
