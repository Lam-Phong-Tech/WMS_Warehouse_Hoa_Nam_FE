import { Button, Space, Typography, Tag } from "antd";
import { EyeOutlined } from "@/shared/components/icons";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import { DataTable, TopPagination } from "@/shared/components";
import type { ColumnWithSortType } from "@/shared/components";
import type { AuditLog } from "../types/audit-logs.types";
import { formatDateTime } from "@/shared/utils/format-date";
import {
  AUDIT_ACTION_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";

const { Text } = Typography;

const ACTION_COLOR: Record<string, string> = {
  CREATE: "green",
  UPDATE: "blue",
  DELETE: "red",
  REVOKE_ROLE_SCOPE: "orange",
  SYNC_ROLE_SCOPES: "purple",
  SUBMIT: "cyan",
  CANCEL: "magenta",
  ARCHIVE: "gray",
  RESTORE: "lime",
};

const MODULE_LABELS: Record<string, string> = {
  Employees: "Nhân sự",
  User: "Người dùng",
  order: "Đơn hàng",
  OrgUnits: "Đơn vị",
  Departments: "Phòng ban",
  Roles: "Vai trò",
  Warehouse: "Kho",
  Inventory: "Tồn kho",
  Warranty: "Bảo hành",
  Auth: "Tài khoản & đăng nhập",
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
  onSortChange?: (field?: string, order?: "asc" | "desc") => void;
}

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
      title: "Thời gian",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      sorter: true,
      render: (created_at: string) => <Text>{formatDateTime(created_at)}</Text>,
    },
    {
      title: "Hành động",
      dataIndex: "action",
      key: "action",
      width: 190,
      render: (action: string) => (
        <Tag color={ACTION_COLOR[action] ?? "default"}>
          {businessLabel(AUDIT_ACTION_LABELS, action, "Hành động khác")}
        </Tag>
      ),
    },
    {
      title: "Phân hệ",
      dataIndex: "module",
      key: "module",
      width: 160,
      render: (module: string) => (
        <Text>{MODULE_LABELS[module] || "Phân hệ khác"}</Text>
      ),
    },
    {
      title: "Đối tượng",
      dataIndex: "auditable_type",
      key: "auditable_type",
      width: 180,
      render: (_auditableType: string, record: AuditLog) => (
        <Text>Mã #{record.auditable_id}</Text>
      ),
    },
    {
      title: "Người thực hiện",
      dataIndex: "user",
      key: "user_email",
      width: 200,
      render: (user: AuditLog["user"]) => (
        <Text copyable>{user?.email || "Không có"}</Text>
      ),
    },
    {
      title: "Địa chỉ IP",
      dataIndex: "ip_address",
      key: "ip_address",
      width: 140,
      render: (ip_address: string) => <Text copyable>{ip_address}</Text>,
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (description: string) => <Text ellipsis>{description}</Text>,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      align: "right",
      render: (_, record) => (
        <Space>
          {onView && (
            <Button
              size="small"
              icon={
                <EyeOutlined style={{ color: ACTION_ICON_COLORS.view }} />
              }
              aria-label="Xem chi tiết nhật ký"
              onClick={() => onView(record)}
            />
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
          pageSizeOptions={[10, 20, 50]}
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
            s?.order === "ascend"
              ? "asc"
              : s?.order === "descend"
                ? "desc"
                : undefined;
          onSortChange(field, order);
        }}
      />
    </>
  );
}
