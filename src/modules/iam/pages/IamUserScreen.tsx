import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal } from "antd";

type UserStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

type UserRecord = {
  id: string;
  displayName: string;
  username: string;
  phone: string;
  email: string;
  role: string;
  scope: string;
  status: UserStatus;
  lastLogin: string;
  note: string;
};

type UserFormState = Omit<UserRecord, "id" | "lastLogin"> & {
  password: string;
};

const ROLE_OPTIONS = [
  "Admin hệ thống",
  "Quản lý kho",
  "Nhân viên kho",
  "Nhân viên bảo hành",
  "Lãnh đạo",
];

const SCOPE_OPTIONS = [
  "Toàn hệ thống",
  "Kho tổng Hoa Nam",
  "Bảo hành",
  "Chỉ xem báo cáo",
];

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Tạm ngưng" },
  { value: "LOCKED", label: "Đã khóa" },
];

const INITIAL_USERS: UserRecord[] = [
  {
    id: "iam-demo-warehouse",
    displayName: "Nguyễn Văn Kho",
    username: "nvkho01",
    phone: "0901234567",
    email: "nvkho01@hoanam.vn",
    role: "Nhân viên kho",
    scope: "Kho tổng Hoa Nam",
    status: "ACTIVE",
    lastLogin: "10/08/2026 08:14",
    note: "Tài khoản dùng cho khu nhập hàng",
  },
  {
    id: "iam-demo-warranty",
    displayName: "Lê Thu Bảo Hành",
    username: "warranty02",
    phone: "0902345678",
    email: "warranty02@hoanam.vn",
    role: "Nhân viên bảo hành",
    scope: "Bảo hành",
    status: "ACTIVE",
    lastLogin: "09/08/2026 16:02",
    note: "Tài khoản tiếp nhận và xử lý bảo hành",
  },
  {
    id: "iam-demo-leadership",
    displayName: "Trần Lãnh Đạo",
    username: "report01",
    phone: "",
    email: "report01@hoanam.vn",
    role: "Lãnh đạo",
    scope: "Chỉ xem báo cáo",
    status: "INACTIVE",
    lastLogin: "08/08/2026 09:30",
    note: "Tài khoản chỉ xem báo cáo",
  },
];

const EMPTY_FORM: UserFormState = {
  displayName: "",
  username: "",
  phone: "",
  email: "",
  role: "Nhân viên kho",
  scope: "Kho tổng Hoa Nam",
  status: "ACTIVE",
  note: "",
  password: "",
};

