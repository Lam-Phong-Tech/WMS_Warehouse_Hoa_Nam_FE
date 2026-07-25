/**
 * Permission Guard & Action Button Demo Page
 *
 * Demo page showcasing:
 * - PermissionGuard component (hide/disable modes)
 * - ActionButton component (hide/disable modes)
 * - Tooltip khi disable
 * - Row-level scope checking
 * - Real scope from auth context
 */

import { useState } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  Table,
  Tag,
  Divider,
  Alert,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  CheckOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { PermissionGuard, ActionButton } from '@/shared/components/permission';
import {
  canAction,
  hasScopeForAction,
  type ScopeType,
} from '@/shared/types/permission.scope';
import { usePermissionState } from '@/shared/components/permission';

const { Title, Paragraph, Text } = Typography;

const mockTableData = [
  {
    key: '1',
    name: 'Org Unit A',
    code: 'ORG-001',
    scope: 'co_so' as ScopeType,
  },
  {
    key: '2',
    name: 'Org Unit B',
    code: 'ORG-002',
    scope: 'phong_ban' as ScopeType,
  },
  {
    key: '3',
    name: 'Org Unit C',
    code: 'ORG-003',
    scope: 'he_thong' as ScopeType,
  },
];

export function PermissionDemoPage() {
  // State local để simulate scope change (cho demo purposes)
  const [simulatedScope, setSimulatedScope] = useState<ScopeType>('co_so');
  const {
    permissionCodes,
    isSuperAdmin,
    currentScopeType: realScope,
  } = usePermissionState();

  // LƯU Ý: simulatedScope/effectiveScope/effectivePermissions CHỈ được dùng
  // trong tab "Row-level Scope" (bảng mock data gọi trực tiếp canAction()/
  // hasScopeForAction()). Các tab khác (PermissionGuard/ActionButton) đọc
  // currentScopeType THẬT từ auth context — đổi dropdown ở đây không ảnh
  // hưởng tới chúng.
  const effectiveScope = simulatedScope;
  // ORG_INACTIVE là mã thật của BE cho action "delete" (org_units.delete),
  // KHÔNG có mã ORG_DELETE trong catalog — xem PERMISSION_RULES.org_units.
  const effectivePermissions = isSuperAdmin
    ? ['ORG_EDIT', 'ORG_INACTIVE', ...permissionCodes]
    : permissionCodes;

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Permission Guard & Action Button Demo</Title>
      <Paragraph>
        Trang demo showcase các tính năng của PermissionGuard và ActionButton,
        bao gồm 2 mode (hide/disable), tooltip chuẩn, và row-level scope
        checking.
      </Paragraph>

      {/* Hiển thị thông tin context hiện tại */}
      <Alert
        message="Auth Context Information"
        description={
          <Space direction="vertical" size="small">
            <Text>
              <strong>Real Scope (from auth):</strong>{' '}
              <Tag color="blue">{realScope || 'null'}</Tag>
            </Text>
            <Text>
              <strong>Is Super Admin:</strong>{' '}
              <Tag color={isSuperAdmin ? 'green' : 'red'}>
                {isSuperAdmin ? 'Yes' : 'No'}
              </Tag>
            </Text>
            <Text>
              <strong>Simulated Scope (for demo):</strong>{' '}
              <Tag color="orange">{effectiveScope}</Tag>
            </Text>
            <Text>
              <strong>Permissions count:</strong> {permissionCodes.length}
            </Text>
          </Space>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Alert
        message="Lưu ý"
        description={
          <>
            Các button/component ở các tab 1–4, 6, 7 phản ứng theo quyền của
            user hiện tại và <strong>scope THẬT</strong> từ active context (
            <Text code>currentScopeType</Text>).{' '}
            <strong>
              Simulated scope chỉ áp dụng cho tab "Row-level Scope"
            </strong>{' '}
            — đổi dropdown ở tab đó KHÔNG làm thay đổi hành vi của
            PermissionGuard/ActionButton ở các tab khác.
            {isSuperAdmin && (
              <Text type="warning" style={{ display: 'block', marginTop: 8 }}>
                ⚠️ Super admin bypass scope check - tất cả actions đều hiển thị
                bất kể scope.
              </Text>
            )}
          </>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Tabs
        items={[
          {
            key: '1',
            label: 'PermissionGuard - Hide',
            children: (
              <Card title="PermissionGuard - Hide Mode" size="small">
                <Space>
                  <Text>Khi không có quyền, button sẽ bị ẩn hoàn toàn:</Text>
                  <PermissionGuard
                    module="org_units"
                    action="create"
                    mode="hide"
                  >
                    <Button type="primary" icon={<PlusOutlined />}>
                      Thêm mới (có quyền)
                    </Button>
                  </PermissionGuard>
                  <PermissionGuard
                    module="org_units"
                    action="delete"
                    mode="hide"
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      Xóa (có quyền)
                    </Button>
                  </PermissionGuard>
                </Space>
                <Divider />
                <Text type="secondary">
                  Nếu user không có quyền ORG_CREATE/ORG_DELETE, các button trên
                  sẽ không render.
                </Text>
              </Card>
            ),
          },
          {
            key: '2',
            label: 'PermissionGuard - Disable',
            children: (
              <Card title="PermissionGuard - Disable Mode" size="small">
                <Space>
                  <Text>
                    Khi không có quyền, button sẽ bị disable với tooltip:
                  </Text>
                  <PermissionGuard
                    module="org_units"
                    action="edit"
                    mode="disable"
                  >
                    <Button icon={<EditOutlined />}>Sửa (có quyền)</Button>
                  </PermissionGuard>
                  <PermissionGuard
                    module="org_units"
                    action="approve"
                    mode="disable"
                  >
                    <Button icon={<CheckOutlined />}>Duyệt (có quyền)</Button>
                  </PermissionGuard>
                </Space>
                <Divider />
                <Text type="secondary">
                  Nếu user không có quyền, button sẽ bị disable với tooltip mặc
                  định: "Bạn không có quyền thực hiện thao tác này"
                </Text>
              </Card>
            ),
          },
          {
            key: '3',
            label: 'ActionButton - Hide',
            children: (
              <Card title="ActionButton - Hide Mode" size="small">
                <Space>
                  <ActionButton module="org_units" action="create" mode="hide">
                    Thêm mới
                  </ActionButton>
                  <ActionButton module="org_units" action="export" mode="hide">
                    Xuất Excel
                  </ActionButton>
                </Space>
              </Card>
            ),
          },
          {
            key: '4',
            label: 'ActionButton - Disable',
            children: (
              <Card
                title="ActionButton - Disable Mode + Custom Tooltip"
                size="small"
              >
                <Space>
                  <ActionButton
                    module="org_units"
                    action="edit"
                    mode="disable"
                    disabledTooltip="Chỉ admin mới có quyền sửa"
                  >
                    Sửa
                  </ActionButton>
                  <ActionButton
                    module="org_units"
                    action="delete"
                    mode="disable"
                    disabledTooltip="Cần quyền xóa vĩnh viễn"
                  >
                    Xóa vĩnh viễn
                  </ActionButton>
                </Space>
              </Card>
            ),
          },
          {
            key: '5',
            label: 'Row-level Scope',
            children: (
              <Card
                title="Row-level Scope Demo"
                size="small"
                extra={
                  <Space>
                    <Text>Giả lập context scope:</Text>
                    <select
                      value={simulatedScope}
                      onChange={(e) =>
                        setSimulatedScope(e.target.value as ScopeType)
                      }
                      style={{ padding: '4px 8px' }}
                    >
                      <option value="he_thong">Hệ thống</option>
                      <option value="co_so">Cơ sở</option>
                      <option value="phong_ban">Phòng ban</option>
                      <option value="kho">Kho</option>
                    </select>
                  </Space>
                }
              >
                <Alert
                  message="Row-level scope dùng canAction(record, action, module, permissions)"
                  description={
                    <>
                      Khác với PermissionGuard/ActionButton ở các tab khác (chỉ
                      xét scope của context đang active —{' '}
                      <Text code>currentScopeType</Text> từ AuthContext), bảng
                      dưới đây gọi trực tiếp <Text code>canAction()</Text> /{' '}
                      <Text code>hasScopeForAction()</Text> với{' '}
                      <Text code>simulatedScope</Text> (dropdown bên trên) trên
                      trường <Text code>scope</Text> của TỪNG dòng mock data.{' '}
                      <Text strong>
                        Simulated scope CHỈ áp dụng cho tab này
                      </Text>
                      ; đổi dropdown không làm thay đổi hành vi của các tab
                      PermissionGuard/ActionButton khác — những tab đó vẫn dùng
                      active context thật. VD: Sửa/Xóa Org Unit cần scope dòng ≥
                      'co_so' — dòng có scope 'phong_ban' sẽ không cho phép dù
                      user có permission code.
                    </>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Table
                  columns={[
                    { title: 'Name', dataIndex: 'name', key: 'name' },
                    { title: 'Code', dataIndex: 'code', key: 'code' },
                    {
                      title: 'Scope (của row)',
                      dataIndex: 'scope',
                      key: 'scope',
                      render: (scope: ScopeType) => (
                        <Tag color="blue">{scope}</Tag>
                      ),
                    },
                    {
                      title: 'Context scope (giả lập)',
                      key: 'contextCheck',
                      render: () => {
                        const contextPassesEdit = hasScopeForAction(
                          effectiveScope,
                          'org_units',
                          'edit',
                          isSuperAdmin,
                        );
                        return (
                          <Tag color={contextPassesEdit ? 'green' : 'red'}>
                            {contextPassesEdit
                              ? 'Đủ scope (edit)'
                              : 'Thiếu scope (edit)'}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: 'Actions (row-level)',
                      key: 'actions',
                      render: (_, record) => {
                        const canEditRow = canAction(
                          record,
                          'edit',
                          'org_units',
                          effectivePermissions,
                          isSuperAdmin,
                        );
                        const canDeleteRow = canAction(
                          record,
                          'delete',
                          'org_units',
                          effectivePermissions,
                          isSuperAdmin,
                        );
                        return (
                          <Space>
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              disabled={!canEditRow}
                              title={
                                canEditRow
                                  ? undefined
                                  : 'Scope của dòng này không đủ để sửa'
                              }
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              disabled={!canDeleteRow}
                              title={
                                canDeleteRow
                                  ? undefined
                                  : 'Scope của dòng này không đủ để xóa'
                              }
                            >
                              Delete
                            </Button>
                          </Space>
                        );
                      },
                    },
                  ]}
                  dataSource={mockTableData}
                  pagination={false}
                  size="small"
                />
              </Card>
            ),
          },
          {
            key: '6',
            label: 'Custom Permission',
            children: (
              <Card title="Custom Permission Code" size="small">
                <Space>
                  <Text>
                    Dùng permissionCode trực tiếp (không kiểm tra scope):
                  </Text>
                  <PermissionGuard
                    permissionCode="ORG_FORCE_DELETE"
                    mode="hide"
                  >
                    <Button danger>Xóa vĩnh viễn</Button>
                  </PermissionGuard>
                  <PermissionGuard
                    permissionCode="SPECIAL_ACTION"
                    mode="disable"
                  >
                    <Button>Special Action</Button>
                  </PermissionGuard>
                </Space>
              </Card>
            ),
          },
          {
            key: '7',
            label: 'All Actions',
            children: (
              <Card title="All Standard Actions" size="small">
                <Space wrap>
                  <ActionButton
                    module="org_units"
                    action="view"
                    mode="hide"
                    icon={<EyeOutlined />}
                  >
                    View
                  </ActionButton>
                  <ActionButton
                    module="org_units"
                    action="create"
                    mode="hide"
                    type="primary"
                    icon={<PlusOutlined />}
                  >
                    Create
                  </ActionButton>
                  <ActionButton
                    module="org_units"
                    action="edit"
                    mode="hide"
                    icon={<EditOutlined />}
                  >
                    Edit
                  </ActionButton>
                  <ActionButton
                    module="org_units"
                    action="delete"
                    mode="hide"
                    danger
                    icon={<DeleteOutlined />}
                  >
                    Delete
                  </ActionButton>
                  <ActionButton
                    module="org_units"
                    action="approve"
                    mode="hide"
                    icon={<CheckOutlined />}
                  >
                    Approve
                  </ActionButton>
                  <ActionButton
                    module="org_units"
                    action="export"
                    mode="hide"
                    icon={<ExportOutlined />}
                  >
                    Export
                  </ActionButton>
                </Space>
              </Card>
            ),
          },
        ]}
      />

      <Divider />

      <Card title="Usage Examples" size="small">
        <Title level={5}>1. PermissionGuard - Hide Mode</Title>
        <Card type="inner" size="small">
          <pre
            style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}
          >{`<PermissionGuard module="org_units" action="create" mode="hide">
  <Button type="primary">Thêm mới</Button>
</PermissionGuard>`}</pre>
        </Card>

        <Title level={5} style={{ marginTop: 16 }}>
          2. PermissionGuard - Disable Mode
        </Title>
        <Card type="inner" size="small">
          <pre
            style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}
          >{`<PermissionGuard module="org_units" action="edit" mode="disable">
  <Button>Sửa</Button>
</PermissionGuard>`}</pre>
        </Card>

        <Title level={5} style={{ marginTop: 16 }}>
          3. ActionButton - Hide Mode
        </Title>
        <Card type="inner" size="small">
          <pre
            style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}
          >{`<ActionButton module="org_units" action="create" mode="hide">
  Thêm mới
</ActionButton>`}</pre>
        </Card>

        <Title level={5} style={{ marginTop: 16 }}>
          4. ActionButton - Disable Mode + Custom Tooltip
        </Title>
        <Card type="inner" size="small">
          <pre
            style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}
          >{`<ActionButton
  module="org_units"
  action="delete"
  mode="disable"
  disabledTooltip="Cần quyền xóa vĩnh viễn"
>
  Xóa vĩnh viễn
</ActionButton>`}</pre>
        </Card>

        <Title level={5} style={{ marginTop: 16 }}>
          5. Custom Permission Code
        </Title>
        <Card type="inner" size="small">
          <pre
            style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}
          >{`<PermissionGuard permissionCode="ORG_FORCE_DELETE" mode="hide">
  <Button danger>Xóa vĩnh viễn</Button>
</PermissionGuard>`}</pre>
        </Card>

        <Title level={5} style={{ marginTop: 16 }}>
          6. Row-level Scope with canAction()
        </Title>
        <Card type="inner" size="small">
          <pre
            style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}
          >{`import { canAction } from '@/shared/components/permission';

const canEdit = canAction(record, 'edit', 'org_units', userPermissions);
if (canEdit) {
  // Show edit button
}`}</pre>
        </Card>
      </Card>
    </div>
  );
}
