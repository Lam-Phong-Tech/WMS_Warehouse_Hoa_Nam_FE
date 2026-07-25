import { Descriptions, Tag, Typography, Divider } from 'antd';
import { DetailDrawer } from '@/shared/components';
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

export interface AuditLogDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  auditLog: AuditLog | null;
}

/**
 * Drawer hiển thị chi tiết audit log entry
 * Hiển thị thông tin cơ bản và old_values/new_values
 */
export function AuditLogDetailDrawer({
  open,
  onClose,
  auditLog,
}: AuditLogDetailDrawerProps) {
  if (!auditLog) return null;

  const actionConfig = ACTION_CONFIG[auditLog.action] || {
    color: 'default',
    label: auditLog.action,
  };

  return (
    <DetailDrawer
      title="Chi tiết nhật ký kiểm tra"
      open={open}
      onClose={onClose}
      width={600}
    >
      <Descriptions column={1} bordered>
        <Descriptions.Item label="ID">{auditLog.id}</Descriptions.Item>
        <Descriptions.Item label="Thời gian">
          {formatDateTime(auditLog.created_at)}
        </Descriptions.Item>
        <Descriptions.Item label="Hành động">
          <Tag color={actionConfig.color}>{actionConfig.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Module">
          {MODULE_LABELS[auditLog.module] || auditLog.module}
        </Descriptions.Item>
        <Descriptions.Item label="Đối tượng">
          {auditLog.auditable_type} #{auditLog.auditable_id}
        </Descriptions.Item>
        <Descriptions.Item label="Người thực hiện">
          {auditLog.user?.email || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="IP Address">
          <Text copyable>{auditLog.ip_address}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Mô tả">
          {auditLog.description}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      {/* Hiển thị old_values nếu có */}
      {auditLog.old_values && (
        <>
          <Typography.Title level={5}>Dữ liệu trước thay đổi</Typography.Title>
          <pre
            style={{
              background: '#f5f5f5',
              padding: 16,
              borderRadius: 4,
              maxHeight: 300,
              overflow: 'auto',
              fontSize: 12,
            }}
          >
            {JSON.stringify(auditLog.old_values, null, 2)}
          </pre>
          <Divider />
        </>
      )}

      {/* Hiển thị new_values nếu có */}
      {auditLog.new_values && (
        <>
          <Typography.Title level={5}>Dữ liệu sau thay đổi</Typography.Title>
          <pre
            style={{
              background: '#f5f5f5',
              padding: 16,
              borderRadius: 4,
              maxHeight: 300,
              overflow: 'auto',
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