function statusLabel(status: UserStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function statusClass(status: UserStatus) {
  if (status === "ACTIVE") return "pill ok";
  if (status === "LOCKED") return "pill danger-pill";
  return "pill warn-pill";
}

function newUserId() {
  return `iam-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface IamUserScreenProps {
  /** Legacy IAM-02 deep links open the create modal on IAM-01 instead of routing to a separate page. */
  openCreateOnMount?: boolean;
}

export function IamUserScreen({ openCreateOnMount = false }: IamUserScreenProps) {
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!openCreateOnMount) return;
    setEditingId(null);
    setFormState({ ...EMPTY_FORM });
    setFormError("");
    setIsModalOpen(true);
  }, [openCreateOnMount]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi-VN");
    return users.filter((user) => {
      const matchesKeyword =
        !keyword ||
        user.displayName.toLocaleLowerCase("vi-VN").includes(keyword) ||
        user.username.toLocaleLowerCase("vi-VN").includes(keyword);
      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesStatus = !statusFilter || user.status === statusFilter;
      return matchesKeyword && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const openCreate = () => {
    setEditingId(null);
    setFormState({ ...EMPTY_FORM });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditingId(user.id);
    setFormState({
      displayName: user.displayName,
      username: user.username,
      phone: user.phone,
      email: user.email,
      role: user.role,
      scope: user.scope,
      status: user.status,
      note: user.note,
      password: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormError("");
  };

  const updateField = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const displayName = formState.displayName.trim();
    const username = formState.username.trim();
    const email = formState.email.trim();

    if (!displayName || !username || !formState.role || !formState.scope || !formState.status) {
      setFormError("Vui lòng nhập đầy đủ các trường bắt buộc.");
      return;
    }

    const duplicatedUsername = users.some(
      (user) =>
        user.id !== editingId &&
        user.username.toLocaleLowerCase("vi-VN") === username.toLocaleLowerCase("vi-VN"),
    );
    if (duplicatedUsername) {
      setFormError("Tên đăng nhập đã tồn tại. Vui lòng chọn tên đăng nhập khác.");
      return;
    }

    const duplicatedEmail =
      email.length > 0 &&
      users.some(
        (user) =>
          user.id !== editingId &&
          user.email &&
          user.email.toLocaleLowerCase("vi-VN") === email.toLocaleLowerCase("vi-VN"),
      );
    if (duplicatedEmail) {
      setFormError("Email đã tồn tại. Vui lòng kiểm tra lại.");
      return;
    }

    if (editingId) {
      setUsers((current) =>
        current.map((user) =>
          user.id === editingId
            ? {
                ...user,
                displayName,
                username,
                phone: formState.phone.trim(),
                email,
                role: formState.role,
                scope: formState.scope,
                status: formState.status,
                note: formState.note.trim(),
              }
            : user,
        ),
      );
    } else {
      setUsers((current) => [
        {
          id: newUserId(),
          displayName,
          username,
          phone: formState.phone.trim(),
          email,
          role: formState.role,
          scope: formState.scope,
          status: formState.status,
          lastLogin: "Chưa đăng nhập",
          note: formState.note.trim(),
        },
        ...current,
      ]);
    }

    closeModal();
  };

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
        >
          <option value="">Vai trò: Tất cả</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
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
        <button className="btn primary" type="button" onClick={openCreate}>
          + Thêm người dùng
        </button>
      </div>

      <div className="table-wrap">
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
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.displayName}
                    <br />
                    <span className="muted">{user.username}</span>
                  </td>
                  <td>{user.role}</td>
                  <td>{user.scope}</td>
                  <td>
                    <span className={statusClass(user.status)}>{statusLabel(user.status)}</span>
                  </td>
                  <td>{user.lastLogin}</td>
                  <td>
                    <button className="btn small" type="button" onClick={() => openEdit(user)}>
                      Sửa
                    </button>
                  </td>
                </tr>
              ))
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
        title={editingId ? "Sửa người dùng" : "Thêm người dùng"}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        width={920}
        centered
        getContainer={false}
        maskClosable={false}
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
                />
              </div>
              <div className="field">
                <label htmlFor="iam-status">Trạng thái *</label>
                <select
                  id="iam-status"
                  className="select"
                  style={{ width: "100%" }}
                  value={formState.status}
                  onChange={(event) => updateField("status", event.target.value as UserStatus)}
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
                  value={formState.role}
                  onChange={(event) => updateField("role", event.target.value)}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="iam-scope">Phạm vi dữ liệu *</label>
                <select
                  id="iam-scope"
                  className="select"
                  style={{ width: "100%" }}
                  value={formState.scope}
                  onChange={(event) => updateField("scope", event.target.value)}
                >
                  {SCOPE_OPTIONS.map((scope) => (
                    <option key={scope} value={scope}>
                      {scope}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="iam-password">
                  {editingId ? "Mật khẩu tạm / đặt lại" : "Mật khẩu tạm"}
                </label>
                <input
                  id="iam-password"
                  className="input"
                  style={{ width: "100%" }}
                  type="password"
                  value={formState.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  placeholder={editingId ? "Để trống nếu không đặt lại" : "Nhập mật khẩu tạm"}
                  autoComplete="new-password"
                />
              </div>
              <div className="field">
                <label htmlFor="iam-note">Ghi chú</label>
                <textarea
                  id="iam-note"
                  className="textarea"
                  value={formState.note}
                  onChange={(event) => updateField("note", event.target.value)}
                />
              </div>
              <div className="alert">
                Thay đổi vai trò/phạm vi phải được backend kiểm tra quyền và ghi audit; giao diện không thay thế kiểm soát RBAC phía server.
              </div>
            </section>
          </div>

          <div className="toolbar" style={{ marginTop: 16, marginBottom: 0, justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={closeModal}>
              Hủy
            </button>
            <button className="btn primary" type="submit">
              Lưu người dùng
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
