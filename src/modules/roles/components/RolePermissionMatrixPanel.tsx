import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Skeleton,
  Space,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import { SaveOutlined, UndoOutlined } from '@ant-design/icons';
import { PermissionGuard } from '@/shared/components';
import { getGroupIcon } from './role-group-icon';
import { actionLabel } from '../pages/role-permissions.helpers';
import { useRolePermissionMatrix } from '../hooks/use-role-permission-matrix';

const { Text } = Typography;

const TOOLTIP_OVERLAY_INNER_STYLE = {
  fontSize: 12,
  padding: '4px 8px',
  minHeight: 'auto',
} as const;

interface RolePermissionMatrixPanelProps {
  selectedRoleId: number | null;
}

/**
 * Ma trận quyền hạn chi tiết cho role đang được chọn ở sidebar. Component
 * "dumb" chỉ nhận `selectedRoleId`, mọi state/logic nằm trong
 * useRolePermissionMatrix.
 */
export function RolePermissionMatrixPanel({
  selectedRoleId,
}: RolePermissionMatrixPanelProps) {
  const { token } = theme.useToken();
  const {
    selectedRoleDetail,
    selectedPermissionIds,
    permissionGroups,
    canConfigMatrix,
    syncPermsMutation,
    selectedRoleTotal,
    selectedRoleChecked,
    matrixDirty,
    handlePermissionToggle,
    isGroupAllChecked,
    isGroupIndeterminate,
    handleGroupAllChange,
    handleResetMatrix,
    handleSaveMatrix,
    isLoading,
    error,
  } = useRolePermissionMatrix(selectedRoleId);

  // Hiển thị skeleton khi đang tải ma trận quyền
  if (isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 12 }} title={{ width: '40%' }} />
      </Card>
    );
  }

  // Hiển thị cảnh báo khi BE khóa ROLE_PERMISSIONS_LOCKED
  const isLockedError =
    error?.includes('ROLE_PERMISSIONS_LOCKED') || error?.includes('đã bị khóa');

  return (
    <Card
      data-testid="role-permission-matrix"
      title={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              Ma trận quyền hạn chi tiết
            </span>
            {selectedRoleDetail && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: token.colorPrimary,
                  background: token.colorPrimaryBg,
                  border: `1px solid ${token.colorPrimaryBorder}`,
                  borderRadius: 12,
                  padding: '2px 10px',
                }}
              >
                {selectedRoleChecked}/{selectedRoleTotal} quyền
              </span>
            )}
            {matrixDirty && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: token.colorWarningText,
                  background: token.colorWarningBg,
                  border: `1px solid ${token.colorWarningBorder}`,
                  borderRadius: 12,
                  padding: '2px 10px',
                }}
              >
                Chưa lưu
              </span>
            )}
          </div>
          {selectedRoleDetail && (
            <Space>
              {canConfigMatrix && (
                <Button
                  icon={<UndoOutlined />}
                  onClick={handleResetMatrix}
                  disabled={syncPermsMutation.isPending}
                  size="middle"
                  style={{ borderRadius: 6 }}
                >
                  Hoàn tác
                </Button>
              )}
              <PermissionGuard permissionCode="PERM_CONFIG">
                <Button
                  data-testid="save-matrix-btn"
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveMatrix}
                  loading={syncPermsMutation.isPending}
                  size="middle"
                  style={{ borderRadius: 6, fontWeight: 600 }}
                >
                  Lưu ma trận
                </Button>
              </PermissionGuard>
            </Space>
          )}
        </div>
      }
      variant="borderless"
      style={{
        width: '100%',
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(20,20,20,0.06)',
      }}
      styles={{ body: { padding: 16, flex: 1 } }}
    >
      {selectedRoleDetail ? (
        <div>
          <Alert
            message={
              <span>
                Đang thiết lập quyền cho vai trò:{' '}
                <Text
                  strong
                  style={{
                    color: token.colorPrimaryTextActive,
                    fontSize: 14.5,
                  }}
                >
                  {selectedRoleDetail.name}
                </Text>{' '}
                (Mã:{' '}
                <code
                  style={{
                    background: token.colorPrimaryBg,
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: `1px solid ${token.colorPrimaryBorder}`,
                    fontSize: 13,
                  }}
                >
                  {selectedRoleDetail.code}
                </code>
                ).{' '}
                {canConfigMatrix ? (
                  <>
                    Tích chọn các quyền chi tiết dưới đây và bấm{' '}
                    <strong>Lưu ma trận</strong> để cập nhật.
                  </>
                ) : (
                  <>
                    Bạn chỉ có quyền xem ma trận này (thiếu quyền{' '}
                    <code>PERM_CONFIG</code>) nên các ô quyền đang ở chế độ chỉ
                    đọc.
                  </>
                )}
              </span>
            }
            type={canConfigMatrix ? 'info' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
          />

          {isLockedError && (
            <Alert
              message="Ma trận quyền đang bị khóa"
              description={
                <span>
                  Vai trò này đang ở trạng thái{' '}
                  <strong>ROLE_PERMISSIONS_LOCKED</strong>. Bạn không thể chỉnh
                  sửa quyền cho đến khi BE mở khóa.
                </span>
              }
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {error && !isLockedError && (
            <Alert
              message="Không thể tải ma trận quyền"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <div
            style={{
              overflow: 'auto',
              maxHeight: 'calc(100vh - 340px)',
              padding: 2,
            }}
          >
            {permissionGroups.length === 0 ? (
              <Empty description="Chưa có danh mục quyền nào" />
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {permissionGroups.map(({ object, permissions }) => {
                  const allChecked = isGroupAllChecked(permissions);
                  const indeterminate = isGroupIndeterminate(permissions);
                  const checkedCount = permissions.filter((p) =>
                    selectedPermissionIds.has(p.id),
                  ).length;
                  return (
                    <div
                      key={object}
                      style={{
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: token.colorBgContainer,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          background: token.colorFillTertiary,
                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                          borderLeft:
                            checkedCount > 0
                              ? `3px solid ${token.colorPrimary}`
                              : '3px solid transparent',
                        }}
                      >
                        <Tooltip
                          title={
                            canConfigMatrix
                              ? 'Chọn/Bỏ chọn tất cả quyền trong nhóm'
                              : 'Bạn không có quyền cấu hình ma trận quyền (PERM_CONFIG)'
                          }
                          overlayInnerStyle={TOOLTIP_OVERLAY_INNER_STYLE}
                        >
                          <Checkbox
                            checked={allChecked}
                            indeterminate={indeterminate}
                            disabled={!canConfigMatrix}
                            onChange={(e) =>
                              handleGroupAllChange(
                                permissions,
                                e.target.checked,
                              )
                            }
                          />
                        </Tooltip>
                        {getGroupIcon(object, {
                          fontSize: 13,
                          color: token.colorTextTertiary,
                        })}
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13.5,
                            color: token.colorText,
                            flex: 1,
                          }}
                        >
                          {object}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: token.colorTextSecondary,
                            background: token.colorBgContainer,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            borderRadius: 10,
                            padding: '1px 9px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {checkedCount}/{permissions.length} quyền
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fill, minmax(170px, 1fr))',
                          gap: '8px 10px',
                          padding: '12px 14px',
                          overflowWrap: 'break-word',
                        }}
                      >
                        {permissions.map((p) => {
                          const checked = selectedPermissionIds.has(p.id);
                          return (
                            <Tooltip
                              key={p.id}
                              title={p.description || p.code}
                              overlayInnerStyle={TOOLTIP_OVERLAY_INNER_STYLE}
                            >
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '6px 10px',
                                  borderRadius: 7,
                                  border: `1px solid ${checked ? token.colorBorder : token.colorBorderSecondary}`,
                                  background: checked
                                    ? token.colorBgContainer
                                    : token.colorFillQuaternary,
                                  cursor: canConfigMatrix
                                    ? 'pointer'
                                    : 'not-allowed',
                                  opacity: canConfigMatrix ? 1 : 0.75,
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <Checkbox
                                  data-testid={`permission-checkbox`}
                                  data-code={p.code}
                                  checked={checked}
                                  disabled={!canConfigMatrix}
                                  onChange={(e) =>
                                    handlePermissionToggle(
                                      p,
                                      permissions,
                                      e.target.checked,
                                    )
                                  }
                                />
                                <span
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: checked ? 600 : 500,
                                    color: token.colorText,
                                  }}
                                >
                                  {actionLabel(p.action)}
                                </span>
                              </label>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 16,
            }}
          >
            <PermissionGuard permissionCode="PERM_CONFIG">
              <Button
                data-testid="save-matrix-btn"
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                onClick={handleSaveMatrix}
                loading={syncPermsMutation.isPending}
                style={{ height: 40, padding: '0 24px', fontWeight: 600 }}
              >
                Lưu ma trận quyền
              </Button>
            </PermissionGuard>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 300,
          }}
        >
          <Empty description="Vui lòng chọn một vai trò từ danh mục bên trái để cấu hình ma trận quyền." />
        </div>
      )}
    </Card>
  );
}
