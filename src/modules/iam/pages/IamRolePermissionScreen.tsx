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
  Pagination,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  StopOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  useDeleteIamRole,
  useIamPermissions,
  useIamRolesPage,
  useIamUsers,
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
  const usersQuery = useIamUsers({ per_page: 100 });
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

  const memberCountByRole = useMemo(() => {
    const map = new Map<string, number>();
    (usersQuery.data?.data ?? []).forEach((user) =>
      (user.roles ?? []).forEach((role) =>
        map.set(role.role_id, (map.get(role.role_id) ?? 0) + 1),
      ),
    );
    return map;
  }, [usersQuery.data]);

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

  const openEdit = (role: IamRole) => {
    if (isSystemRole(role)) {
      toast.warning(
        "Vai trò Quản trị cao nhất là vai trò hệ thống và không được chỉnh sửa.",
      );
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
    if (!editingRole) return;
    const values = await form.validateFields();
    const payload: IamRolePayload = {
      role_code: values.role_code.trim().toUpperCase(),
      role_name: values.role_name.trim(),
      scope_type: values.scope_type,
      status: values.status,
    };
    await updateRole.mutateAsync({ roleId: editingRole.role_id, payload });
    toast.success("Đã cập nhật vai trò.");
    setRoleModalOpen(false);
  };

  const toggleRoleStatus = async (role: IamRole) => {
    if (isSystemRole(role)) {
      toast.warning(
        "Vai trò Quản trị cao nhất là vai trò hệ thống và không được vô hiệu hóa.",
      );
      return;
    }
    const nextStatus: IamRoleStatus =
      role.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await updateRole.mutateAsync({
      roleId: role.role_id,
      payload: {
        role_code: role.role_code,
        role_name: role.role_name,
        scope_type: role.scope_type ?? "FUNCTION",
        status: nextStatus,
      },
    });
    toast.success(
      nextStatus === "ACTIVE"
        ? "Đã kích hoạt lại vai trò."
        : "Đã vô hiệu hóa vai trò.",
    );
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
    toast.success("Đã cập nhật ma trận quyền cho vai trò.");
  };

  const resetMatrix = () => {
    setCheckedIds(
      selectedRole?.permissions?.map(
        (permission) => permission.permission_id,
      ) ?? [],
    );
  };

  const toggleGroup = (items: IamPermission[], checked: boolean) => {
    const ids = new Set(checkedIds);
    items.forEach((permission) => {
      if (checked) ids.add(permission.permission_id);
      else ids.delete(permission.permission_id);
    });
    setCheckedIds([...ids]);
  };

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

  const matrixEditable =
    canManageRoles && Boolean(selectedRole) && !isSystemRole(selectedRole);

  const renderRoleCard = (role: IamRole) => {
    const selected = role.role_id === selectedRoleId;
    const memberCount = memberCountByRole.get(role.role_id) ?? 0;
    const active = role.status === "ACTIVE";
    return (
      <div
        key={role.role_id}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={() => setSelectedRoleId(role.role_id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedRoleId(role.role_id);
          }
        }}
        style={{
          border: `1px solid ${selected ? "#2563eb" : "#d8dfeb"}`,
          background: selected ? "#eff6ff" : "#fff",
          borderRadius: 12,
          padding: "10px 12px",
          marginBottom: 8,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Space orientation="vertical" size={2} style={{ minWidth: 0 }}>
          <Typography.Text strong>{role.role_name}</Typography.Text>
          <Tag color={active ? "success" : "default"} style={{ margin: 0 }}>
            {businessLabel(IAM_ROLE_STATUS_LABELS, role.status, "Trạng thái khác")}
          </Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <Typography.Text code style={{ fontSize: 11 }}>
              {role.role_code}
            </Typography.Text>{" "}
            · {memberCount > 0 ? `${memberCount} nhân viên` : "— nhân viên"}
          </Typography.Text>
        </Space>
        {canManageRoles && !isSystemRole(role) && (
          <Space size={2} align="start">
            <Button
              type="text"
              size="small"
              title="Sửa vai trò"
              icon={<EditOutlined style={{ fontSize: 15 }} />}
              aria-label={`Sửa ${role.role_name}`}
              onClick={(event) => {
                event.stopPropagation();
                openEdit(role);
              }}
            />
            <Popconfirm
              title={active ? "Vô hiệu hóa vai trò?" : "Kích hoạt lại vai trò?"}
              description={
                active
                  ? "Người dùng mang vai trò này sẽ không còn dùng được các quyền tương ứng."
                  : "Vai trò sẽ hoạt động trở lại và có thể gán cho người dùng."
              }
              okText={active ? "Vô hiệu hóa" : "Kích hoạt"}
              cancelText="Hủy"
              onConfirm={() => toggleRoleStatus(role)}
            >
              <Button
                type="text"
                size="small"
                danger={active}
                title={active ? "Vô hiệu hóa vai trò" : "Kích hoạt lại vai trò"}
                icon={
                  active ? (
                    <StopOutlined style={{ fontSize: 15 }} />
                  ) : (
                    <CheckCircleOutlined style={{ fontSize: 15 }} />
                  )
                }
                aria-label={
                  active
                    ? `Vô hiệu hóa ${role.role_name}`
                    : `Kích hoạt ${role.role_name}`
                }
                onClick={(event) => event.stopPropagation()}
              />
            </Popconfirm>
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
                size="small"
                title="Xóa vai trò"
                icon={<DeleteOutlined style={{ fontSize: 15 }} />}
                aria-label={`Xóa ${role.role_name}`}
                onClick={(event) => event.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        )}
      </div>
    );
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} xl={9}>
          <Card title="Danh sách vai trò">
            <Space orientation="vertical" size={12} style={{ width: "100%" }}>
              <Input.Search
                allowClear
                placeholder="Tìm vai trò..."
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setRolePage(1);
                }}
              />
              <MvpPageSizeSelector
                value={rolePerPage}
                onChange={(value) => {
                  setRolePerPage(value);
                  setRolePage(1);
                }}
              />
              {rolesQuery.isLoading ? (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <Spin />
                </div>
              ) : roles.length === 0 ? (
                <Empty description="Chưa có vai trò nào." />
              ) : (
                <div>{roles.map(renderRoleCard)}</div>
              )}
              <Row justify="space-between" align="middle">
                <Typography.Text type="secondary">
                  Tổng {rolePagination.total} vai trò
                </Typography.Text>
                <Pagination
                  size="small"
                  current={rolePagination.current}
                  pageSize={rolePerPage}
                  total={rolePagination.total}
                  showSizeChanger={false}
                  onChange={setRolePage}
                />
              </Row>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={15}>
          <Card
            title={
              <Space>
                <Typography.Text strong>
                  Ma trận quyền hạn chi tiết
                </Typography.Text>
                <Tag color="blue">
                  {checkedIds.length}/{permissions.length} quyền
                </Tag>
              </Space>
            }
            extra={
              matrixEditable ? (
                <Space size={8}>
                  <Button
                    icon={<UndoOutlined />}
                    disabled={!permissionsChanged}
                    onClick={resetMatrix}
                  >
                    Hoàn tác
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    disabled={!permissionsChanged}
                    loading={syncPermissions.isPending}
                    onClick={savePermissions}
                  >
                    Lưu ma trận
                  </Button>
                </Space>
              ) : null
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
              <Empty description="Chọn một vai trò để xem ma trận quyền" />
            ) : (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                {isSystemRole(selectedRole) ? (
                  <Alert
                    type="warning"
                    showIcon
                    title="Đây là vai trò Quản trị cao nhất"
                    description="Vai trò hệ thống luôn có toàn quyền; không cho phép đổi mã, xóa hoặc thay ma trận quyền."
                  />
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    title={
                      <Typography.Text>
                        Đang thiết lập quyền cho vai trò:{" "}
                        <Typography.Text strong>
                          {selectedRole.role_name}
                        </Typography.Text>{" "}
                        (Mã:{" "}
                        <Typography.Text code>
                          {selectedRole.role_code}
                        </Typography.Text>
                        ). Tích chọn các quyền chi tiết bên dưới và bấm{" "}
                        <Typography.Text strong>Lưu ma trận</Typography.Text> để
                        cập nhật.
                      </Typography.Text>
                    }
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
                          {matrixEditable ? (
                            <Checkbox
                              checked={allChecked}
                              indeterminate={indeterminate}
                              aria-label={`Chọn tất cả quyền nhóm ${group}`}
                              onChange={(event) =>
                                toggleGroup(items, event.target.checked)
                              }
                            />
                          ) : null}
                          <Typography.Text strong>{group}</Typography.Text>
                        </Space>
                      }
                      extra={
                        <Tag color={checkedCount > 0 ? "blue" : "default"}>
                          {checkedCount}/{items.length} quyền
                        </Tag>
                      }
                    >
                      <Row gutter={[10, 10]}>
                        {items.map((permission) => {
                          const checked = checkedIds.includes(
                            permission.permission_id,
                          );
                          return (
                            <Col
                              xs={24}
                              md={12}
                              xxl={8}
                              key={permission.permission_id}
                            >
                              <div
                                style={{
                                  border: `1px solid ${checked ? "#93c5fd" : "#d8dfeb"}`,
                                  background: checked ? "#eff6ff" : "#fff",
                                  borderRadius: 10,
                                  padding: "8px 10px",
                                  height: "100%",
                                }}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={!matrixEditable}
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
                              </div>
                            </Col>
                          );
                        })}
                      </Row>
                    </Card>
                  );
                })}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="Sửa vai trò"
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={saveRole}
        okText="Lưu vai trò"
        cancelText="Hủy"
        confirmLoading={updateRole.isPending}
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
