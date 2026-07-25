import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  DatePicker,
} from 'antd';
import { toast } from 'sonner';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  userRoleScopesService,
  getScopeTypeLabel,
  getScopeDisplayName,
} from '../services/user-role-scopes.service';
import { useUsers } from '@/modules/users/hooks/use-users';
import { ScopeSelector } from './ScopeSelector';
import { PermissionGuard, ApiErrorAlert } from '@/shared/components';
import { getMutationErrorMessage } from '@/shared/api/api-error';
import { warehousesService } from '@/modules/warehouses/services/warehouses.service';
import { formatDateTime } from '@/shared/utils/format-date';

const { Text } = Typography;

interface Props {
  userId?: number;
  userName?: string;
}

export function UserDataScopesTable({
  userId: userIdProp,
  userName: userNameProp,
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUserId, setFilterUserId] = useState<number | undefined>();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Cho phép tự chọn user khi component được nhúng ở màn hình không gắn với
  // 1 user cụ thể (VD: Role Permission Matrix), thay vì luôn disable query.
  const standalone = userIdProp === undefined;
  const { data: users = [] } = useUsers();
  const userId = standalone ? filterUserId : userIdProp;
  const userName = standalone
    ? users.find((u) => u.id === filterUserId)?.name
    : userNameProp;
  const userOptions = users.map((u) => ({
    value: u.id,
    label: `${u.name || u.email} (${u.email})`,
  }));

  const {
    data: scopes = [],
    isLoading,
    error: scopesError,
    refetch: refetchScopes,
  } = useQuery({
    queryKey: ['user-data-scopes', userId],
    queryFn: () => userRoleScopesService.getUserDataScopes(userId!),
    enabled: !!userId,
  });

  // Bù tên kho khi BE không trả `scope_name` cho scope_type='kho'.
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', 'select'],
    queryFn: () => warehousesService.list(),
  });
  const warehouseMap = Object.fromEntries(
    warehouses.map((w) => [w.id, w.name]),
  );

  const addMutation = useMutation({
    mutationFn: (
      payload: Parameters<typeof userRoleScopesService.addDataScope>[0],
    ) => userRoleScopesService.addDataScope(payload),
    onSuccess: () => {
      toast.success('Đã thêm phạm vi dữ liệu');
      setOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['user-data-scopes'] });
    },
    onError: (err: unknown) => {
      toast.error('Không thể thêm phạm vi: ' + getMutationErrorMessage(err));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      userRoleScopesService.revokeDataScope(id, reason),
    onSuccess: () => {
      toast.success('Đã thu hồi phạm vi dữ liệu');
      queryClient.invalidateQueries({ queryKey: ['user-data-scopes'] });
    },
    onError: (err: unknown) => {
      toast.error('Không thể thu hồi phạm vi: ' + getMutationErrorMessage(err));
    },
  });

  const handleAdd = () => {
    form.validateFields().then((values) => {
      const payload: Parameters<typeof userRoleScopesService.addDataScope>[0] =
        {
          user_id: standalone ? values.user_id : userId!,
          scope_type: values.scope_type,
          scope_id: values.scope_id,
          allow: values.allow,
          reason: values.reason,
          effective_from: values.effective_from
            ? values.effective_from.format('YYYY-MM-DD')
            : undefined,
          effective_to: values.effective_to
            ? values.effective_to.format('YYYY-MM-DD')
            : undefined,
        };

      addMutation.mutate(payload);
    });
  };

  const handleRevoke = (id: number) => {
    let reason = '';
    Modal.confirm({
      title: 'Thu hồi phạm vi dữ liệu?',
      content: (
        <div>
          <Text>
            Hành động này sẽ thu hồi quyền truy cập trực tiếp. Thao tác này có
            ghi nhận audit.
          </Text>
          <Input.TextArea
            rows={2}
            placeholder="Lý do thu hồi (bắt buộc)"
            style={{ marginTop: 8 }}
            onChange={(e) => {
              reason = e.target.value;
            }}
          />
        </div>
      ),
      okText: 'Thu hồi',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => {
        if (!reason.trim()) {
          toast.error('Vui lòng nhập lý do thu hồi');
          return Promise.reject();
        }
        return revokeMutation.mutateAsync({ id, reason: reason.trim() });
      },
    });
  };

  const filteredScopes = scopes.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      getScopeDisplayName(
        {
          scope_type: s.scope_type,
          scope_name: s.scope_name,
          warehouse_id: s.scope_type === 'warehouse' ? s.scope_id : undefined,
        },
        warehouseMap,
      )
        .toLowerCase()
        .includes(q) ||
      getScopeTypeLabel(s.scope_type).label.toLowerCase().includes(q) ||
      s.reason?.toLowerCase().includes(q)
    );
  });

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
            Phạm vi dữ liệu trực tiếp {userId ? `của ${userName}` : ''}
          </span>
        </div>
      }
      variant="borderless"
      style={{ width: '100%', borderRadius: 12, marginBottom: 16 }}
    >
      <PermissionGuard permissionCode="SCOPE_CONFIG" fallback={null}>
        <div
          style={{
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setOpen(true)}
            style={{ borderRadius: 6 }}
          >
            Thêm phạm vi
          </Button>
        </div>
      </PermissionGuard>
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {standalone && (
          <Select
            allowClear
            showSearch
            placeholder="Chọn người dùng để xem phạm vi dữ liệu"
            optionFilterProp="label"
            options={userOptions}
            value={filterUserId}
            onChange={(val) => setFilterUserId(val || undefined)}
            style={{ width: 280 }}
          />
        )}
        <Input
          placeholder="Tìm phạm vi, lý do..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          style={{ height: 36, borderRadius: 8, flex: 1, minWidth: 200 }}
        />
      </div>

      {standalone && !filterUserId ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Text type="secondary">
            Chọn một người dùng ở trên để xem phạm vi dữ liệu
          </Text>
        </div>
      ) : scopesError ? (
        <ApiErrorAlert
          error={scopesError}
          title="Không tải được phạm vi dữ liệu"
          onRetry={() => refetchScopes()}
        />
      ) : isLoading ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Text type="secondary">Đang tải...</Text>
        </div>
      ) : filteredScopes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Text type="secondary">Chưa có phạm vi dữ liệu trực tiếp nào</Text>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: 12,
                    color: '#8c887e',
                  }}
                >
                  Loại
                </th>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: 12,
                    color: '#8c887e',
                  }}
                >
                  Phạm vi
                </th>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: '#8c887e',
                  }}
                >
                  Quyền
                </th>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: '#8c887e',
                  }}
                >
                  Hiệu lực
                </th>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: 12,
                    color: '#8c887e',
                  }}
                >
                  Lý do
                </th>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: '#8c887e',
                  }}
                >
                  Trạng thái
                </th>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: '#8c887e',
                  }}
                >
                  Ngày tạo
                </th>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    fontSize: 12,
                    color: '#8c887e',
                  }}
                >
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredScopes.map((scope) => (
                <tr
                  key={scope.id}
                  style={{ borderBottom: '1px solid #f0f0f0' }}
                >
                  <td style={{ padding: '10px 12px' }}>
                    {(() => {
                      const { label, color } = getScopeTypeLabel(
                        scope.scope_type,
                      );
                      return <Tag color={color}>{label}</Tag>;
                    })()}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Text>
                      {getScopeDisplayName(
                        {
                          scope_type: scope.scope_type,
                          scope_name: scope.scope_name,
                          warehouse_id:
                            scope.scope_type === 'warehouse'
                              ? scope.scope_id
                              : undefined,
                        },
                        warehouseMap,
                      )}
                    </Text>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <Tag color={scope.allow ? 'success' : 'error'}>
                      {scope.allow ? 'Cho phép' : 'Cấm'}
                    </Tag>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {scope.effective_from || '—'}{' '}
                      {scope.effective_to ? `→ ${scope.effective_to}` : ''}
                    </Text>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {scope.reason || '—'}
                    </Text>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {scope.revoked_at ? (
                      <Tag color="error">Đã thu hồi</Tag>
                    ) : scope.status === 1 ? (
                      <Tag color="success">Đang hoạt động</Tag>
                    ) : (
                      <Tag color="default">Vô hiệu</Tag>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {scope.created_at
                        ? formatDateTime(scope.created_at)
                        : '—'}
                    </Text>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <Space>
                      {!scope.revoked_at && (
                        <PermissionGuard
                          permissionCode="SCOPE_CONFIG"
                          fallback={null}
                        >
                          <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => handleRevoke(scope.id)}
                          >
                            Thu hồi
                          </Button>
                        </PermissionGuard>
                      )}
                    </Space>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title={`Thêm phạm vi dữ liệu trực tiếp${userId ? ` cho ${userName}` : ''}`}
        onCancel={() => {
          setOpen(false);
          form.resetFields();
        }}
        onOk={handleAdd}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={addMutation.isPending}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {standalone ? (
            <Form.Item
              name="user_id"
              label="Người dùng"
              initialValue={filterUserId}
              rules={[{ required: true, message: 'Vui lòng chọn người dùng' }]}
            >
              <Select
                showSearch
                placeholder="Chọn người dùng"
                optionFilterProp="label"
                options={userOptions}
              />
            </Form.Item>
          ) : (
            <Form.Item name="user_id" initialValue={userId} hidden>
              <Input />
            </Form.Item>
          )}
          <Form.Item
            name="scope_type"
            label="Loại phạm vi"
            rules={[{ required: true, message: 'Vui lòng chọn loại phạm vi' }]}
          >
            <Select placeholder="Chọn loại phạm vi">
              <Select.Option value="org_unit">
                Chi nhánh / Công ty
              </Select.Option>
              <Select.Option value="department">Phòng ban</Select.Option>
              <Select.Option value="warehouse">Kho</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.scope_type !== curr.scope_type}
          >
            {({ getFieldValue }) => {
              const scopeType = getFieldValue('scope_type');
              if (!scopeType) return null;
              return (
                <Form.Item
                  name="scope_id"
                  label="Phạm vi cụ thể"
                  rules={[{ required: true, message: 'Vui lòng chọn phạm vi' }]}
                >
                  <ScopeSelector scopeType={scopeType} />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item
            name="allow"
            label="Quyền"
            rules={[{ required: true, message: 'Vui lòng chọn quyền' }]}
          >
            <Select placeholder="Cho phép hay cấm">
              <Select.Option value={true}>Cho phép (allow)</Select.Option>
              <Select.Option value={false}>Cấm (deny)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="reason"
            label="Lý do"
            rules={[
              {
                required: true,
                message: 'Vui lòng nhập lý do cấp/cấm phạm vi',
              },
            ]}
          >
            <Input.TextArea rows={2} placeholder="Lý do cấp/cấm phạm vi" />
          </Form.Item>
          <Form.Item name="effective_from" label="Từ ngày">
            <DatePicker style={{ width: '100%' }} placeholder="Ngày bắt đầu" />
          </Form.Item>
          <Form.Item name="effective_to" label="Đến ngày">
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Ngày kết thúc (để trống = vô thời hạn)"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
