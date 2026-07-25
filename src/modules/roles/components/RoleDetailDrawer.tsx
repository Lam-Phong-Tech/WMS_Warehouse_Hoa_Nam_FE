import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { groupBy } from 'lodash-es';
import { StatusBadge } from '@/shared/components';
import { formatDateTime } from '@/shared/utils/format-date';
import type { Role } from '@/modules/roles/types/roles.types';

interface Props {
  open: boolean;
  role: Role | undefined | null;
  isLoading: boolean;
  onClose: () => void;
  /** Mở modal phân quyền cho vai trò đang xem. */
  onEditPermissions?: (role: Role) => void;
}

const dash = (v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : String(v);

/** Drawer xem đầy đủ thông tin một vai trò và các quyền hạn. */
export function RoleDetailDrawer({
  open,
  role,
  isLoading,
  onClose,
  onEditPermissions,
}: Props) {
  const permissionsByObject = groupBy(role?.permissions ?? [], 'object');

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={640}
      title={role ? `Chi tiết vai trò: ${role.name}` : 'Chi tiết vai trò'}
      destroyOnClose
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Spin size="large" />
        </div>
      ) : !role ? (
        <Empty description="Không tìm thấy thông tin vai trò." />
      ) : (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Tên vai trò">
              {dash(role.name)}
            </Descriptions.Item>
            <Descriptions.Item label="Mã">
              <Tag>{dash(role.code)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Mô tả">
              {dash(role.description)}
            </Descriptions.Item>
            <Descriptions.Item label="Loại">
              {role.type === 'co_dinh' ? 'Cố định' : 'Tùy chỉnh'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <StatusBadge active={role.status === 1} />
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">
              {formatDateTime(role.created_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Cập nhật lần cuối">
              {formatDateTime(role.updated_at)}
            </Descriptions.Item>
          </Descriptions>

          <Flex
            align="center"
            justify="space-between"
            style={{ marginTop: 24, marginBottom: 4 }}
          >
            <Typography.Title level={5} style={{ margin: 0 }}>
              Các quyền hạn
            </Typography.Title>
            {onEditPermissions && !role.is_super_admin && (
              <Button
                size="small"
                icon={<KeyOutlined />}
                onClick={() => onEditPermissions(role)}
              >
                Phân quyền
              </Button>
            )}
          </Flex>

          {Object.entries(permissionsByObject).map(([object, perms]) => (
            <Descriptions
              key={object}
              title={object}
              column={1}
              size="small"
              bordered
              style={{ marginTop: 16 }}
            >
              {perms.map((p) => (
                <Descriptions.Item key={p.id} label={p.description}>
                  <Tag color="purple">{p.code}</Tag>
                </Descriptions.Item>
              ))}
            </Descriptions>
          ))}

          {Object.keys(permissionsByObject).length === 0 && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Vai trò này chưa được gán quyền nào."
            />
          )}
        </>
      )}
    </Drawer>
  );
}
