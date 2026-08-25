import { Descriptions, Tag, Typography, Divider } from "antd";
import { DetailDrawer } from "@/shared/components";
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

export interface AuditLogDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  auditLog: AuditLog | null;
}

export function AuditLogDetailDrawer({
  open,
  onClose,
  auditLog,
}: AuditLogDetailDrawerProps) {
  if (!auditLog) return null;

  const actionLabel = businessLabel(
    AUDIT_ACTION_LABELS,
    auditLog.action,
    "Hành động khác",
  );

  return (
    <DetailDrawer
      title="Chi tiết nhật ký hệ thống"
      open={open}
      onClose={onClose}
      width={600}
    >
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Mã bản ghi">{auditLog.id}</Descriptions.Item>
        <Descriptions.Item label="Thời gian">
          {formatDateTime(auditLog.created_at)}
        </Descriptions.Item>
        <Descriptions.Item label="Hành động">
          <Tag color={ACTION_COLOR[auditLog.action] ?? "default"}>
            {actionLabel}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Phân hệ">
          {MODULE_LABELS[auditLog.module] || "Phân hệ khác"}
        </Descriptions.Item>
        <Descriptions.Item label="Đối tượng">
          Mã #{auditLog.auditable_id}
        </Descriptions.Item>
        <Descriptions.Item label="Người thực hiện">
          {auditLog.user?.email || "Không có"}
        </Descriptions.Item>
        <Descriptions.Item label="Địa chỉ IP">
          <Text copyable>{auditLog.ip_address}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Mô tả">
          {auditLog.description}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      {auditLog.old_values && (
        <>
          <Typography.Title level={5}>Dữ liệu trước thay đổi</Typography.Title>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 16,
              borderRadius: 4,
              maxHeight: 300,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {JSON.stringify(auditLog.old_values, null, 2)}
          </pre>
          <Divider />
        </>
      )}

      {auditLog.new_values && (
        <>
          <Typography.Title level={5}>Dữ liệu sau thay đổi</Typography.Title>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 16,
              borderRadius: 4,
              maxHeight: 300,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {JSON.stringify(auditLog.new_values, null, 2)}
          </pre>
        </>
      )}
    </DetailDrawer>
  );
}
