import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Descriptions, Modal, Space, Tag } from "antd";
import {
  CloseOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
  SaveOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import {
  useCreateIamUser,
  useIamRoles,
  useIamScopeWarehouses,
  useIamUsers,
  useUpdateIamUser,
} from "@/modules/iam/hooks/use-iam";
import type {
  IamRole,
  IamRolePivot,
  IamUser,
  IamUserStatus,
} from "@/modules/iam/types/iam.types";
import {
  getApiErrorMessage,
  getMutationErrorMessage,
} from "@/shared/api/api-error";
import {
  MvpPageSizeSelector,
  MvpPaginationFooter,
} from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import {
  IAM_SCOPE_TYPE_LABELS,
  IAM_USER_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useAuthStore } from "@/shared/store/auth.store";

const STATUS_OPTIONS: Array<{ value: IamUserStatus; label: string }> = [
  { value: "ACTIVE", label: IAM_USER_STATUS_LABELS.ACTIVE },
  { value: "INACTIVE", label: IAM_USER_STATUS_LABELS.INACTIVE },
  { value: "LOCKED", label: IAM_USER_STATUS_LABELS.LOCKED },
];

type UserFormState = {
  displayName: string;
  username: string;
  phone: string;
  email: string;
  roleId: string;
  scopeRef: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: IamUserStatus;
  password: string;
};

const EMPTY_FORM: UserFormState = {
  displayName: "",
  username: "",
  phone: "",
  email: "",
  roleId: "",
  scopeRef: "",
  effectiveFrom: "",
  effectiveTo: "",
  status: "ACTIVE",
  password: "",
};

function statusLabel(status: IamUserStatus) {
  return businessLabel(IAM_USER_STATUS_LABELS, status);
}

function statusClass(status: IamUserStatus) {
  if (status === "ACTIVE") return "pill ok";
  if (status === "LOCKED") return "pill danger-pill";
  return "pill warn-pill";
}

function scopeTypeLabel(scopeType?: string | null): string {
  return businessLabel(IAM_SCOPE_TYPE_LABELS, scopeType);
}

function scopeLabel(
  role: IamRole | undefined,
  warehouseNames: Map<string, string>,
) {
  if (!role) return "Chưa gán";
  const scopeRef = role.pivot?.scope_ref;
  if (scopeRef) return warehouseNames.get(scopeRef) ?? "Kho không xác định";
  if (role.scope_type === "WAREHOUSE") return "Mọi kho";
  if (role.scope_type === "FUNCTION") return "Theo chức năng";
  return "Toàn hệ thống";
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(
    parsed,
  );
}

function effectiveWindowLabel(pivot?: IamRolePivot) {
  const from = formatDate(pivot?.effective_from);
  const to = formatDate(pivot?.effective_to);
  if (!from && !to) return "Vô thời hạn";
  return `${from ?? "—"} → ${to ?? "—"}`;
}

function formatLastLogin(value?: string | null) {
  if (!value) return "Chưa đăng nhập";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

export interface IamUserScreenProps {
  /** Deep-link IAM-02 mở cửa sổ tạo người dùng trên IAM-01. */
  openCreateOnMount?: boolean;
}

export function IamUserScreen({
  openCreateOnMount = false,
}: IamUserScreenProps) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const currentUserId = useAuthStore((state) => state.profile?.user_id);
  const canManageUsers =
    isSuperAdmin || permissionCodes.includes("iam.user.manage");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<IamUserStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<IamUser | null>(null);
  const [formState, setFormState] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [viewingUser, setViewingUser] = useState<IamUser | null>(null);

  const usersQuery = useIamUsers({
    keyword: search.trim(),
    status: statusFilter,
    page: roleFilter ? 1 : page,
    per_page: roleFilter ? 100 : perPage,
  });
  const rolesQuery = useIamRoles({ per_page: 100 });
  const warehousesQuery = useIamScopeWarehouses();
  const createUser = useCreateIamUser();
  const updateUser = useUpdateIamUser();

  const warehouses = useMemo(
    () =>
      (warehousesQuery.data ?? []).map((row) => ({
        id: String(row.id ?? ""),
        label: String(row.name ?? row.code ?? row.id ?? ""),
      })),
    [warehousesQuery.data],
  );
  const warehouseNames = useMemo(
    () => new Map(warehouses.map((row) => [row.id, row.label])),
    [warehouses],
  );

  const roles = rolesQuery.data ?? [];
  const users = usersQuery.data?.data ?? [];
  const isSaving = createUser.isPending || updateUser.isPending;

  const roleFilteredUsers = useMemo(() => {
    if (!roleFilter) return users;
    return users.filter((user) =>
      user.roles?.some((role) => role.role_id === roleFilter),
    );
  }, [roleFilter, users]);

  const pagination = resolveApiPagination(usersQuery.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: users.length,
  });
  const total = roleFilter ? roleFilteredUsers.length : pagination.total;
  const displayedUsers = roleFilter
    ? roleFilteredUsers.slice((page - 1) * perPage, page * perPage)
    : users;

  const selectedRole = useMemo(
    () => roles.find((role) => role.role_id === formState.roleId),
    [formState.roleId, roles],
  );

  const isEditingSelf = Boolean(
    editingUser && currentUserId && editingUser.user_id === currentUserId,
  );

  const resetForm = () => {
    setFormState({
      ...EMPTY_FORM,
      roleId: roles[0]?.role_id ?? "",
    });
  };

  const openCreate = () => {
    if (!canManageUsers) return;
    setEditingUser(null);
    resetForm();
    setFormError("");
    setIsModalOpen(true);
  };

  const defaultRoleId = roles[0]?.role_id ?? "";
  useEffect(() => {
    if (!openCreateOnMount || !canManageUsers) return;
    setEditingUser(null);
    setFormState({
      ...EMPTY_FORM,
      roleId: defaultRoleId,
    });
    setFormError("");
    setIsModalOpen(true);
  }, [canManageUsers, openCreateOnMount, defaultRoleId]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / perPage));
    if (page > maxPage) setPage(maxPage);
  }, [page, perPage, total]);

  const openEdit = (user: IamUser) => {
    if (!canManageUsers) return;
    const primaryRole = user.roles?.[0];
    setEditingUser(user);
    setFormState({
      displayName: user.display_name,
      username: user.username,
      phone: user.phone ?? "",
      email: user.email ?? "",
      roleId: primaryRole?.role_id ?? roles[0]?.role_id ?? "",
      scopeRef: primaryRole?.pivot?.scope_ref ?? "",
      effectiveFrom: primaryRole?.pivot?.effective_from?.slice(0, 10) ?? "",
      effectiveTo: primaryRole?.pivot?.effective_to?.slice(0, 10) ?? "",
      status: user.status,
      password: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const openView = (user: IamUser) => {
    setViewingUser(user);
  };

  const closeView = () => {
    setViewingUser(null);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingUser(null);
    setFormError("");
  };

  const updateField = <K extends keyof UserFormState>(
    key: K,
    value: UserFormState[K],
  ) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    const displayName = formState.displayName.trim();
    const username = formState.username.trim().toLowerCase();
    const email = formState.email.trim();
    const phone = formState.phone.trim();
    const password = formState.password;

    if (!displayName || !username || !formState.roleId) {
      setFormError("Vui lòng nhập đầy đủ họ tên, tên đăng nhập và vai trò.");
      return;
    }
    if (!editingUser && password.length < 8) {
      setFormError("Mật khẩu tạm phải có ít nhất 8 ký tự.");
      return;
    }
    if (editingUser && password && password.length < 8) {
      setFormError("Mật khẩu đặt lại phải có ít nhất 8 ký tự.");
      return;
    }
    if (phone && !/^0\d{9}$/.test(phone)) {
      setFormError("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.");
      return;
    }

    const basePayload = {
      display_name: displayName,
      username,
      email: email || null,
      phone: phone || null,
      status: formState.status,
      ...(password ? { password } : {}),
    };

    const assignment = {
      role_id: formState.roleId,
      scope_ref: formState.scopeRef || null,
      effective_from: formState.effectiveFrom || null,
      effective_to: formState.effectiveTo || null,
    };
    const currentRole = editingUser?.roles?.[0];

    try {
      if (editingUser) {
        await updateUser.mutateAsync({
          userId: editingUser.user_id,
          assignment,
          currentAssignment: currentRole
            ? {
                role_id: currentRole.role_id,
                scope_ref: currentRole.pivot?.scope_ref ?? null,
                effective_from:
                  currentRole.pivot?.effective_from?.slice(0, 10) ?? null,
                effective_to:
                  currentRole.pivot?.effective_to?.slice(0, 10) ?? null,
              }
            : undefined,
          payload: {
            ...basePayload,
            version: editingUser.version,
          },
        });
      } else {
        await createUser.mutateAsync({
          assignment,
          payload: {
            ...basePayload,
            password,
          },
        });
      }
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      setFormError(getMutationErrorMessage(error));
    }
  };

  const listError = usersQuery.error
    ? getApiErrorMessage(
        usersQuery.error,
        "Không tải được danh sách người dùng.",
      )
    : "";
  const roleError = rolesQuery.error
    ? getApiErrorMessage(rolesQuery.error, "Không tải được danh sách vai trò.")
    : "";

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="IAM-01">
      <div className="toolbar">
        <input
          className="input search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm tên / tên đăng nhập"
          aria-label="Tìm người dùng"
        />
        <select
          className="select"
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(event.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo vai trò"
          disabled={rolesQuery.isLoading}
        >
          <option value="">Vai trò: Tất cả</option>
          {roles.map((role) => (
            <option key={role.role_id} value={role.role_id}>
              {role.role_name}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as IamUserStatus | "");
            setPage(1);
          }}
          aria-label="Lọc theo trạng thái"
        >
          <option value="">Trạng thái: Tất cả</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <div className="spacer" />
        {canManageUsers ? (
          <button
            className="btn primary"
            type="button"
            onClick={openCreate}
            disabled={rolesQuery.isLoading || roles.length === 0}
          >
            <UserAddOutlined /> Thêm người dùng
          </button>
        ) : null}
      </div>

      {listError ? (
        <div className="alert" role="alert" style={{ marginBottom: 14 }}>
          {listError}{" "}
          <button
            className="btn small"
            type="button"
            onClick={() => usersQuery.refetch()}
          >
            <ReloadOutlined /> Thử lại
          </button>
        </div>
      ) : null}
      {roleError ? (
        <div className="alert" role="alert" style={{ marginBottom: 14 }}>
          {roleError}
        </div>
      ) : null}

      <MvpPageSizeSelector
        value={perPage}
        onChange={(value) => {
          setPerPage(value);
          setPage(1);
        }}
      />

      <div className="table-wrap" aria-busy={usersQuery.isLoading}>
        <table>
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Vai trò</th>
              <th>Phạm vi</th>
              <th>Trạng thái</th>
              <th>Đăng nhập cuối</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading ? (
              <tr>
                <td colSpan={6}>
                  <span className="muted">Đang tải dữ liệu...</span>
                </td>
              </tr>
            ) : displayedUsers.length > 0 ? (
              displayedUsers.map((user) => {
                const primaryRole = user.roles?.[0];
                return (
                  <tr key={user.user_id}>
                    <td>
                      {user.display_name}
                      <br />
                      <span className="muted">{user.username}</span>
                    </td>
                    <td>{primaryRole?.role_name ?? "Chưa gán"}</td>
                    <td>{scopeLabel(primaryRole, warehouseNames)}</td>
                    <td>
                      <span className={statusClass(user.status)}>
                        {statusLabel(user.status)}
                      </span>
                    </td>
                    <td>{formatLastLogin(user.last_login_at)}</td>
                    <td>
                      <Space size={8}>
                        <button
                          className="btn small"
                          type="button"
                          onClick={() => openView(user)}
                        >
                          <EyeOutlined /> Xem
                        </button>
                        {canManageUsers ? (
                          <button
                            className="btn small"
                            type="button"
                            onClick={() => openEdit(user)}
                          >
                            <EditOutlined /> Sửa
                          </button>
                        ) : null}
                      </Space>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6}>
                  <span className="muted">
                    Không có người dùng phù hợp bộ lọc.
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MvpPaginationFooter
        current={page}
        pageSize={perPage}
        total={total}
        itemLabel="người dùng"
        onChange={setPage}
      />

      <Modal
        title={editingUser ? "Sửa người dùng" : "Thêm người dùng"}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        width={920}
        centered
        getContainer={false}
        mask={{ closable: false }}
        closable={!isSaving}
      >
        <form onSubmit={handleSubmit}>
          {formError ? (
            <div className="alert" role="alert" style={{ marginBottom: 14 }}>
              {formError}
            </div>
          ) : null}

          <div className="grid-2">
            <section className="card">
              <div className="section-title">Thông tin tài khoản</div>
              <div className="field">
                <label htmlFor="iam-display-name">Họ và tên *</label>
                <input
                  id="iam-display-name"
                  className="input"
                  style={{ width: "100%" }}
                  value={formState.displayName}
                  onChange={(event) =>
                    updateField("displayName", event.target.value)
                  }
                  autoFocus
                  disabled={isSaving}
                />
              </div>
              <div className="field">
                <label htmlFor="iam-username">Tên đăng nhập *</label>
                <input
                  id="iam-username"
                  className="input"
                  style={{ width: "100%" }}
                  value={formState.username}
                  onChange={(event) =>
                    updateField("username", event.target.value)
                  }
                  autoComplete="off"
                  disabled={isSaving}
                />
              </div>
              <div className="field">
                <label htmlFor="iam-phone">Số điện thoại</label>
                <input
                  id="iam-phone"
                  className="input"
                  style={{ width: "100%" }}
                  value={formState.phone}
                  onChange={(event) =>
                    updateField(
                      "phone",
                      event.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  inputMode="numeric"
                  maxLength={10}
                  disabled={isSaving}
                />
              </div>
              <div className="field">
                <label htmlFor="iam-email">Email</label>
                <input
                  id="iam-email"
                  className="input"
                  style={{ width: "100%" }}
                  type="email"
                  value={formState.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  autoComplete="off"
                  disabled={isSaving}
                />
              </div>
              <div className="field">
                <label htmlFor="iam-status">Trạng thái *</label>
                <select
                  id="iam-status"
                  className="select"
                  style={{ width: "100%" }}
                  value={formState.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as IamUserStatus)
                  }
                  disabled={isSaving}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="card">
              <div className="section-title">Phân quyền</div>
              <div className="field">
                <label htmlFor="iam-role">Vai trò *</label>
                <select
                  id="iam-role"
                  className="select"
                  style={{ width: "100%" }}
                  value={formState.roleId}
                  onChange={(event) =>
                    updateField("roleId", event.target.value)
                  }
                  disabled={isSaving || roles.length === 0 || isEditingSelf}
                >
                  <option value="">Chọn vai trò</option>
                  {roles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
                {isEditingSelf ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    Không thể tự đổi vai trò của chính mình. Nhờ một quản trị viên khác thực hiện thay đổi này.
                  </div>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="iam-scope">Phạm vi dữ liệu *</label>
                <select
                  id="iam-scope"
                  className="select"
                  style={{ width: "100%" }}
                  value={formState.scopeRef}
                  onChange={(event) =>
                    updateField("scopeRef", event.target.value)
                  }
                  disabled={isSaving || isEditingSelf}
                >
                  <option value="">Toàn hệ thống (không giới hạn kho)</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.label}
                    </option>
                  ))}
                </select>
                <div className="muted" style={{ marginTop: 6 }}>
                  Phạm vi được gán tường minh theo kho. Loại phạm vi của vai trò đang chọn: {scopeTypeLabel(selectedRole?.scope_type)}.
                </div>
              </div>
              <div className="field">
                <label htmlFor="iam-effective-from">Hiệu lực từ</label>
                <input
                  id="iam-effective-from"
                  className="input"
                  style={{ width: "100%" }}
                  type="date"
                  value={formState.effectiveFrom}
                  onChange={(event) =>
                    updateField("effectiveFrom", event.target.value)
                  }
                  disabled={isSaving || isEditingSelf}
                />
              </div>
              <div className="field">
                <label htmlFor="iam-effective-to">Hiệu lực đến</label>
                <input
                  id="iam-effective-to"
                  className="input"
                  style={{ width: "100%" }}
                  type="date"
                  value={formState.effectiveTo}
                  min={formState.effectiveFrom || undefined}
                  onChange={(event) =>
                    updateField("effectiveTo", event.target.value)
                  }
                  disabled={isSaving || isEditingSelf}
                />
              </div>
              <div className="field">
                <label htmlFor="iam-password">
                  {editingUser ? "Mật khẩu tạm / đặt lại" : "Mật khẩu tạm *"}
                </label>
                <input
                  id="iam-password"
                  className="input"
                  style={{ width: "100%" }}
                  type="password"
                  value={formState.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder={
                    editingUser
                      ? "Để trống nếu không đổi mật khẩu"
                      : "Tối thiểu 8 ký tự"
                  }
                  disabled={isSaving}
                />
              </div>
              {editingUser ? (
                <div className="field">
                  <label>Phiên bản dữ liệu</label>
                  <div className="value">{editingUser.version}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Hệ thống dùng phiên bản hiện tại để ngăn ghi đè khi có thay đổi đồng thời.
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="spacer" />
            <button
              className="btn"
              type="button"
              onClick={closeModal}
              disabled={isSaving}
            >
              <CloseOutlined /> Hủy
            </button>
            <button
              className="btn primary"
              type="submit"
              disabled={isSaving || !formState.roleId}
            >
              <SaveOutlined /> {isSaving ? "Đang lưu..." : "Lưu người dùng"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Chi tiết người dùng"
        open={Boolean(viewingUser)}
        onCancel={closeView}
        footer={null}
        width={760}
        centered
        destroyOnHidden
        getContainer={false}
      >
        {viewingUser ? (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={{ xs: 1, md: 2 }} size="small">
              <Descriptions.Item label="Họ và tên">
                {viewingUser.display_name}
              </Descriptions.Item>
              <Descriptions.Item label="Tên đăng nhập">
                {viewingUser.username}
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {viewingUser.phone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {viewingUser.email || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <span className={statusClass(viewingUser.status)}>
                  {statusLabel(viewingUser.status)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Đăng nhập cuối">
                {formatLastLogin(viewingUser.last_login_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Phiên bản dữ liệu">
                {viewingUser.version}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <div className="section-title">
                Vai trò &amp; phạm vi ({viewingUser.roles?.length ?? 0})
              </div>
              {viewingUser.roles && viewingUser.roles.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Vai trò</th>
                      <th>Phạm vi</th>
                      <th>Hiệu lực</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingUser.roles.map((role) => (
                      <tr key={role.role_id}>
                        <td>
                          {role.role_name}
                          <br />
                          <Tag>{scopeTypeLabel(role.scope_type)}</Tag>
                        </td>
                        <td>{scopeLabel(role, warehouseNames)}</td>
                        <td>{effectiveWindowLabel(role.pivot)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <span className="muted">Chưa gán vai trò nào.</span>
              )}
            </div>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}