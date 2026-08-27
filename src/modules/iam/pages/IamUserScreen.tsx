import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import {
  useCreateIamUser,
  useGrantIamUserPermission,
  useIamDepartments,
  useIamPermissions,
  useIamRoles,
  useIamScopeWarehouses,
  useIamUserPermissionOverrides,
  useIamUsers,
  useRevokeIamUserPermission,
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
  resolveFormErrors,
} from "@/shared/api/api-error";
import { MvpPaginationFooter } from "@/shared/components/mvp/MvpListPagination";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
import {
  MvpSelectionCheckbox,
  mvpRowNumber,
} from "@/shared/components/mvp/MvpSelectionCell";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import {
  IAM_SCOPE_TYPE_LABELS,
  IAM_USER_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { useAuthStore } from "@/shared/store/auth.store";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

/**
 * Toolbar filter cần nhỏ gọn hơn field trong form (theo yêu cầu người dùng) —
 * override padding cục bộ, tách khỏi padding mặc định trong theme dùng cho
 * TextField/Select trong Dialog.
 */
const TOOLBAR_CONTROL_SX = {
  // Ép chiều cao tuyệt đối để Select (có icon mũi tên) và TextField luôn cao
  // bằng nhau. Lưu ý: với TextField, sx mặc định áp vào .MuiFormControl-root
  // (khung bọc ngoài) chứ KHÔNG phải khung viền thực sự nhìn thấy
  // (.MuiOutlinedInput-root) — nên phải khai riêng bằng selector con "&
  // .MuiOutlinedInput-root". Với Select (không có FormControl bọc ngoài), gốc
  // sx CHÍNH LÀ khung viền nên dùng "&" tự tham chiếu. Khai cả hai để 1 khối
  // sx dùng chung được cho mọi loại control trong toolbar.
  "&, & .MuiOutlinedInput-root": {
    height: 35,
  },
  "& .MuiSelect-select, & .MuiInputBase-input": {
    paddingTop: "8px !important",
    paddingBottom: "8px !important",
    fontSize: "13.5px !important",
    boxSizing: "border-box",
  },
};

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
  /** REQ-011: department_id — optional, "" nghĩa là không thuộc phòng ban nào. */
  departmentId: string;
  roleId: string;
  scopeRef: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: IamUserStatus;
  password: string;
  /** Yêu cầu nghiệp vụ: mọi lần sửa vai trò/quyền phải ghi lại lý do để truy vết. */
  reason: string;
};

const EMPTY_FORM: UserFormState = {
  displayName: "",
  username: "",
  phone: "",
  email: "",
  departmentId: "",
  roleId: "",
  scopeRef: "",
  effectiveFrom: "",
  effectiveTo: "",
  status: "ACTIVE",
  password: "",
  reason: "",
};

/**
 * Các ô nhập có chỗ hiển thị lỗi riêng (`error` + `helperText`) trong modal.
 * Lỗi server thuộc field nằm ngoài danh sách này sẽ rơi về banner tổng —
 * xem `resolveFormErrors`. Tên field ở dạng camelCase vì `extractFieldErrors`
 * đã chuyển snake_case của BE (`display_name`) sang camelCase (`displayName`).
 */
const USER_FORM_FIELDS = [
  "displayName",
  "username",
  "phone",
  "email",
  "roleId",
  "password",
  "reason",
] as const satisfies readonly (keyof UserFormState)[];

function statusLabel(status: IamUserStatus) {
  return businessLabel(IAM_USER_STATUS_LABELS, status);
}

function statusClass(status: IamUserStatus) {
  if (status === "ACTIVE") return "pill ok";
  if (status === "LOCKED") return "pill danger-pill";
  return "pill warn-pill";
}

/** Màu Chip trạng thái dùng trong Dialog MUI (thay class .pill — mất tác dụng vì Dialog render qua portal, ngoài phạm vi CSS .hn-mvp-source-screen). */
function statusChipColor(
  status: IamUserStatus,
): "success" | "error" | "warning" {
  if (status === "ACTIVE") return "success";
  if (status === "LOCKED") return "error";
  return "warning";
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

function effectiveWindowLabel(pivot?: IamRolePivot) {
  const hasFrom = Boolean(pivot?.effective_from);
  const hasTo = Boolean(pivot?.effective_to);
  if (!hasFrom && !hasTo) return "Vô thời hạn";
  return `${hasFrom ? formatDate(pivot?.effective_from) : "—"} → ${hasTo ? formatDate(pivot?.effective_to) : "—"}`;
}

function formatLastLogin(value?: string | null) {
  return value ? formatDateTime(value) : "Chưa đăng nhập";
}

/** Cặp nhãn/giá trị dùng trong Dialog "Chi tiết người dùng" (thay antd Descriptions.Item). */
function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </Grid>
  );
}

