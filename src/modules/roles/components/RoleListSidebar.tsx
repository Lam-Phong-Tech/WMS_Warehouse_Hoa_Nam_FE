import { Button, Card, Empty, Input, Space, Tooltip, theme } from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { PermissionGuard } from '@/shared/components';
import {
  ConfirmButton,
  LoadingState,
  StatusBadge,
  PageSizeSelector,
  TopPagination,
} from '@/shared/components';
import type { Role } from '../types/roles.types';

const TOOLTIP_OVERLAY_INNER_STYLE = {
  fontSize: 12,
  padding: '4px 8px',
  minHeight: 'auto',
} as const;

interface RoleListSidebarProps {
  roles: Role[];
  rolesTotal: number;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  page: number;
  perPage: number;
  onPageChange: (page: number, pageSize: number) => void;
  selectedRoleId: number | null;
  onSelectRole: (id: number) => void;
  getUserCount: (roleId: number) => number | undefined;
  onCreate: () => void;
  onEdit: (role: Role) => void;
  onDelete: (id: number) => void;
  deletePendingId?: number;
}

/** Sidebar CRUD/list role bên trái trang Vai trò & Quyền. */
export function RoleListSidebar({
  roles,
  rolesTotal,
  isLoading,
  searchQuery,
  onSearchChange,
  page,
  perPage,
  onPageChange,
  selectedRoleId,
  onSelectRole,
  getUserCount,
  onCreate,
  onEdit,
  onDelete,
  deletePendingId,
}: RoleListSidebarProps) {
  const { token } = theme.useToken();

  return (
    <Card
      title={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            Danh sách vai trò
          </span>
          <Space>
            <PermissionGuard module="roles" action="create">
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={onCreate}
                style={{ borderRadius: 6, fontWeight: 600 }}
              >
                Thêm
              </Button>
            </PermissionGuard>
          </Space>
        </div>
      }
      variant="borderless"
      style={{
        width: '100%',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(20,20,20,0.06)',
        overflow: 'hidden',
      }}
      styles={{ body: { padding: 0 } }}
    >
      <div
        style={{
          padding: 12,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <Input
          placeholder="Tìm vai trò..."
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          style={{ height: 36, borderRadius: 8 }}
        />
      </div>

      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          justifyContent: 'flex-start',
        }}
      >
        <PageSizeSelector
          current={page}
          pageSize={perPage}
          pageSizeOptions={[15, 20, 50, 100]}
          onChange={onPageChange}
        />
      </div>

      <div style={{ maxHeight: 'calc(100vh - 440px)', overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 24 }}>
            <LoadingState tip="Đang tải..." minHeight={120} />
          </div>
        ) : roles.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Không tìm thấy vai trò"
            />
          </div>
        ) : (
          roles.map((role) => {
            const isActive = role.id === selectedRoleId;
            return (
              <div
                key={role.id}
                data-testid="role-row"
                data-role-id={role.id}
                onClick={() => onSelectRole(role.id)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: isActive ? token.colorPrimaryBg : 'transparent',
                  borderLeft: isActive
                    ? `3px solid ${token.colorPrimary}`
                    : '3px solid transparent',
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  transition: 'background 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <span
                      title={role.name}
                      style={{
                        fontWeight: isActive ? 700 : 600,
                        color: isActive
                          ? token.colorPrimaryTextActive
                          : token.colorText,
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      {role.name}
                    </span>
                    <div>
                      <StatusBadge active={role.status === 1} />
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: token.colorTextDescription,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      minWidth: 0,
                    }}
                  >
                    <code
                      style={{
                        background: token.colorFillTertiary,
                        padding: '1px 6px',
                        borderRadius: 3,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {role.code}
                    </code>
                    <span style={{ flexShrink: 0 }}>·</span>
                    <span
                      title={
                        getUserCount(role.id) === undefined
                          ? 'Đang tải số nhân viên...'
                          : `${getUserCount(role.id)} nhân viên`
                      }
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      {getUserCount(role.id) === undefined
                        ? '— nhân viên'
                        : `${getUserCount(role.id)} nhân viên`}
                    </span>
                  </span>
                </div>

                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <PermissionGuard module="roles" action="edit">
                    <Tooltip
                      title={
                        role.is_super_admin
                          ? 'Vai trò hệ thống không được phép sửa'
                          : `Sửa vai trò "${role.name}"`
                      }
                      overlayInnerStyle={TOOLTIP_OVERLAY_INNER_STYLE}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        disabled={role.is_super_admin}
                        onClick={() => onEdit(role)}
                        aria-label={`Sửa vai trò "${role.name}"`}
                        style={{ paddingInline: 8 }}
                      ></Button>
                    </Tooltip>
                  </PermissionGuard>
                  <PermissionGuard module="roles" action="delete">
                    <Tooltip
                      title={
                        role.is_super_admin
                          ? 'Vai trò hệ thống không được phép vô hiệu hóa'
                          : `Vô hiệu hóa vai trò "${role.name}"`
                      }
                      overlayInnerStyle={TOOLTIP_OVERLAY_INNER_STYLE}
                    >
                      <ConfirmButton
                        type="text"
                        size="small"
                        danger
                        icon={<StopOutlined />}
                        disabled={role.is_super_admin}
                        title={`Vô hiệu hóa vai trò "${role.name}"?`}
                        description={`Vai trò "${role.name}" sẽ bị vô hiệu hóa. ${getUserCount(role.id) ?? 0} người dùng đang được gán vai trò này sẽ bị ảnh hưởng.`}
                        aria-label={`Vô hiệu hóa vai trò "${role.name}"`}
                        onConfirm={() => onDelete(role.id)}
                        loading={deletePendingId === role.id}
                        style={{ paddingInline: 8 }}
                      >
                        {null}
                      </ConfirmButton>
                    </Tooltip>
                  </PermissionGuard>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        style={{
          padding: '8px 12px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <TopPagination
          total={rolesTotal}
          current={page}
          pageSize={perPage}
          unitName="vai trò"
          onChange={onPageChange}
          placement="bottom"
          showSizeChanger={false}
        />
      </div>
    </Card>
  );
}
