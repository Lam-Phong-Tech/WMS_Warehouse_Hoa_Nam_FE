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
import {
  IAM_ROLE_STATUS_LABELS,
  IAM_SCOPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";

interface RoleFormValues {
  role_code: string;
  role_name: string;
  scope_type: IamRoleScopeType;
  status: IamRoleStatus;
}

const PERMISSION_MODULE_LABELS: Record<string, string> = {
  iam: "Người dùng & phân quyền",
  sku: "SKU & sản phẩm",
  catalog: "Danh mục",
  inbound: "Nhập kho",
  outbound: "Xuất kho",
  inventory: "Tồn kho",
  warranty: "Bảo hành",
  report: "Báo cáo",
  reports: "Báo cáo",
  pv: "Ứng dụng phân vùng",
  audit: "Nhật ký hệ thống",
  container: "Vật chứa",
  putaway: "Xếp khay",
  component: "Linh kiện",
  rfid: "RFID",
  label: "Nhãn đóng gói",
  scan: "Quét mã",
  warehouse: "Kho",
  agency: "Đối tượng nhận hàng",
  system: "Hệ thống",
};

const PERMISSION_ACTION_LABELS: Record<string, string> = {
  view: "Xem",
  manage: "Quản lý",
  create: "Tạo mới",
  update: "Cập nhật",
  delete: "Xóa",
  scan: "Quét mã",
  post: "Hoàn tất",
  cancel: "Hủy",
  import: "Nhập dữ liệu",
  export: "Xuất dữ liệu",
  trace: "Truy vết",
  publish: "Đưa lên ứng dụng",
  issue: "Xuất",
  approve: "Phê duyệt",
  pii: "Xem thông tin cá nhân",
};

function permissionGroup(permission: IamPermission): string {
  if (permission.permission_name.toLowerCase().startsWith("legacy")) {
    return "Tương thích dữ liệu cũ";
  }
  const [module] = permission.permission_key.split(".");
  return PERMISSION_MODULE_LABELS[module] ?? "Quyền hệ thống khác";
}

function permissionLabel(permission: IamPermission): string {
  const parts = permission.permission_key.split(".").filter(Boolean);
  const module = PERMISSION_MODULE_LABELS[parts[0]] ?? "Chức năng";
  const action =
    [...parts]
      .reverse()
      .map((part) => PERMISSION_ACTION_LABELS[part])
      .find(Boolean) ?? "Thực hiện";
  return `${action} · ${module}`;
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
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "vi"));
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
      toast.warning("Vai trò Quản trị cao nhất là vai trò hệ thống và không được chỉnh sửa.");
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
      toast.success("Đã cập nhật vai trò.");
    } else {
      const created = await createRole.mutateAsync(payload);
      setSelectedRoleId(created.role_id);
      toast.success("Đã tạo vai trò.");
    }
    setRoleModalOpen(false);
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    if (isSystemRole(selectedRole)) {
      toast.warning(
        "Vai trò Quản trị cao nhất có toàn quyền hệ thống và không cho phép sửa ma trận quyền.",
      );
      return;
    }
    await syncPermissions.mutateAsync({
      roleId: selectedRole.role_id,
      permissionIds: [...new Set(checkedIds)].sort(),
    });
    toast.success("Đã cập nhật quyền cho vai trò.");
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
      width: 150,
      render: (value: IamRoleScopeType | null | undefined) => (
        <Tag>
          {businessLabel(
            IAM_SCOPE_LABELS,
            value ?? "FUNCTION",
            "Theo chức năng",
          )}
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 140,
      render: (value: IamRoleStatus) => (
        <Tag color={value === "ACTIVE" ? "success" : "default"}>
          {businessLabel(IAM_ROLE_STATUS_LABELS, value, "Trạng thái khác")}
        </Tag>
      ),
    },
    {
      title: "Số quyền",
      key: "permissions",
      width: 90,
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
              title="Xóa vai trò?"
              description="Không thể xóa vai trò nếu vai trò vẫn đang được gán cho người dùng."
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => deleteRole.mutateAsync(role.role_id)}
            >
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                aria-label={`Xóa ${role.role_name}`}
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
                Vai trò & ma trận quyền
              </Typography.Title>
              <Typography.Text type="secondary">
                Quản lý vai trò và các quyền được phép sử dụng trong hệ thống.
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
        title="Nguyên tắc phân quyền"
        description="Mỗi vai trò chỉ được sử dụng các chức năng đã được cấp quyền. Vai trò Quản trị cao nhất là vai trò hệ thống cố định và luôn có toàn quyền."
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
                title="Tài khoản không có quyền xem danh sách phân quyền."
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
                    title="Đây là vai trò Quản trị cao nhất"
                    description="Không cho phép đổi mã, xóa hoặc thay ma trận quyền của vai trò hệ thống này."
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
                            Chọn cả nhóm
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
                                <Typography.Text>
                                  {permissionLabel(permission)}
                                </Typography.Text>
                                <Typography.Text
                                  type="secondary"
                                  style={{ fontSize: 11 }}
                                  copyable
                                >
                                  {permission.permission_key}
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
        cancelText="Hủy"
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
              placeholder="Ví dụ: KIEM_SOAT_KHO"
              autoComplete="off"
            />
          </Form.Item>
          <Form.Item
            name="role_name"
            label="Tên vai trò"
            rules={[{ required: true, message: "Nhập tên vai trò" }]}
          >
            <Input maxLength={255} placeholder="Ví dụ: Kiểm soát kho" />
          </Form.Item>
          <Form.Item
            name="scope_type"
            label="Phạm vi áp dụng"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "SYSTEM", label: "Toàn hệ thống" },
                { value: "WAREHOUSE", label: "Theo kho" },
                { value: "FUNCTION", label: "Theo chức năng" },
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
                { value: "ACTIVE", label: "Đang sử dụng" },
                { value: "INACTIVE", label: "Ngừng sử dụng" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
