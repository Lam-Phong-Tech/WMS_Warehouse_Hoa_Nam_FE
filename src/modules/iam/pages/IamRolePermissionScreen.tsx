import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  useCreateIamRole,
  useDeleteIamRole,
  useIamPermissions,
  useIamRolesPage,
  useSyncIamRolePermissions,
  useUpdateIamRole,
} from "@/modules/iam/hooks/use-iam";
import type {
  IamPermission,
  IamRole,
  IamRolePayload,
  IamRoleScopeType,
  IamRoleStatus,
} from "@/modules/iam/types/iam.types";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

interface RoleFormValues {
  role_code: string;
  role_name: string;
  scope_type: IamRoleScopeType;
  status: IamRoleStatus;
}

function permissionGroup(permission: IamPermission): string {
  if (permission.permission_name.toLowerCase().startsWith("legacy")) {
    return "Tương thích cũ (legacy)";
  }
  const [module] = permission.permission_key.split(".");
  return module || "system";
}

function isSystemRole(role?: IamRole): boolean {
  return role?.role_code === "SUPER_ADMIN";
}

export function IamRolePermissionScreen() {
  const [form] = Form.useForm<RoleFormValues>();
  const [keyword, setKeyword] = useState("");
  const [rolePage, setRolePage] = useState(1);
  const [rolePerPage, setRolePerPage] = useState(15);
  const [selectedRoleId, setSelectedRoleId] = useState<string>();
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<IamRole>();

  const canManageRoles = useCan(P.IAM_ROLE_MANAGE);
  const canViewPermissions = useCan(P.IAM_PERMISSION_VIEW);

  const rolesQuery = useIamRolesPage({
    keyword: keyword || undefined,
    page: rolePage,
    per_page: rolePerPage,
  });
  const permissionsQuery = useIamPermissions({ per_page: 100 });
  const createRole = useCreateIamRole();
  const updateRole = useUpdateIamRole();
  const deleteRole = useDeleteIamRole();
  const syncPermissions = useSyncIamRolePermissions();

  const roles = rolesQuery.data?.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const rolePagination = resolveApiPagination(rolesQuery.data?.meta, {
    page: rolePage,
    pageSize: rolePerPage,
    rowCount: roles.length,
  });
  const selectedRole = roles.find((role) => role.role_id === selectedRoleId);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].role_id);
    } else if (
      selectedRoleId &&
      !roles.some((role) => role.role_id === selectedRoleId)
    ) {
      setSelectedRoleId(roles[0]?.role_id);
    }
  }, [roles, selectedRoleId]);

  useEffect(() => {
    setCheckedIds(
      selectedRole?.permissions?.map(
        (permission) => permission.permission_id,
      ) ?? [],
    );
  }, [selectedRole]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, IamPermission[]>();
    permissions.forEach((permission) => {
      const group = permissionGroup(permission);
      groups.set(group, [...(groups.get(group) ?? []), permission]);
    });
    return [...groups.entries()].sort(([a], [b]) => {
      if (a.startsWith("Tương thích")) return 1;
      if (b.startsWith("Tương thích")) return -1;
      return a.localeCompare(b);
    });
  }, [permissions]);

  const openCreate = () => {
    setEditingRole(undefined);
    form.setFieldsValue({
      role_code: "",
      role_name: "",
      scope_type: "FUNCTION",
      status: "ACTIVE",
    });
    setRoleModalOpen(true);
  };

  const openEdit = (role: IamRole) => {
    if (isSystemRole(role)) {
      toast.warning("SUPER_ADMIN là vai trò hệ thống và không được chỉnh sửa.");
      return;
    }
    setEditingRole(role);
    form.setFieldsValue({
      role_code: role.role_code,
      role_name: role.role_name,
      scope_type: role.scope_type ?? "FUNCTION",
      status: role.status,
    });
    setRoleModalOpen(true);
  };

  const saveRole = async () => {
    const values = await form.validateFields();
    const payload: IamRolePayload = {
      role_code: values.role_code.trim().toUpperCase(),
      role_name: values.role_name.trim(),
      scope_type: values.scope_type,
      status: values.status,
    };
    if (editingRole) {
      await updateRole.mutateAsync({ roleId: editingRole.role_id, payload });
    } else {
      const created = await createRole.mutateAsync(payload);
      setSelectedRoleId(created.role_id);
    }
    setRoleModalOpen(false);
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    if (isSystemRole(selectedRole)) {
      toast.warning(
        "SUPER_ADMIN dùng quyền hệ thống toàn cục và không cho phép sửa ma trận.",
      );
      return;
    }
    await syncPermissions.mutateAsync({
      roleId: selectedRole.role_id,
      permissionIds: [...new Set(checkedIds)].sort(),
    });
  };

  const toggleGroup = (items: IamPermission[], checked: boolean) => {
    const ids = new Set(checkedIds);
    items.forEach((permission) => {
      if (checked) ids.add(permission.permission_id);
      else ids.delete(permission.permission_id);
    });
    setCheckedIds([...ids]);
  };

  const columns: ColumnsType<IamRole> = [
    {
      title: "Vai trò",
      key: "role",
      render: (_, role) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{role.role_name}</Typography.Text>
          <Typography.Text type="secondary" copyable>
            {role.role_code}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Phạm vi",
      dataIndex: "scope_type",
      width: 120,
      render: (value) => <Tag>{value ?? "FUNCTION"}</Tag>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 110,
      render: (value: IamRoleStatus) => (
        <Tag color={value === "ACTIVE" ? "success" : "default"}>{value}</Tag>
      ),
    },
    {
      title: "Quyền",
      key: "permissions",
      width: 80,
      align: "right",
      render: (_, role) => role.permissions?.length ?? 0,
    },
    {
      title: "",
      key: "actions",
      width: 96,
      render: (_, role) => {
        if (!canManageRoles || isSystemRole(role)) return null;
        return (
          <Space size={4}>
            <Button
              type="text"
              icon={<EditOutlined />}
              aria-label={`Sửa ${role.role_name}`}
              onClick={(event) => {
                event.stopPropagation();
                openEdit(role);
              }}
            />
            <Popconfirm
              title="Xoá vai trò?"
              description="BE sẽ từ chối nếu vai trò vẫn đang được gán cho người dùng."
              okText="Xoá"
              cancelText="Huỷ"
              onConfirm={() => deleteRole.mutateAsync(role.role_id)}
            >
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                aria-label={`Xoá ${role.role_name}`}
                onClick={(event) => event.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const permissionsChanged = useMemo(() => {
    const original = new Set(
      selectedRole?.permissions?.map(
        (permission) => permission.permission_id,
      ) ?? [],
    );
    const current = new Set(checkedIds);
    return (
      original.size !== current.size ||
      [...original].some((id) => !current.has(id))
    );
  }, [checkedIds, selectedRole]);

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Row justify="space-between" align="middle" gutter={[12, 12]}>
        <Col>
          <Space align="center" wrap>
            <SafetyCertificateOutlined />
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>
                IAM · Vai trò & ma trận quyền
              </Typography.Title>
              <Typography.Text type="secondary">
                Permission là catalog hệ thống chỉ đọc; role được CRUD và sync
                quyền toàn bộ.
              </Typography.Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void rolesQuery.refetch();
                void permissionsQuery.refetch();
              }}
            >
              Làm mới
            </Button>
            {canManageRoles && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                Tạo vai trò
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        title="Nguyên tắc RBAC"
        description="Route/API là nguồn thực thi quyền. UI chỉ ẩn hoặc khoá action theo permission. SUPER_ADMIN là role hệ thống bất biến; permission catalog không cho tạo/sửa/xoá qua UI."
      />

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} xl={10}>
          <Card title="Vai trò" styles={{ body: { padding: 0 } }}>
            <div style={{ padding: 16 }}>
              <Input.Search
                allowClear
                placeholder="Tìm mã / tên vai trò"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setRolePage(1);
                }}
              />
            </div>
            <div style={{ padding: "0 16px 12px" }}>
              <MvpPageSizeSelector
                value={rolePerPage}
                onChange={(value) => {
                  setRolePerPage(value);
                  setRolePage(1);
                }}
              />
            </div>
            <Table<IamRole>
              rowKey="role_id"
              size="small"
              loading={rolesQuery.isLoading || rolesQuery.isFetching}
              dataSource={roles}
              columns={columns}
              scroll={{ x: "max-content" }}
              pagination={{
                current: rolePagination.current,
                pageSize: rolePerPage,
                total: rolePagination.total,
                showSizeChanger: false,
                showTotal: (total) => `Tổng ${total} vai trò`,
                onChange: setRolePage,
              }}
              rowClassName={(role) =>
                role.role_id === selectedRoleId ? "ant-table-row-selected" : ""
              }
              onRow={(role) => ({
                onClick: () => setSelectedRoleId(role.role_id),
                style: { cursor: "pointer" },
              })}
            />
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card
            title={
              selectedRole
                ? `Ma trận quyền · ${selectedRole.role_name}`
                : "Ma trận quyền"
            }
            extra={
              selectedRole && (
                <Tag color={isSystemRole(selectedRole) ? "gold" : "blue"}>
                  {selectedRole.role_code}
                </Tag>
              )
            }
          >
            {!canViewPermissions ? (
              <Alert
                type="warning"
                showIcon
                title="Tài khoản không có iam.permission.view nên không thể đọc permission catalog."
              />
            ) : permissionsQuery.isLoading ? (
              <div style={{ textAlign: "center", padding: 48 }}>
                <Spin />
              </div>
            ) : !selectedRole ? (
              <Empty description="Chọn một vai trò để xem quyền" />
            ) : (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                {isSystemRole(selectedRole) && (
                  <Alert
                    type="warning"
                    showIcon
                    title="SUPER_ADMIN là vai trò hệ thống"
                    description="Không cho phép đổi mã, xoá hoặc thay ma trận quyền. Runtime Super Admin vẫn có quyền toàn cục theo invariant của hệ thống."
                  />
                )}
                {groupedPermissions.map(([group, items]) => {
                  const ids = items.map(
                    (permission) => permission.permission_id,
                  );
                  const checkedCount = ids.filter((id) =>
                    checkedIds.includes(id),
                  ).length;
                  const allChecked =
                    ids.length > 0 && checkedCount === ids.length;
                  const indeterminate = checkedCount > 0 && !allChecked;
                  return (
                    <Card
                      key={group}
                      size="small"
                      title={
                        <Space>
                          <Typography.Text strong>{group}</Typography.Text>
                          <Tag>
                            {checkedCount}/{items.length}
                          </Tag>
                        </Space>
                      }
                      extra={
                        canManageRoles && !isSystemRole(selectedRole) ? (
                          <Checkbox
                            checked={allChecked}
                            indeterminate={indeterminate}
                            onChange={(event) =>
                              toggleGroup(items, event.target.checked)
                            }
                          >
                            Chọn nhóm
                          </Checkbox>
                        ) : null
                      }
                    >
                      <Row gutter={[12, 10]}>
                        {items.map((permission) => (
                          <Col xs={24} md={12} key={permission.permission_id}>
                            <Checkbox
                              checked={checkedIds.includes(
                                permission.permission_id,
                              )}
                              disabled={
                                !canManageRoles || isSystemRole(selectedRole)
                              }
                              onChange={(event) => {
                                const next = new Set(checkedIds);
                                if (event.target.checked)
                                  next.add(permission.permission_id);
                                else next.delete(permission.permission_id);
                                setCheckedIds([...next]);
                              }}
                            >
                              <Space orientation="vertical" size={0}>
                                <Typography.Text code>
                                  {permission.permission_key}
                                </Typography.Text>
                                <Typography.Text
                                  type="secondary"
                                  style={{ fontSize: 12 }}
                                >
                                  {permission.permission_name}
                                </Typography.Text>
                              </Space>
                            </Checkbox>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  );
                })}

                {canManageRoles && !isSystemRole(selectedRole) && (
                  <Row justify="end">
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      disabled={!permissionsChanged}
                      loading={syncPermissions.isPending}
                      onClick={savePermissions}
                    >
                      Lưu & áp dụng quyền
                    </Button>
                  </Row>
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingRole ? "Sửa vai trò" : "Tạo vai trò"}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={saveRole}
        okText="Lưu vai trò"
        cancelText="Huỷ"
        confirmLoading={createRole.isPending || updateRole.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="role_code"
            label="Mã vai trò"
            rules={[
              { required: true, message: "Nhập mã vai trò" },
              {
                pattern: /^[A-Za-z0-9_.-]+$/,
                message: "Chỉ dùng chữ, số, dấu _, . hoặc -",
              },
            ]}
          >
            <Input
              maxLength={100}
              placeholder="VD: WAREHOUSE_QA"
              autoComplete="off"
            />
          </Form.Item>
          <Form.Item
            name="role_name"
            label="Tên vai trò"
            rules={[{ required: true, message: "Nhập tên vai trò" }]}
          >
            <Input maxLength={255} placeholder="VD: Warehouse QA" />
          </Form.Item>
          <Form.Item
            name="scope_type"
            label="Loại phạm vi"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "SYSTEM", label: "SYSTEM" },
                { value: "WAREHOUSE", label: "WAREHOUSE" },
                { value: "FUNCTION", label: "FUNCTION" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
