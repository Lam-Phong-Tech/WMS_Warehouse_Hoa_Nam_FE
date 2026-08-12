import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal } from "antd";
import {
  useCreateIamUser,
  useIamRoles,
  useIamUsers,
  useUpdateIamUser,
} from "@/modules/iam/hooks/use-iam";
import type {
  IamRole,
  IamUser,
  IamUserStatus,
} from "@/modules/iam/types/iam.types";
import { getApiErrorMessage, getMutationErrorMessage } from "@/shared/api/api-error";
import { useAuthStore } from "@/shared/store/auth.store";

const STATUS_OPTIONS: Array<{ value: IamUserStatus; label: string }> = [
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Tạm ngưng" },
  { value: "LOCKED", label: "Đã khóa" },
];

type UserFormState = {
  displayName: string;
  username: string;
  phone: string;
  email: string;
  roleId: string;
  status: IamUserStatus;
  password: string;
};

const EMPTY_FORM: UserFormState = {
  displayName: "",
  username: "",
  phone: "",
  email: "",
  roleId: "",
  status: "ACTIVE",
  password: "",
};

function statusLabel(status: IamUserStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function statusClass(status: IamUserStatus) {
  if (status === "ACTIVE") return "pill ok";
  if (status === "LOCKED") return "pill danger-pill";
  return "pill warn-pill";
}

function scopeLabel(role?: IamRole) {
  if (!role) return "Chưa gán";
  if (role.pivot?.scope_ref) return role.pivot.scope_ref;
  if (role.scope_type === "WAREHOUSE") return "Theo kho";
  if (role.scope_type === "FUNCTION") return "Theo chức năng";
  return "Toàn hệ thống";
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
  /** Legacy IAM-02 deep links open the create modal on IAM-01 instead of routing to a separate page. */
  openCreateOnMount?: boolean;
}

export function IamUserScreen({ openCreateOnMount = false }: IamUserScreenProps) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const canManageUsers =
    isSuperAdmin || permissionCodes.includes("iam.user.manage");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<IamUserStatus | "">("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<IamUser | null>(null);
  const [formState, setFormState] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const usersQuery = useIamUsers({
    keyword: search.trim(),
    status: statusFilter,
    per_page: 100,
  });
  const rolesQuery = useIamRoles();
  const createUser = useCreateIamUser();
  const updateUser = useUpdateIamUser();

  const roles = rolesQuery.data ?? [];
  const users = usersQuery.data?.data ?? [];
  const isSaving = createUser.isPending || updateUser.isPending;

  const filteredUsers = useMemo(() => {
    if (!roleFilter) return users;
    return users.filter((user) =>
      user.roles?.some((role) => role.role_id === roleFilter),
    );
  }, [roleFilter, users]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.role_id === formState.roleId),
    [formState.roleId, roles],
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

  useEffect(() => {
    if (!openCreateOnMount || !canManageUsers) return;
    setEditingUser(null);
    setFormState({
      ...EMPTY_FORM,
      roleId: roles[0]?.role_id ?? "",
    });
    setFormError("");
    setIsModalOpen(true);
  }, [canManageUsers, openCreateOnMount, roles]);

  const openEdit = (user: IamUser) => {
    if (!canManageUsers) return;
    setEditingUser(user);
    setFormState({
      displayName: user.display_name,
      username: user.username,
      phone: user.phone ?? "",
      email: user.email ?? "",
      roleId: user.roles?.[0]?.role_id ?? roles[0]?.role_id ?? "",
      status: user.status,
      password: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingUser(null);
    setFormError("");
  };

  const updateField = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
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

    const basePayload = {
      display_name: displayName,
      username,
      email: email || null,
      phone: phone || null,
      status: formState.status,
      ...(password ? { password } : {}),
    };

    try {
      if (editingUser) {
        await updateUser.mutateAsync({
          userId: editingUser.user_id,
          roleId: formState.roleId,
          payload: {
            ...basePayload,
            version: editingUser.version,
          },
        });
      } else {
        await createUser.mutateAsync({
          roleId: formState.roleId,
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
    ? getApiErrorMessage(usersQuery.error, "Không tải được danh sách người dùng.")
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
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm tên / tên đăng nhập"
          aria-label="Tìm người dùng"
        />
        <select
          className="select"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
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
          onChange={(event) =>
            setStatusFilter(event.target.value as IamUserStatus | "")
          }
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
            + Thêm người dùng
          </button>
        ) : null}
      </div>

      {listError ? (
        <div className="alert" role="alert" style={{ marginBottom: 14 }}>
          {listError}{" "}
          <button className="btn small" type="button" onClick={() => usersQuery.refetch()}>
            Thử lại
          </button>
        </div>
      ) : null}
      {roleError ? (
        <div className="alert" role="alert" style={{ marginBottom: 14 }}>
          {roleError}
        </div>
      ) : null}

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
                  <span className="muted">Đang tải dữ liệu từ API...</span>
                </td>
              </tr>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const primaryRole = user.roles?.[0];
                return (
                  <tr key={user.user_id}>
                    <td>
                      {user.display_name}
                      <br />
                      <span className="muted">{user.username}</span>
                    </td>
                    <td>{primaryRole?.role_name ?? "Chưa gán"}</td>
                    <td>{scopeLabel(primaryRole)}</td>
                    <td>
                      <span className={statusClass(user.status)}>{statusLabel(user.status)}</span>
                    </td>
                    <td>{formatLastLogin(user.last_login_at)}</td>
                    <td>
                      {canManageUsers ? (
                        <button className="btn small" type="button" onClick={() => openEdit(user)}>
                          Sửa
                        </button>
                      ) : (
                        <span className="muted">Chỉ xem</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6}>
                  <span className="muted">Không có người dùng phù hợp bộ lọc.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        title={editingUser ? "Sửa người dùng" : "Thêm người dùng"}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        width={920}
        centered
        getContainer={false}
        maskClosable={false}
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
                  onChange={(event) => updateField("displayName", event.target.value)}
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
                  onChange={(event) => updateField("username", event.target.value)}
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
                  onChange={(event) => updateField("phone", event.target.value)}
                  inputMode="tel"
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
                  onChange={(event) => updateField("status", event.target.value as IamUserStatus)}
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
                  onChange={(event) => updateField("roleId", event.target.value)}
                  disabled={isSaving || roles.length === 0}
                >
                  <option value="">Chọn vai trò</option>
                  {roles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Phạm vi dữ liệu</label>
                <div className="value">{scopeLabel(selectedRole)}</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Phạm vi hiện lấy từ scope_type của role backend; API m1 chưa hỗ trợ chỉnh scope_ref riêng theo user.
                </div>
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
                  onChange={(event) => updateField("password", event.target.value)}
                  autoComplete="new-password"
                  placeholder={editingUser ? "Để trống nếu không đổi mật khẩu" : "Tối thiểu 8 ký tự"}
                  disabled={isSaving}
                />
              </div>
              {editingUser ? (
                <div className="field">
                  <label>Version</label>
                  <div className="value">{editingUser.version}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    FE gửi version hiện tại để backend chặn ghi đè khi có xung đột đồng thời.
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="spacer" />
            <button className="btn" type="button" onClick={closeModal} disabled={isSaving}>
              Hủy
            </button>
            <button className="btn primary" type="submit" disabled={isSaving || !formState.roleId}>
              {isSaving ? "Đang lưu..." : "Lưu người dùng"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