/** Icon mở rộng cho Accordion — SVG cục bộ, tránh thêm dependency @mui/icons-material. */
function ChevronDownIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<IamUserStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<IamUser | null>(null);
  const [formState, setFormState] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [viewingUser, setViewingUser] = useState<IamUser | null>(null);
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantPermissionId, setGrantPermissionId] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantError, setGrantError] = useState("");
  const [revokingPermissionId, setRevokingPermissionId] = useState<
    string | null
  >(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeError, setRevokeError] = useState("");

  const usersQuery = useIamUsers({
    keyword: search.trim(),
    status: statusFilter,
    // REQ-011: BE user list nhận department_id để lọc phía server.
    department_id: departmentFilter || undefined,
    page: roleFilter ? 1 : page,
    per_page: roleFilter ? 100 : perPage,
  });
  const rolesQuery = useIamRoles({ per_page: 100 });
  const departmentsQuery = useIamDepartments({ status: "ACTIVE" });
  const warehousesQuery = useIamScopeWarehouses();
  const permissionsQuery = useIamPermissions({ per_page: 200 });
  const createUser = useCreateIamUser();
  const updateUser = useUpdateIamUser();
  const overridesQuery = useIamUserPermissionOverrides(viewingUser?.user_id);
  const grantPermission = useGrantIamUserPermission();
  const revokePermission = useRevokeIamUserPermission();
  const overrides = useMemo(
    () => overridesQuery.data ?? [],
    [overridesQuery.data],
  );

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
  const departments = departmentsQuery.data ?? [];
  const departmentNames = useMemo(
    () =>
      new Map(
        departments.map((department) => [
          department.department_id,
          department.department_name,
        ]),
      ),
    [departments],
  );
  const isSaving = createUser.isPending || updateUser.isPending;

  /**
   * REQ-011: tên phòng ban ưu tiên relation eager-load `department` từ user
   * list; user cũ chưa có relation thì tra danh mục theo department_id.
   */
  const departmentLabel = (user: IamUser): string =>
    user.department?.department_name ??
    (user.department_id
      ? (departmentNames.get(user.department_id) ?? user.department_id)
      : "—");

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

  const rowSelection = useRowSelection(displayedUsers, (user) => user.user_id);

  const {
    sortedRows: sortedUsers,
    sortState,
    requestSort,
  } = useClientSort(displayedUsers, {
    name: (user) => user.display_name,
    department: (user) => departmentLabel(user),
    role: (user) => user.roles?.[0]?.role_name,
    scope: (user) => scopeLabel(user.roles?.[0], warehouseNames),
    status: (user) => user.status,
    lastLogin: (user) => user.last_login_at ?? undefined,
  });

  const selectedRole = useMemo(
    () => roles.find((role) => role.role_id === formState.roleId),
    [formState.roleId, roles],
  );

  const isEditingSelf = Boolean(
    editingUser && currentUserId && editingUser.user_id === currentUserId,
  );

  /**
   * REQ-019: "Quyền hiệu lực" = union permission_key của mọi vai trò đang gắn.
   * Nguồn dữ liệu rẻ nhất có sẵn: GET /roles trả kèm permissions từng role
   * (IamRolePermissionScreen cũng dựa vào đây) — ưu tiên permissions nhúng
   * trong user.roles nếu response user có, fallback tra theo role_id.
   */
  const effectivePermissionKeys = useMemo(() => {
    if (!viewingUser) return [];
    const keys = new Set<string>();
    (viewingUser.roles ?? []).forEach((userRole) => {
      const permissions =
        userRole.permissions ??
        roles.find((role) => role.role_id === userRole.role_id)?.permissions ??
        [];
      permissions.forEach((permission) => keys.add(permission.permission_key));
    });
    // Yêu cầu #2/#4: quyền cấp riêng cộng thêm vào quyền theo role, nên "Quyền
    // hiệu lực" hiển thị ở đây phải là hợp của cả hai, không chỉ quyền theo role.
    overrides.forEach((override) => keys.add(override.permission_key));
    return [...keys].sort((a, b) => a.localeCompare(b));
  }, [viewingUser, roles, overrides]);

  const grantablePermissions = useMemo(() => {
    const grantedIds = new Set(overrides.map((o) => o.permission_id));
    return (permissionsQuery.data ?? []).filter(
      (permission) => !grantedIds.has(permission.permission_id),
    );
  }, [permissionsQuery.data, overrides]);

  const openGrantModal = () => {
    setGrantPermissionId("");
    setGrantReason("");
    setGrantError("");
    setIsGrantModalOpen(true);
  };

  const closeGrantModal = () => {
    if (grantPermission.isPending) return;
    setIsGrantModalOpen(false);
  };

  const submitGrantPermission = async () => {
    if (!viewingUser) return;
    if (!grantPermissionId) {
      setGrantError("Vui lòng chọn quyền cần cấp.");
      return;
    }
    if (grantReason.trim().length < 5) {
      setGrantError("Vui lòng nhập lý do (tối thiểu 5 ký tự).");
      return;
    }
    try {
      await grantPermission.mutateAsync({
        userId: viewingUser.user_id,
        payload: {
          permission_id: grantPermissionId,
          reason: grantReason.trim(),
        },
      });
      setIsGrantModalOpen(false);
    } catch (error) {
      setGrantError(getMutationErrorMessage(error));
    }
  };

  const openRevokeConfirm = (permissionId: string) => {
    setRevokingPermissionId(permissionId);
    setRevokeReason("");
    setRevokeError("");
  };

  const closeRevokeConfirm = () => {
    if (revokePermission.isPending) return;
    setRevokingPermissionId(null);
  };

  const submitRevokePermission = async () => {
    if (!viewingUser || !revokingPermissionId) return;
    if (revokeReason.trim().length < 5) {
      setRevokeError("Vui lòng nhập lý do (tối thiểu 5 ký tự).");
      return;
    }
    try {
      await revokePermission.mutateAsync({
        userId: viewingUser.user_id,
        permissionId: revokingPermissionId,
        reason: revokeReason.trim(),
      });
      setRevokingPermissionId(null);
    } catch (error) {
      setRevokeError(getMutationErrorMessage(error));
    }
  };

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
    setFieldErrors({});
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
    setFieldErrors({});
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
      departmentId: user.department_id ?? "",
      roleId: primaryRole?.role_id ?? roles[0]?.role_id ?? "",
      scopeRef: primaryRole?.pivot?.scope_ref ?? "",
      effectiveFrom: primaryRole?.pivot?.effective_from?.slice(0, 10) ?? "",
      effectiveTo: primaryRole?.pivot?.effective_to?.slice(0, 10) ?? "",
      status: user.status,
      password: "",
      reason: "",
    });
    setFormError("");
    setFieldErrors({});
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
    setFieldErrors({});
  };

  const updateField = <K extends keyof UserFormState>(
    key: K,
    value: UserFormState[K],
  ) => {
    setFormState((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const displayName = formState.displayName.trim();
    const username = formState.username.trim();
    const phone = formState.phone.trim();
    const password = formState.password;

    if (!displayName) {
      errors.displayName = "Vui lòng nhập họ và tên.";
    }
    if (!username) {
      errors.username = "Vui lòng nhập tên đăng nhập.";
    }
    if (!formState.roleId) {
      errors.roleId = "Vui lòng chọn vai trò.";
    }
    if (!editingUser && password.length < 8) {
      const passwordTooShortMessage = "Mật khẩu tạm phải có ít nhất 8 ký tự.";
      errors.password = passwordTooShortMessage;
    } else if (editingUser && password && password.length < 8) {
      const passwordTooShortMessage = "Mật khẩu đặt lại phải có ít nhất 8 ký tự.";
      errors.password = passwordTooShortMessage;
    }
    if (phone && !/^0\d{9}$/.test(phone)) {
      errors.phone =
        "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.";
    }
    if (formState.reason.trim().length < 5) {
      errors.reason =
        "Vui lòng nhập lý do (tối thiểu 5 ký tự) để lưu vết thay đổi.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!validateForm()) return;

    const displayName = formState.displayName.trim();
    const username = formState.username.trim().toLowerCase();
    const email = formState.email.trim();
    const phone = formState.phone.trim();
    const password = formState.password;

    const basePayload = {
      display_name: displayName,
      username,
      email: email || null,
      phone: phone || null,
      // REQ-011: optional — null gỡ user khỏi phòng ban (BE Store/UpdateUserRequest nhận).
      department_id: formState.departmentId || null,
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
    const reason = formState.reason.trim();

    try {
      if (editingUser) {
        await updateUser.mutateAsync({
          userId: editingUser.user_id,
          assignment,
          reason,
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
          reason,
          payload: {
            ...basePayload,
            password,
          },
        });
      }
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      // Lỗi nào gắn được vào ô nhập thì hiện ngay dưới ô đó (vd email trùng),
      // banner chỉ giữ phần không thuộc ô nào — trước đây mọi lỗi đều bị dồn
      // vào banner nên người dùng chỉ thấy "Dữ liệu gửi lên không hợp lệ".
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        error,
        USER_FORM_FIELDS,
      );
      setFieldErrors((current) => ({ ...current, ...serverFieldErrors }));
      setFormError(message ?? "");
    }
  };

  // Giá trị hiện tại (vd: per_page=15 do BE trả về) có thể không nằm trong
  // các mốc chuẩn MVP_PAGE_SIZE_OPTIONS — vẫn phải liệt kê để Select hiển thị đúng.
  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

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
    <ThemeProvider theme={muiTheme}>
      <div className="hn-mvp-source-screen" data-mvp-screen="IAM-01">
        <div className="toolbar">
          <TextField
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm tên / tên đăng nhập"
            slotProps={{ htmlInput: { "aria-label": "Tìm người dùng" } }}
            sx={{ minWidth: 190, ...TOOLBAR_CONTROL_SX }}
          />
          <Select
            displayEmpty
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(1);
            }}
            disabled={rolesQuery.isLoading}
            inputProps={{ "aria-label": "Lọc theo vai trò" }}
            sx={{ minWidth: 128, ...TOOLBAR_CONTROL_SX }}
          >
            <MenuItem value="">Vai trò: Tất cả</MenuItem>
            {roles.map((role) => (
              <MenuItem key={role.role_id} value={role.role_id}>
                {role.role_name}
              </MenuItem>
            ))}
          </Select>
          <Select
            displayEmpty
            value={departmentFilter}
            onChange={(event) => {
              setDepartmentFilter(event.target.value);
              setPage(1);
            }}
            disabled={departmentsQuery.isLoading}
            inputProps={{ "aria-label": "Lọc theo phòng ban" }}
            sx={{ minWidth: 136, ...TOOLBAR_CONTROL_SX }}
          >
            <MenuItem value="">Phòng ban: Tất cả</MenuItem>
            {departments.map((department) => (
              <MenuItem
                key={department.department_id}
                value={department.department_id}
              >
                {department.department_name}
              </MenuItem>
            ))}
          </Select>
          <Select
            displayEmpty
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as IamUserStatus | "");
              setPage(1);
            }}
            inputProps={{ "aria-label": "Lọc theo trạng thái" }}
            sx={{ minWidth: 128, ...TOOLBAR_CONTROL_SX }}
          >
            <MenuItem value="">Trạng thái: Tất cả</MenuItem>
            {STATUS_OPTIONS.map((status) => (
              <MenuItem key={status.value} value={status.value}>
                {status.label}
              </MenuItem>
            ))}
          </Select>
          <Select
            value={perPage}
            onChange={(event) => {
              setPerPage(Number(event.target.value));
              setPage(1);
            }}
            inputProps={{ "aria-label": "Số dòng mỗi trang" }}
            sx={{ minWidth: 92, ...TOOLBAR_CONTROL_SX }}
          >
            {perPageOptions.map((size) => (
              <MenuItem key={size} value={size}>
                {size} / trang
              </MenuItem>
            ))}
          </Select>
          {/* Tổng số dòng đặt ngay trong toolbar (cạnh bộ lọc/số dòng mỗi trang) để
           * dễ thấy — thay vì chỉ hiện ở MvpPaginationFooter tít dưới bảng dài. */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: "nowrap" }}
          ></Typography>
          <div className="spacer" />
          {canManageUsers ? (
            <ActionButton
              kind="create"
              onClick={openCreate}
              disabled={rolesQuery.isLoading || roles.length === 0}
            >
              Thêm người dùng
            </ActionButton>
          ) : null}
        </div>

        {listError ? (
          <Alert
            severity="error"
            sx={{ marginBottom: "14px" }}
            action={
              <ActionButton kind="refresh" onClick={() => usersQuery.refetch()}>
                Thử lại
              </ActionButton>
            }
          >
            {listError}
          </Alert>
        ) : null}
        {roleError ? (
          <Alert severity="error" sx={{ marginBottom: "14px" }}>
            {roleError}
          </Alert>
        ) : null}

        <div className="table-wrap" aria-busy={usersQuery.isLoading}>
          <table>
            <thead>
              <tr>
                <th className="select-col">
                  <MvpSelectionCheckbox
                    checked={rowSelection.isAllSelected}
                    indeterminate={rowSelection.isIndeterminate}
                    onChange={rowSelection.toggleAll}
                    ariaLabel="Chọn tất cả người dùng"
                  />
                </th>
                <th className="stt-col">STT</th>
                <SortableTh
                  label="Người dùng"
                  sortKey="name"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Phòng ban"
                  sortKey="department"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Vai trò"
                  sortKey="role"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Phạm vi"
                  sortKey="scope"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Trạng thái"
                  sortKey="status"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <SortableTh
                  label="Đăng nhập cuối"
                  sortKey="lastLogin"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <th aria-label="Hành động" />
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={9}>
                    <span className="muted">Đang tải dữ liệu...</span>
                  </td>
                </tr>
              ) : sortedUsers.length > 0 ? (
                sortedUsers.map((user, index) => {
                  const primaryRole = user.roles?.[0];
                  return (
                    <tr key={user.user_id}>
                      <td className="select-col">
                        <MvpSelectionCheckbox
                          checked={rowSelection.isSelected(user.user_id)}
                          onChange={(checked) =>
                            rowSelection.toggleOne(user.user_id, checked)
                          }
                          ariaLabel={`Chọn ${user.display_name}`}
                        />
                      </td>
                      <td className="stt-col">
                        {mvpRowNumber(page, perPage, index)}
                      </td>
                      <td>
                        {user.display_name}
                        <br />
                        <span className="muted">{user.username}</span>
                      </td>
                      <td>{departmentLabel(user)}</td>
                      <td>{primaryRole?.role_name ?? "Chưa gán"}</td>
                      <td>{scopeLabel(primaryRole, warehouseNames)}</td>
                      <td>
                        <span className={statusClass(user.status)}>
                          {statusLabel(user.status)}
                        </span>
                      </td>
                      <td>{formatLastLogin(user.last_login_at)}</td>
                      <td>
                        <Stack direction="row" spacing={1}>
                          <ActionButton
                            kind="view"
                            onClick={() => openView(user)}
                          >
                            Xem
                          </ActionButton>
                          {canManageUsers ? (
                            <ActionButton
                              kind="edit"
                              onClick={() => openEdit(user)}
                            >
                              Sửa
                            </ActionButton>
                          ) : null}
                        </Stack>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9}>
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

        <Dialog
          open={isModalOpen}
          onClose={guardBackdropClose(closeModal)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ pr: 6, position: "relative" }}>
            {editingUser ? "Sửa người dùng" : "Thêm người dùng"}
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={closeModal}
              disabled={isSaving}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </DialogTitle>
          <form onSubmit={handleSubmit} noValidate>
            <DialogContent dividers>
              {formError ? (
                <Alert severity="error" sx={{ marginBottom: "14px" }}>
                  {formError}
                </Alert>
              ) : null}

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 2,
                      height: "100%",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, mb: 2 }}
                    >
                      Thông tin tài khoản
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        id="iam-display-name"
                        label="Họ và tên"
                        required
                        fullWidth
                        size="small"
                        value={formState.displayName}
                        onChange={(event) =>
                          updateField("displayName", event.target.value)
                        }
                        autoFocus
                        disabled={isSaving}
                        error={Boolean(fieldErrors.displayName)}
                        helperText={fieldErrors.displayName}
                      />
                      <TextField
                        id="iam-username"
                        label="Tên đăng nhập"
                        required
                        fullWidth
                        size="small"
                        value={formState.username}
                        onChange={(event) =>
                          updateField("username", event.target.value)
                        }
                        autoComplete="off"
                        disabled={isSaving}
                        error={Boolean(fieldErrors.username)}
                        helperText={fieldErrors.username}
                      />
                      <TextField
                        id="iam-phone"
                        label="Số điện thoại"
                        fullWidth
                        size="small"
                        value={formState.phone}
                        onChange={(event) =>
                          updateField(
                            "phone",
                            event.target.value.replace(/\D/g, "").slice(0, 10),
                          )
                        }
                        disabled={isSaving}
                        error={Boolean(fieldErrors.phone)}
                        helperText={fieldErrors.phone}
                        slotProps={{
                          htmlInput: { inputMode: "numeric", maxLength: 10 },
                        }}
                      />
                      <TextField
                        id="iam-email"
                        label="Email"
                        type="email"
                        fullWidth
                        size="small"
                        value={formState.email}
                        onChange={(event) =>
                          updateField("email", event.target.value)
                        }
                        autoComplete="off"
                        disabled={isSaving}
                        error={Boolean(fieldErrors.email)}
                        helperText={fieldErrors.email}
                      />
                      <FormControl
                        fullWidth
                        size="small"
                        disabled={isSaving || departmentsQuery.isLoading}
                      >
                        <InputLabel id="iam-department-label" shrink>
                          Phòng ban
                        </InputLabel>
                        <Select
                          id="iam-department"
                          labelId="iam-department-label"
                          label="Phòng ban"
                          displayEmpty
                          value={formState.departmentId}
                          onChange={(event) =>
                            updateField("departmentId", event.target.value)
                          }
                        >
                          <MenuItem value="">Không thuộc phòng ban</MenuItem>
                          {/* Giữ được lựa chọn hiện tại khi phòng ban đã INACTIVE
                              (danh mục dropdown chỉ nạp phòng ban ACTIVE). */}
                          {formState.departmentId &&
                          !departments.some(
                            (department) =>
                              department.department_id ===
                              formState.departmentId,
                          ) ? (
                            <MenuItem value={formState.departmentId}>
                              {departmentNames.get(formState.departmentId) ??
                                (editingUser?.department?.department_name ||
                                  formState.departmentId)}
                            </MenuItem>
                          ) : null}
                          {departments.map((department) => (
                            <MenuItem
                              key={department.department_id}
                              value={department.department_id}
                            >
                              {department.department_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl
                        fullWidth
                        size="small"
                        required
                        disabled={isSaving}
                      >
                        <InputLabel id="iam-status-label">
                          Trạng thái
                        </InputLabel>
                        <Select
                          id="iam-status"
                          labelId="iam-status-label"
                          label="Trạng thái"
                          value={formState.status}
                          onChange={(event) =>
                            updateField(
                              "status",
                              event.target.value as IamUserStatus,
                            )
                          }
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <MenuItem key={status.value} value={status.value}>
                              {status.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 2,
                      height: "100%",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, mb: 2 }}
                    >
                      Phân quyền
                    </Typography>
                    <Stack spacing={2}>
                      <div>
                        <FormControl
                          fullWidth
                          size="small"
                          required
                          error={Boolean(fieldErrors.roleId)}
                          disabled={
                            isSaving || roles.length === 0 || isEditingSelf
                          }
                        >
                          <InputLabel id="iam-role-label">Vai trò</InputLabel>
                          <Select
                            id="iam-role"
                            labelId="iam-role-label"
                            label="Vai trò"
                            value={formState.roleId}
                            onChange={(event) =>
                              updateField("roleId", event.target.value)
                            }
                          >
                            <MenuItem value="">Chọn vai trò</MenuItem>
                            {roles.map((role) => (
                              <MenuItem key={role.role_id} value={role.role_id}>
                                {role.role_name}
                              </MenuItem>
                            ))}
                          </Select>
                          {fieldErrors.roleId ? (
                            <FormHelperText>
                              {fieldErrors.roleId}
                            </FormHelperText>
                          ) : null}
                        </FormControl>
                        {isEditingSelf ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mt: 0.75 }}
                          >
                            Không thể tự đổi vai trò của chính mình. Nhờ một
                            quản trị viên khác thực hiện thay đổi này.
                          </Typography>
                        ) : null}
                      </div>
                      <div>
                        <FormControl
                          fullWidth
                          size="small"
                          required
                          disabled={isSaving || isEditingSelf}
                        >
                          <InputLabel id="iam-scope-label" shrink>
                            Phạm vi dữ liệu
                          </InputLabel>
                          <Select
                            id="iam-scope"
                            labelId="iam-scope-label"
                            label="Phạm vi dữ liệu"
                            displayEmpty
                            value={formState.scopeRef}
                            onChange={(event) =>
                              updateField("scopeRef", event.target.value)
                            }
                          >
                            <MenuItem value="">
                              Toàn hệ thống (không giới hạn kho)
                            </MenuItem>
                            {warehouses.map((warehouse) => (
                              <MenuItem key={warehouse.id} value={warehouse.id}>
                                {warehouse.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 0.75 }}
                        >
                          Phạm vi được gán tường minh theo kho. Loại phạm vi của
                          vai trò đang chọn:{" "}
                          {scopeTypeLabel(selectedRole?.scope_type)}.
                        </Typography>
                      </div>
                      <TextField
                        id="iam-effective-from"
                        label="Hiệu lực từ"
                        type="date"
                        fullWidth
                        size="small"
                        value={formState.effectiveFrom}
                        onChange={(event) =>
                          updateField("effectiveFrom", event.target.value)
                        }
                        disabled={isSaving || isEditingSelf}
                        helperText="Định dạng: ngày/tháng/năm"
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                      <TextField
                        id="iam-effective-to"
                        label="Hiệu lực đến"
                        type="date"
                        fullWidth
                        size="small"
                        value={formState.effectiveTo}
                        onChange={(event) =>
                          updateField("effectiveTo", event.target.value)
                        }
                        disabled={isSaving || isEditingSelf}
                        helperText="Định dạng: ngày/tháng/năm"
                        slotProps={{
                          htmlInput: {
                            min: formState.effectiveFrom || undefined,
                          },
                          inputLabel: { shrink: true },
                        }}
                      />
                      <TextField
                        id="iam-password"
                        label={
                          editingUser
                            ? "Mật khẩu tạm / đặt lại"
                            : "Mật khẩu tạm"
                        }
                        required={!editingUser}
                        type="password"
                        fullWidth
                        size="small"
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
                        error={Boolean(fieldErrors.password)}
                        helperText={fieldErrors.password}
                      />
                      <TextField
                        id="iam-reason"
                        label="Lý do cập nhật"
                        required
                        multiline
                        minRows={2}
                        fullWidth
                        size="small"
                        value={formState.reason}
                        onChange={(event) =>
                          updateField("reason", event.target.value)
                        }
                        placeholder="Vd: Điều chuyển nhân sự sang phòng ban khác"
                        disabled={isSaving}
                        error={Boolean(fieldErrors.reason)}
                        helperText={
                          fieldErrors.reason ??
                          "Bắt buộc — dùng để truy vết lịch sử thay đổi quyền/vai trò."
                        }
                      />
                      {editingUser ? (
                        <Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mb: 0.5 }}
                          >
                            Phiên bản dữ liệu
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 1.5,
                              px: 1.5,
                              py: 1,
                            }}
                          >
                            {editingUser.version}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mt: 0.75 }}
                          >
                            Hệ thống dùng phiên bản hiện tại để ngăn ghi đè khi
                            có thay đổi đồng thời.
                          </Typography>
                        </Box>
                      ) : null}
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <ActionButton
                kind="cancel"
                onClick={closeModal}
                disabled={isSaving}
              >
                Hủy
              </ActionButton>
              <ActionButton
                kind="save"
                disabled={isSaving || !formState.roleId}
                type="submit"
              >
                {isSaving ? "Đang lưu..." : "Lưu người dùng"}
              </ActionButton>
            </DialogActions>
          </form>
        </Dialog>

        <Dialog
          open={Boolean(viewingUser)}
          onClose={closeView}
          maxWidth="sm"
          fullWidth
          slotProps={{ paper: { sx: { maxWidth: 760 } } }}
        >
          <DialogTitle sx={{ pr: 6, position: "relative" }}>
            Chi tiết người dùng
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={closeView}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </DialogTitle>
          <DialogContent dividers>
            {viewingUser ? (
              <Stack spacing={2}>
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Grid container spacing={2}>
                    <DetailField
                      label="Họ và tên"
                      value={viewingUser.display_name}
                    />
                    <DetailField
                      label="Tên đăng nhập"
                      value={viewingUser.username}
                    />
                    <DetailField
                      label="Số điện thoại"
                      value={viewingUser.phone || "—"}
                    />
                    <DetailField
                      label="Email"
                      value={viewingUser.email || "—"}
                    />
                    <DetailField
                      label="Phòng ban"
                      value={departmentLabel(viewingUser)}
                    />
                    <DetailField
                      label="Trạng thái"
                      value={
                        <Chip
                          label={statusLabel(viewingUser.status)}
                          color={statusChipColor(viewingUser.status)}
                          size="small"
                        />
                      }
                    />
                    <DetailField
                      label="Đăng nhập cuối"
                      value={formatLastLogin(viewingUser.last_login_at)}
                    />
                    <DetailField
                      label="Phiên bản dữ liệu"
                      value={viewingUser.version}
                    />
                  </Grid>
                </Box>

                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 1 }}
                  >
                    Vai trò &amp; phạm vi ({viewingUser.roles?.length ?? 0})
                  </Typography>
                  {viewingUser.roles && viewingUser.roles.length > 0 ? (
                    <Box
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Vai trò</TableCell>
                            <TableCell>Phạm vi</TableCell>
                            <TableCell>Hiệu lực</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {viewingUser.roles.map((role) => (
                            <TableRow key={role.role_id}>
                              <TableCell>
                                <Stack
                                  spacing={0.5}
                                  sx={{ alignItems: "flex-start" }}
                                >
                                  <Typography variant="body2">
                                    {role.role_name}
                                  </Typography>
                                  <Chip
                                    label={scopeTypeLabel(role.scope_type)}
                                    size="small"
                                  />
                                </Stack>
                              </TableCell>
                              <TableCell>
                                {scopeLabel(role, warehouseNames)}
                              </TableCell>
                              <TableCell>
                                {effectiveWindowLabel(role.pivot)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Chưa gán vai trò nào.
                    </Typography>
                  )}
                </Box>

                <Box>
                  <Stack
                    direction="row"
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Quyền cấp riêng ({overrides.length})
                    </Typography>
                    {canManageUsers ? (
                      <ActionButton kind="grant" onClick={openGrantModal}>
                        + Cấp quyền
                      </ActionButton>
                    ) : null}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mb: 1 }}
                  >
                    Quyền cấp riêng chỉ CỘNG THÊM vào quyền theo vai trò, không
                    thu hồi quyền của vai trò.
                  </Typography>
                  {overrides.length > 0 ? (
                    <Box
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Quyền</TableCell>
                            <TableCell>Cấp lúc</TableCell>
                            <TableCell align="right">Hành động</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {overrides.map((override) => (
                            <TableRow key={override.user_permission_id}>
                              <TableCell>
                                <Stack spacing={0.25}>
                                  <Typography variant="body2">
                                    {override.permission_name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {override.permission_key}
                                  </Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>
                                {formatDateTime(override.granted_at)}
                              </TableCell>
                              <TableCell align="right">
                                {canManageUsers ? (
                                  <ActionButton
                                    kind="revoke"
                                    onClick={() =>
                                      openRevokeConfirm(override.permission_id)
                                    }
                                  >
                                    Thu hồi
                                  </ActionButton>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Chưa cấp quyền riêng nào.
                    </Typography>
                  )}
                </Box>

                <Accordion
                  disableGutters
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary expandIcon={<ChevronDownIcon />}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Quyền hiệu lực ({effectivePermissionKeys.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {effectivePermissionKeys.length > 0 ? (
                      <Stack
                        direction="row"
                        spacing={0.75}
                        useFlexGap
                        sx={{ flexWrap: "wrap" }}
                      >
                        {effectivePermissionKeys.map((permissionKey) => (
                          <Chip
                            key={permissionKey}
                            label={permissionKey}
                            size="small"
                          />
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Chưa có quyền nào từ các vai trò đang gắn.
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              </Stack>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={isGrantModalOpen}
          onClose={closeGrantModal}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Cấp quyền riêng cho người dùng</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              {grantError ? <Alert severity="error">{grantError}</Alert> : null}
              <FormControl fullWidth size="small">
                <InputLabel id="grant-permission-label">Quyền</InputLabel>
                <Select
                  labelId="grant-permission-label"
                  label="Quyền"
                  value={grantPermissionId}
                  onChange={(event) => setGrantPermissionId(event.target.value)}
                >
                  <MenuItem value="">Chọn quyền</MenuItem>
                  {grantablePermissions.map((permission) => (
                    <MenuItem
                      key={permission.permission_id}
                      value={permission.permission_id}
                    >
                      {permission.permission_name} ({permission.permission_key})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Lý do"
                required
                multiline
                minRows={2}
                fullWidth
                size="small"
                value={grantReason}
                onChange={(event) => setGrantReason(event.target.value)}
                placeholder="Vd: Hỗ trợ tạm thời cho dự án X"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <ActionButton
              kind="cancel"
              onClick={closeGrantModal}
              disabled={grantPermission.isPending}
            >
              Hủy
            </ActionButton>
            <ActionButton
              kind="grant"
              onClick={submitGrantPermission}
              disabled={grantPermission.isPending}
            >
              Cấp quyền
            </ActionButton>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(revokingPermissionId)}
          onClose={closeRevokeConfirm}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Thu hồi quyền cấp riêng</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              {revokeError ? (
                <Alert severity="error">{revokeError}</Alert>
              ) : null}
              <TextField
                label="Lý do"
                required
                multiline
                minRows={2}
                fullWidth
                size="small"
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
                placeholder="Vd: Kết thúc dự án X, thu hồi quyền tạm thời"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <ActionButton
              kind="cancel"
              onClick={closeRevokeConfirm}
              disabled={revokePermission.isPending}
            >
              Hủy
            </ActionButton>
            <ActionButton
              kind="revoke"
              onClick={submitRevokePermission}
              disabled={revokePermission.isPending}
            >
              Thu hồi
            </ActionButton>
          </DialogActions>
        </Dialog>
      </div>
    </ThemeProvider>
  );
}
