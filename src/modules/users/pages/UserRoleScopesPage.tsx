import { useState, useMemo, useEffect, useRef } from 'react';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  Tooltip,
} from 'antd';
import { toast } from 'sonner';
import { PlusOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { warehousesService } from '@/modules/warehouses/services/warehouses.service';
import {
  PageHeader,
  ApiErrorAlert,
  EmptyState,
  LoadingState,
  DataTable,
  ActionDropdown,
  PermissionGuard,
  confirmDialog,
} from '@/shared/components';
import type { ActionItem } from '@/shared/components';
import { useFormDraft } from '@/shared/hooks/useFormDraft';
import { useUserRoleScopes } from '@/modules/roles/hooks/use-roles';
import { useUsers } from '@/modules/users/hooks/use-users';
import { useOrgUnits } from '@/modules/org-units/hooks/use-org-units';
import { useDepartments } from '@/modules/departments/hooks/use-departments';
import { useRoles } from '@/modules/roles/hooks/use-roles';
import { ScopeSelector } from '@/modules/roles/components/ScopeSelector';
import { UserDataScopesTable } from '@/modules/roles/components/UserDataScopesTable';
import {
  useRolesAssignRole,
  useRolesRevokeRole,
  useRolesUpdateRole,
} from '../../roles/hooks/use-role-scopes';
import {
  getScopeDisplayName,
  getScopeTypeLabel,
  type UserRoleScope,
} from '@/modules/roles/services/user-role-scopes.service';
import { getMutationErrorMessage } from '@/shared/api/api-error';

const { Text } = Typography;

/** Tab 1: gán vai trò cho người dùng kèm phạm vi đơn vị/phòng ban (F5.4). */
function RoleScopesTab() {
  const { modal } = App.useApp();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const roleScopeDraft = useFormDraft<Record<string, unknown>>(
    'user-role-scope-create',
  );
  const roleScopeSubmittedRef = useRef(false);
  const roleScopeAutosaveTimerRef =
    useRef<ReturnType<typeof setTimeout>>(undefined);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [editingRecord, setEditingRecord] = useState<UserRoleScope | null>(
    null,
  );

  // Khôi phục dữ liệu đã nhập dở khi mở lại modal gán vai trò (chỉ khi tạo mới)
  useEffect(() => {
    if (!open || editingRecord) return;
    roleScopeSubmittedRef.current = false;
    const saved = roleScopeDraft.restore();
    if (saved) form.setFieldsValue(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRecord]);

  // Save draft on unmount if modal is open (user navigates away to another page)
  useEffect(() => {
    return () => {
      if (open && !editingRecord && !roleScopeSubmittedRef.current) {
        roleScopeDraft.save(form.getFieldsValue());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRecord]);

  // Autosave draft liên tục khi người dùng gõ (debounce) — đảm bảo dữ liệu
  // không mất khi điều hướng sang trang khác trước khi effect unmount ở trên
  // kịp chạy (ví dụ route chuyển trang bằng SPA navigation).
  const handleRoleScopeFormValuesChange = () => {
    if (editingRecord) return;
    if (roleScopeAutosaveTimerRef.current)
      clearTimeout(roleScopeAutosaveTimerRef.current);
    roleScopeAutosaveTimerRef.current = setTimeout(() => {
      roleScopeDraft.save(form.getFieldsValue());
    }, 400);
  };

  const {
    data: scopesResult,
    isLoading,
    error,
    refetch,
  } = useUserRoleScopes(selectedUserId, page, perPage);
  const scopes = scopesResult?.data ?? [];
  const { data: users = [] } = useUsers();
  // Dùng cho dropdown chọn vai trò — cần toàn bộ danh sách, không phân
  // trang (limit tối đa BE cho phép là 100, xem RoleListParams).
  const { data: allRolesResult } = useRoles({ per_page: 100 });
  const allRoles = useMemo(() => allRolesResult?.data ?? [], [allRolesResult]);
  const { data: orgUnits = [] } = useOrgUnits({ enabled: true });
  const { data: departments = [] } = useDepartments();
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', 'lookup'],
    queryFn: () => warehousesService.list(),
  });
  const assignRoleMutation = useRolesAssignRole();
  const updateRoleMutation = useRolesUpdateRole();
  const revokeRoleMutation = useRolesRevokeRole();

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.name || u.email} (${u.email})`,
      })),
    [users],
  );
  const roleOptions = useMemo(
    () =>
      allRoles.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` })),
    [allRoles],
  );
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // Lưu ý: PUT /users/{user_id}/role-scopes (BE) chỉ nhận role_id/scope_type/
      // org_unit_id/department_id/warehouse_id trong mỗi grant (RoleScopeGrantRequest) —
      // đã xác nhận qua Swagger schema + test thật (2026-07-03): effective_from/
      // effective_to/reason/allow gửi lên đều bị BE bỏ qua (trả về null/mặc định
      // "allow"), không lưu. Vì vậy form không thu thập các field này nữa — tránh
      // để người dùng nhập rồi mất dữ liệu mà không biết. Xem docs/CHANGELOG.md.
      const scopeType = values.scope_type as string | undefined;
      const payload = {
        user_id: values.user_id,
        role_id: values.role_id,
        scope_type: scopeType,
        org_unit_id:
          scopeType === 'org_unit' || scopeType === 'company'
            ? values.scope_id || null
            : null,
        department_id:
          scopeType === 'department' ? values.scope_id || null : null,
        warehouse_id:
          scopeType === 'warehouse' ? values.scope_id || null : null,
      };

      if (editingRecord) {
        await updateRoleMutation.mutateAsync({
          id: editingRecord.id,
          payload,
        });
        toast.success('Đã cập nhật vai trò người dùng');
      } else {
        await assignRoleMutation.mutateAsync(payload);
        toast.success('Đã gán vai trò cho người dùng');
      }

      roleScopeSubmittedRef.current = true;
      roleScopeDraft.clear();
      setOpen(false);
      setEditingRecord(null);
      form.resetFields();
      setSelectedRowKeys([]);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(getMutationErrorMessage(err));
      }
    }
  };

  const handleBulkRevoke = () => {
    if (selectedRowKeys.length === 0) return;
    let reason = '';
    modal.confirm({
      title: 'Thu hồi vai trò',
      content: (
        <div>
          <Text>
            Bạn có chắc muốn thu hồi {selectedRowKeys.length} vai trò đã chọn?
            Thao tác này có ghi nhận audit.
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
      okButtonProps: { danger: true },
      onOk: () => {
        if (!reason.trim()) {
          toast.error('Vui lòng nhập lý do thu hồi');
          return Promise.reject();
        }
        let completed = 0;
        selectedRowKeys.forEach((id) => {
          revokeRoleMutation.mutate(
            { id: id as number, reason: reason.trim() },
            {
              onSuccess: () => {
                completed++;
                if (completed === selectedRowKeys.length) {
                  toast.success(`Đã thu hồi ${selectedRowKeys.length} vai trò`);
                  setSelectedRowKeys([]);
                  refetch();
                }
              },
              onError: (err) => toast.error(getMutationErrorMessage(err)),
            },
          );
        });
      },
    });
  };

  const handleRevoke = (item: {
    id: number;
    user_id: number;
    role_id: number;
  }) => {
    let reason = '';
    modal.confirm({
      title: 'Thu hồi vai trò?',
      content: (
        <div>
          <Text>
            Hành động này sẽ thu hồi vai trò đã gán cho người dùng. Thao tác này
            có ghi nhận audit.
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
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        if (!reason.trim()) {
          toast.error('Vui lòng nhập lý do thu hồi');
          return Promise.reject();
        }
        try {
          await revokeRoleMutation.mutateAsync({
            ...item,
            reason: reason.trim(),
          });
          toast.success('Đã thu hồi vai trò');
          refetch();
        } catch (err: unknown) {
          toast.error(getMutationErrorMessage(err));
        }
      },
    });
  };

  const handleEdit = (record: (typeof scopes)[number]) => {
    setEditingRecord(record);
    // Ưu tiên scope_type gốc từ BE để phân biệt 'company' (Công ty) với
    // 'org_unit' (Chi nhánh) — cả hai đều lưu vào org_unit_id nên suy luận
    // ngược từ ID sẽ luôn ra 'org_unit', làm mất phân biệt Công ty/Chi nhánh.
    const scopeType =
      record.scope_type ||
      (record.warehouse_id
        ? 'warehouse'
        : record.department_id
          ? 'department'
          : record.org_unit_id
            ? 'org_unit'
            : 'he_thong');
    form.setFieldsValue({
      user_id: record.user_id,
      role_id: record.role_id,
      scope_type: scopeType,
      scope_id:
        record.warehouse_id ||
        record.department_id ||
        record.org_unit_id ||
        undefined,
    });
    setOpen(true);
  };

  const closeFormModal = () => {
    if (roleScopeAutosaveTimerRef.current)
      clearTimeout(roleScopeAutosaveTimerRef.current);
    setOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  // Bấm nút "Hủy" — hỏi xác nhận nếu đã nhập dữ liệu, xóa draft khi đồng ý
  const handleModalCancel = () => {
    if (!editingRecord && form.isFieldsTouched()) {
      confirmDialog({
        title: 'Xác nhận hủy',
        content: 'Bạn có chắc chắn muốn hủy? Dữ liệu đã nhập sẽ bị xóa.',
        okText: 'Đồng ý',
        cancelText: 'Tiếp tục nhập',
        danger: true,
        onOk: () => {
          roleScopeSubmittedRef.current = true;
          roleScopeDraft.clear();
          closeFormModal();
        },
      });
      return;
    }
    closeFormModal();
  };

  // Bấm ra ngoài modal / phím Esc / nút X — không hỏi xác nhận, chỉ lưu tạm
  // để mở lại vẫn còn dữ liệu vừa nhập.
  const handleModalDismiss = () => {
    if (!editingRecord) {
      roleScopeDraft.save(form.getFieldsValue());
    }
    closeFormModal();
  };

  const columns = [
    {
      title: 'Người dùng',
      key: 'user',
      sorter: (a: (typeof scopes)[number], b: (typeof scopes)[number]) => {
        const nameOf = (r: (typeof scopes)[number]) => {
          const u = users.find((x) => x.id === r.user_id);
          return u?.name || u?.email || '';
        };
        return nameOf(a).localeCompare(nameOf(b));
      },
      render: (_: unknown, record: (typeof scopes)[number]) => {
        const u = users.find((x) => x.id === record.user_id);
        return (
          <div>
            <div style={{ fontWeight: 700 }}>
              {u?.name || u?.email || `User #${record.user_id}`}
            </div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{u?.email}</div>
          </div>
        );
      },
    },
    {
      title: 'Vai trò',
      key: 'role',
      sorter: (a: (typeof scopes)[number], b: (typeof scopes)[number]) => {
        const roleNameOf = (r: (typeof scopes)[number]) =>
          r.role_name || allRoles.find((x) => x.id === r.role_id)?.name || '';
        return roleNameOf(a).localeCompare(roleNameOf(b));
      },
      render: (_: unknown, record: (typeof scopes)[number]) => (
        <span>
          {record.role_name ||
            allRoles.find((r) => r.id === record.role_id)?.name ||
            `Role #${record.role_id}`}
          {record.revoked_at && (
            <Tag color="error" style={{ marginLeft: 8 }}>
              Đã thu hồi
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Loại phạm vi',
      key: 'scope_type',
      render: (_: unknown, record: (typeof scopes)[number]) => {
        const { label, color } = getScopeTypeLabel(record.scope_type);
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: 'Đơn vị',
      key: 'org_unit',
      width: 180,
      sorter: (a: (typeof scopes)[number], b: (typeof scopes)[number]) => {
        const orgNameOf = (r: (typeof scopes)[number]) =>
          orgUnits.find((x) => x.id === r.org_unit_id)?.name || '';
        return orgNameOf(a).localeCompare(orgNameOf(b));
      },
      render: (_: unknown, record: (typeof scopes)[number]) => {
        if (!record.org_unit_id) return '—';
        const o = orgUnits.find((x) => x.id === record.org_unit_id);
        const fullText = o
          ? `${o.code} — ${o.name}`
          : `Đơn vị #${record.org_unit_id}`;
        const displayText =
          fullText.length > 30 ? `${fullText.slice(0, 27)}...` : fullText;
        return (
          <Tooltip title={fullText}>
            <span
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayText}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Phòng ban',
      key: 'department',
      width: 180,
      sorter: (a: (typeof scopes)[number], b: (typeof scopes)[number]) => {
        const deptNameOf = (r: (typeof scopes)[number]) =>
          departments.find((x) => x.id === r.department_id)?.name || '';
        return deptNameOf(a).localeCompare(deptNameOf(b));
      },
      render: (_: unknown, record: (typeof scopes)[number]) => {
        if (!record.department_id) return '—';
        const d = departments.find((x) => x.id === record.department_id);
        const fullText = d
          ? `${d.code} — ${d.name}`
          : `Phòng ban #${record.department_id}`;
        const displayText =
          fullText.length > 30 ? `${fullText.slice(0, 27)}...` : fullText;
        return (
          <Tooltip title={fullText}>
            <span
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayText}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Kho',
      key: 'warehouse',
      width: 180,
      render: (_: unknown, record: (typeof scopes)[number]) => {
        if (!record.warehouse_id) return '—';
        const w = warehouses.find((x) => x.id === record.warehouse_id);
        const fullText = w
          ? `${w.code} — ${w.name}`
          : getScopeDisplayName({
              scope_type: 'warehouse',
              warehouse_id: record.warehouse_id,
            });
        const displayText =
          fullText.length > 30 ? `${fullText.slice(0, 27)}...` : fullText;
        return (
          <Tooltip title={fullText}>
            <span
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayText}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: unknown, record: (typeof scopes)[number]) =>
        record.revoked_at ? (
          <Tag color="error">Đã thu hồi</Tag>
        ) : (
          <Tag color="success">Đang hiệu lực</Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: (typeof scopes)[number]) => {
        if (record.revoked_at) return null;

        const items: ActionItem[] = [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Sửa',
            permission: 'ROLE_ASSIGN',
            onClick: () => handleEdit(record),
          },
          {
            key: 'revoke',
            icon: <StopOutlined />,
            label: 'Thu hồi',
            danger: true,
            permission: 'ROLE_ASSIGN',
            onClick: () => handleRevoke(record),
          },
        ];

        return <ActionDropdown items={items} />;
      },
    },
  ];

  const total = scopesResult?.meta?.total ?? scopes.length;
  const hasSelection = selectedRowKeys.length > 0;

  return (
    <Card variant="borderless">
      <Space style={{ marginBottom: 16, display: 'flex' }} wrap>
        <Select
          allowClear
          showSearch
          placeholder="Lọc theo người dùng"
          optionFilterProp="label"
          options={userOptions}
          onChange={(val) => {
            setSelectedUserId(val || undefined);
            setPage(1);
          }}
          style={{ width: 260 }}
          value={selectedUserId}
        />
        <PermissionGuard permissionCode="ROLE_ASSIGN" fallback={null}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setOpen(true)}
          >
            Gán vai trò
          </Button>
        </PermissionGuard>
        {hasSelection && (
          <PermissionGuard permissionCode="ROLE_ASSIGN" fallback={null}>
            <Button
              danger
              size="small"
              onClick={handleBulkRevoke}
              disabled={revokeRoleMutation.isPending}
            >
              Thu hồi ({selectedRowKeys.length})
            </Button>
          </PermissionGuard>
        )}
      </Space>

      {error && (
        <ApiErrorAlert
          error={error}
          title="Không tải được dữ liệu"
          onRetry={refetch}
          style={{ marginBottom: 16 }}
        />
      )}

      {isLoading && scopes.length === 0 ? (
        <LoadingState tip="Đang tải danh sách phân quyền…" minHeight={320} />
      ) : !isLoading && scopes.length === 0 ? (
        <EmptyState
          title="Chưa có phân quyền nào"
          description="Bắt đầu bằng cách gán vai trò cho người dùng."
        >
          <PermissionGuard permissionCode="ROLE_ASSIGN" fallback={null}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setOpen(true)}
            >
              + Gán vai trò
            </Button>
          </PermissionGuard>
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          dataSource={scopes}
          loading={isLoading}
          showTopPagination
          topPaginationPlacement="bottom"
          pagination={{
            current: page,
            pageSize: perPage,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPerPage(ps);
            },
          }}
          topPaginationConfig={{
            total,
            current: page,
            pageSize: perPage,
            unitName: 'bản ghi',
            pageSizeOptions: [15, 20, 50, 100],
            onChange: (p, ps) => {
              setPage(p);
              setPerPage(ps);
            },
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as React.Key[]),
          }}
        />
      )}

      <Modal
        title={
          editingRecord
            ? 'Chỉnh sửa vai trò & phạm vi'
            : 'Gán vai trò cho người dùng'
        }
        open={open}
        onCancel={handleModalDismiss}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={handleRoleScopeFormValuesChange}
        >
          <Form.Item
            name="user_id"
            label="Người dùng"
            rules={[{ required: true, message: 'Vui lòng chọn người dùng' }]}
          >
            <Select
              showSearch
              disabled={!!editingRecord}
              placeholder="Chọn người dùng. Ví dụ: Nguyễn Văn A"
              optionFilterProp="label"
              options={userOptions}
            />
          </Form.Item>
          <Form.Item
            name="role_id"
            label="Vai trò"
            rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
          >
            <Select
              showSearch
              placeholder="Chọn vai trò. Ví dụ: Quản trị hệ thống"
              optionFilterProp="label"
              options={roleOptions}
            />
          </Form.Item>
          <Form.Item
            name="scope_type"
            label="Phạm vi"
            rules={[{ required: true, message: 'Vui lòng chọn phạm vi' }]}
            initialValue={undefined}
          >
            <Select
              placeholder="Chọn phạm vi áp dụng"
              allowClear
              onChange={() => form.setFieldValue('scope_id', undefined)}
              options={[
                { value: 'he_thong', label: 'Toàn hệ thống' },
                { value: 'company', label: 'Công ty' },
                { value: 'org_unit', label: 'Chi nhánh' },
                { value: 'department', label: 'Phòng ban' },
                { value: 'warehouse', label: 'Kho' },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.scope_type !== curr.scope_type}
          >
            {({ getFieldValue }) => {
              const scopeType = getFieldValue('scope_type');
              // 'he_thong' (Toàn hệ thống) không gắn với 1 đối tượng phạm vi
              // cụ thể nào (org_unit_id/department_id/warehouse_id đều null,
              // xem handleSubmit) — không bắt chọn thêm ScopeSelector.
              if (!scopeType || scopeType === 'he_thong') return null;
              return (
                <Form.Item
                  name="scope_id"
                  label={
                    scopeType === 'warehouse'
                      ? 'Kho'
                      : scopeType === 'department'
                        ? 'Phòng ban'
                        : 'Công ty/Chi nhánh'
                  }
                  rules={[
                    {
                      required: true,
                      message: 'Vui lòng chọn đối tượng phạm vi',
                    },
                  ]}
                >
                  <ScopeSelector scopeType={scopeType} />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item>
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
            >
              <Button onClick={handleModalCancel}>Hủy</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={
                  assignRoleMutation.isPending || updateRoleMutation.isPending
                }
              >
                {editingRecord ? 'Cập nhật' : 'Gán vai trò'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export function UserRoleScopesPage() {
  return (
    <div>
      <PageHeader
        title="Phân quyền người dùng"
        subtitle="Gán vai trò và phạm vi dữ liệu cho từng người dùng."
      />
      <Tabs
        defaultActiveKey="role"
        items={[
          {
            key: 'role',
            label: 'Vai trò & phạm vi',
            children: <RoleScopesTab />,
          },
          {
            key: 'data-scope',
            label: 'Cấp phạm vi',
            children: <UserDataScopesTable />,
          },
        ]}
      />
    </div>
  );
}
