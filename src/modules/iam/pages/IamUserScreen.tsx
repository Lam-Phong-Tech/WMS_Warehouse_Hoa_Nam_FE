import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal } from "antd";
import {
  CloseOutlined,
  EditOutlined,
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
  /** BR-IAM-08: id kho mà vai trò có hiệu lực; rỗng = toàn hệ thống. */
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
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function statusClass(status: IamUserStatus) {
  if (status === "ACTIVE") return "pill ok";
  if (status === "LOCKED") return "pill danger-pill";
  return "pill warn-pill";
}

/**
 * SCR-IAM-01 cột "Phạm vi": scope_ref trỏ tới kho (ERD user_roles). Hiển thị tên
 * kho thay vì uuid; không có scope_ref nghĩa là vai trò áp toàn hệ thống.
 */
function scopeLabel(role: IamRole | undefined, warehouseNames: Map<string, string>) {
  if (!role) return "Chưa gán";
  const scopeRef = role.pivot?.scope_ref;
  if (scopeRef) return warehouseNames.get(scopeRef) ?? scopeRef;
  if (role.scope_type === "WAREHOUSE") return "Mọi kho";
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

  const usersQuery = useIamUsers({
    keyword: search.trim(),
    status: statusFilter,
    page: roleFilter ? 1 : page,
    per_page: roleFilter ? 100 : perPage,
  });
  const rolesQuery = useIamRoles({ per_page: 100 });
  // BR-IAM-08: phạm vi dữ liệu gán theo kho, nên cần danh sách kho để chọn.
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

  // SCR-IAM-01 (no self-escalation): BE luôn từ chối POST /users/{own_id}/roles
  // bất kể giá trị mới là gì, nên khoá luôn ô chọn vai trò khi đang sửa chính
  // tài khoản actor thay vì để họ đổi rồi mới nhận lỗi 409 lúc submit.
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

  // Dep phải là string ổn định: `roles` là mảng fallback `?? []` đổi identity
  // mỗi render — để nguyên trong deps sẽ tạo vòng setState -> render -> effect
  // vô hạn (test IamUserScreen từng OOM 4GB vì đúng vòng lặp này).
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

    const basePayload = {
      display_name: displayName,
      username,
      email: email || null,
      phone: phone || null,
      status: formState.status,
      ...(password ? { password } : {}),
    };

    // BR-IAM-08 "scope assignment explicit": gửi kèm scope_ref + cửa sổ hiệu lực.
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
                  <span className="muted">Đang tải dữ liệu từ API...</span>
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
                      {canManageUsers ? (
                        <button
                          className="btn small"
                          type="button"
                          onClick={() => openEdit(user)}
                        >
                          <EditOutlined /> Sửa
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
                    Không thể tự đổi vai trò của chính mình (SCR-IAM-01 — chống
                    tự leo thang đặc quyền). Nhờ một quản trị viên khác thực
                    hiện thay đổi này.
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
                  BR-IAM-08: phạm vi được gán tường minh theo kho. Vai trò đang
                  chọn có scope_type “{selectedRole?.scope_type ?? "—"}”.
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
                  <label>Version</label>
                  <div className="value">{editingUser.version}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    FE gửi version hiện tại để backend chặn ghi đè khi có xung
                    đột đồng thời.
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
    </div>
  );
}
