import { useT, type TranslateFn } from "@/shared/i18n/useT";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Box,
  Collapse,
  Grid,
  MenuItem,
  Stack,
  UiAlert,
  UiAutocomplete,
  UiDescriptions,
  UiDialog,
  UiIcon,
  UiSelect,
  UiStatusBadge,
  UiTextField,
  type UiStatusTone,
  FILTER_WIDTH,
  TOOLBAR_SEARCH_SX,
} from "@/shared/ui";
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
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { TruncatedText } from "@/shared/components/data-display/TruncatedText";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import {
  IAM_SCOPE_TYPE_LABELS,
  IAM_USER_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useAuthStore } from "@/shared/store/auth.store";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { DepartmentManagerModal } from "@/modules/iam/components/DepartmentManagerModal";
import {
  EMAIL_MAX_LENGTH,
  validateEmail,
  validatePhone,
} from "@/shared/constants/validation.constants";
import {
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_REGEX,
} from "@/modules/auth/schemas/login.schema";
import { STRONG_PASSWORD_REGEX } from "@/modules/auth/schemas/change-password.schema";
import {
  checkDate,
  checkDateRange,
  dateInputBounds,
  defaultDateBounds,
} from "@/shared/validation/date-rules";

/** BE StoreUserRequest: display_name max:255. */
const DISPLAY_NAME_MAX_LENGTH = 255;
/** BE Grant/Revoke/AssignUserRoleRequest: reason min:5 max:2000. */
const REASON_MIN_LENGTH = 5;
const REASON_MAX_LENGTH = 2000;
/** Cửa sổ hiệu lực vai trò: mốc chung 2000 → hôm nay + 10 năm. */
const EFFECTIVE_DATE_BOUNDS = defaultDateBounds();
const EFFECTIVE_DATE_INPUT = dateInputBounds(EFFECTIVE_DATE_BOUNDS);

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
  /** Mục 14: vai trò kiêm nhiệm ngoài vai trò chính (multi-role). */
  additionalRoleIds: string[];
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
  additionalRoleIds: [],
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
  "effectiveFrom",
  "effectiveTo",
  "password",
  "reason",
] as const satisfies readonly (keyof UserFormState)[];

/**
 * Luật mật khẩu tạm/đặt lại của admin: dùng CÙNG rule mật khẩu mạnh với tự
 * đổi mật khẩu (change-password.schema) để tài khoản mới không yếu hơn tài
 * khoản tự đổi. BE StoreUserRequest chỉ `min:8` (không đòi chữ số) nên regex
 * không thêm điều kiện chữ số. Trả key i18n hoặc null khi hợp lệ.
 */
function passwordRuleError(
  password: string,
  isReset: boolean,
):
  | "errPasswordShort"
  | "errPasswordResetShort"
  | "errPasswordLong"
  | "errPasswordEdgeSpaces"
  | "errPasswordStrength"
  | null {
  if (password.length < 8) {
    return isReset ? "errPasswordResetShort" : "errPasswordShort";
  }
  if (password.length > PASSWORD_MAX_LENGTH) return "errPasswordLong";
  if (password !== password.trim()) return "errPasswordEdgeSpaces";
  if (!STRONG_PASSWORD_REGEX.test(password)) return "errPasswordStrength";
  return null;
}

function statusLabel(status: IamUserStatus) {
  return businessLabel(IAM_USER_STATUS_LABELS, status);
}

function statusClass(status: IamUserStatus) {
  if (status === "ACTIVE") return "pill ok";
  if (status === "LOCKED") return "pill danger-pill";
  return "pill warn-pill";
}

/** Tông màu UiStatusBadge cho trạng thái người dùng trong Dialog chi tiết. */
function statusBadgeTone(status: IamUserStatus): UiStatusTone {
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
  t: TranslateFn,
) {
  if (!role) return t("iam.user.unassigned");
  const scopeRef = role.pivot?.scope_ref;
  if (scopeRef)
    return warehouseNames.get(scopeRef) ?? t("iam.user.unknownWarehouse");
  if (role.scope_type === "WAREHOUSE") return t("iam.user.allWarehouses");
  if (role.scope_type === "FUNCTION") return t("iam.user.scopeFunction");
  return t("iam.user.scopeSystem");
}

function effectiveWindowLabel(pivot: IamRolePivot | undefined, t: TranslateFn) {
  const hasFrom = Boolean(pivot?.effective_from);
  const hasTo = Boolean(pivot?.effective_to);
  if (!hasFrom && !hasTo) return t("iam.user.unlimited");
  return `${hasFrom ? formatDate(pivot?.effective_from) : EMPTY_TEXT} → ${hasTo ? formatDate(pivot?.effective_to) : EMPTY_TEXT}`;
}

function formatLastLogin(value: string | null | undefined, t: TranslateFn) {
  return value ? formatDateTime(value) : t("iam.user.neverLoggedIn");
}

/** Ghi chú phụ (caption) dưới một control trong Dialog. */
function FieldHint({
  children,
  mt = 0.75,
}: {
  children: ReactNode;
  mt?: number;
}) {
  return (
    <Box sx={{ mt, fontSize: 12, color: "text.secondary" }}>{children}</Box>
  );
}

/** Tiêu đề khối trong Dialog (thay Typography subtitle2). */
function SectionTitle({
  children,
  mb = 2,
}: {
  children: ReactNode;
  mb?: number;
}) {
  return (
    <Box sx={{ fontWeight: 700, fontSize: 14, mb, color: "text.primary" }}>
      {children}
    </Box>
  );
}

/**
 * Bảng thuần trong Dialog (thay MUI Table size="small") — Dialog render qua
 * portal, ngoài phạm vi CSS `.hn-mvp-source-screen`, nên style tự đủ qua sx.
 */
function DialogTable({
  headers,
  lastColRight = false,
  children,
}: {
  headers: string[];
  lastColRight?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      component="table"
      sx={(theme) => ({
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 13.5,
        "& th, & td": {
          textAlign: "left",
          padding: "8px 12px",
          borderBottom: `1px solid ${theme.palette.divider}`,
          verticalAlign: "top",
        },
        "& th": { fontWeight: 600, color: "text.secondary" },
        "& tbody tr:last-of-type td": { borderBottom: "none" },
        ...(lastColRight
          ? {
              "& th:last-of-type, & td:last-of-type": { textAlign: "right" },
            }
          : {}),
      })}
    >
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </Box>
  );
}

export interface IamUserScreenProps {
  /** Deep-link IAM-02 mở cửa sổ tạo người dùng trên IAM-01. */
  openCreateOnMount?: boolean;
}

export function IamUserScreen({
  openCreateOnMount = false,
}: IamUserScreenProps) {
  const t = useT();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const currentUserId = useAuthStore((state) => state.profile?.user_id);
  const canManageUsers =
    isSuperAdmin || permissionCodes.includes("iam.user.manage");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [departmentManagerOpen, setDepartmentManagerOpen] = useState(false);
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
  /** Lỗi gắn vào từng ô của dialog cấp quyền (banner `grantError` chỉ giữ lỗi server). */
  const [grantFieldErrors, setGrantFieldErrors] = useState<{
    permission?: string;
    reason?: string;
  }>({});
  const [revokingPermissionId, setRevokingPermissionId] = useState<
    string | null
  >(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeError, setRevokeError] = useState("");
  const [revokeReasonError, setRevokeReasonError] = useState("");
  /** Khối "Quyền hiệu lực" trong Dialog chi tiết (thay MUI Accordion). */
  const [isEffectiveOpen, setIsEffectiveOpen] = useState(false);

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
        // KHÔNG rơi xuống row.id: label này hiện trong dropdown chọn kho và
        // trong bảng người dùng — thiếu tên/mã thì để rỗng, không in UUID.
        label: String(row.name ?? row.code ?? ""),
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
      ? // KHÔNG rơi xuống department_id (UUID) khi danh mục chưa tra ra tên.
        (departmentNames.get(user.department_id) ?? EMPTY_TEXT)
      : EMPTY_TEXT);

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

  const {
    sortedRows: sortedUsers,
    sortState,
    requestSort,
    originalIndexOf,
  } = useClientSort(displayedUsers, {
    name: (user) => user.display_name,
    department: (user) => departmentLabel(user),
    role: (user) => user.roles?.[0]?.role_name,
    scope: (user) => scopeLabel(user.roles?.[0], warehouseNames, t),
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
    setGrantFieldErrors({});
    setIsGrantModalOpen(true);
  };

  const closeGrantModal = () => {
    if (grantPermission.isPending) return;
    setIsGrantModalOpen(false);
  };

  /** Lý do cấp/thu hồi/cập nhật: bắt buộc, 5…2000 ký tự (khớp BE). */
  const reasonError = (reason: string): string | null => {
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN_LENGTH) return t("iam.user.errReason");
    if (trimmed.length > REASON_MAX_LENGTH) {
      return t("shared.validation.textMaxLength", { max: REASON_MAX_LENGTH });
    }
    return null;
  };

  const submitGrantPermission = async () => {
    if (!viewingUser) return;
    const errors: { permission?: string; reason?: string } = {};
    if (!grantPermissionId) {
      errors.permission = t("iam.user.errPickPermission");
    }
    const grantReasonMessage = reasonError(grantReason);
    if (grantReasonMessage) {
      errors.reason = grantReasonMessage;
    }
    setGrantFieldErrors(errors);
    if (errors.permission || errors.reason) {
      // Giữ banner như trước để người dùng cũ vẫn thấy lỗi ở chỗ quen thuộc.
      setGrantError(errors.permission ?? errors.reason ?? "");
      return;
    }
    setGrantError("");
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
    setRevokeReasonError("");
  };

  const closeRevokeConfirm = () => {
    if (revokePermission.isPending) return;
    setRevokingPermissionId(null);
  };

  const submitRevokePermission = async () => {
    if (!viewingUser || !revokingPermissionId) return;
    const revokeReasonMessage = reasonError(revokeReason);
    if (revokeReasonMessage) {
      setRevokeReasonError(revokeReasonMessage);
      setRevokeError(revokeReasonMessage);
      return;
    }
    setRevokeError("");
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
      // Vai trò kiêm nhiệm = mọi role hiện có trừ role chính (role đầu tiên).
      additionalRoleIds: (user.roles ?? [])
        .slice(1)
        .map((role) => role.role_id),
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
    setIsEffectiveOpen(false);
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
    const email = formState.email.trim();
    const password = formState.password;

    if (!displayName) {
      errors.displayName = t("iam.user.errDisplayName");
    } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      errors.displayName = t("shared.validation.textMaxLength", {
        max: DISPLAY_NAME_MAX_LENGTH,
      });
    }
    if (!username) {
      errors.username = t("iam.user.errUsername");
    } else if (username.length > USERNAME_MAX_LENGTH) {
      errors.username = t("shared.validation.textMaxLength", {
        max: USERNAME_MAX_LENGTH,
      });
    } else if (!USERNAME_REGEX.test(username)) {
      // Cùng luật với ô đăng nhập — tạo được thì phải đăng nhập được.
      errors.username = t("iam.user.errUsernameFormat");
    }
    if (!formState.roleId) {
      errors.roleId = t("iam.user.errRole");
    }
    // Tạo mới: bắt buộc. Sửa: chỉ kiểm khi có nhập (rỗng = giữ mật khẩu cũ).
    if (!editingUser || password) {
      const passwordKey = passwordRuleError(password, Boolean(editingUser));
      if (passwordKey) {
        errors.password = t(`iam.user.${passwordKey}`);
      }
    }
    if (phone) {
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.isValid) {
        errors.phone = phoneCheck.errorMessage ?? t("iam.user.errPhone");
      }
    }
    if (email) {
      const emailCheck = validateEmail(email);
      if (!emailCheck.isValid) {
        errors.email =
          emailCheck.errorMessage ?? t("shared.validation.emailGmailOnly");
      }
    }
    // Cửa sổ hiệu lực: từng mốc nằm trong cửa sổ chung, và "từ" ≤ "đến"
    // (BE: effective_to after_or_equal:effective_from).
    const fromCheck = checkDate(
      formState.effectiveFrom || null,
      EFFECTIVE_DATE_BOUNDS,
    );
    if (!fromCheck.ok) {
      errors.effectiveFrom = fromCheck.message;
    }
    const toCheck = checkDate(
      formState.effectiveTo || null,
      EFFECTIVE_DATE_BOUNDS,
    );
    if (!toCheck.ok) {
      errors.effectiveTo = toCheck.message;
    }
    if (fromCheck.ok && toCheck.ok) {
      const rangeCheck = checkDateRange(
        fromCheck.value,
        toCheck.value,
        EFFECTIVE_DATE_BOUNDS,
      );
      if (!rangeCheck.ok) {
        errors.effectiveTo = rangeCheck.message;
      }
    }
    const reasonTrimmed = formState.reason.trim();
    if (reasonTrimmed.length < REASON_MIN_LENGTH) {
      errors.reason = t("iam.user.errUpdateReason");
    } else if (reasonTrimmed.length > REASON_MAX_LENGTH) {
      errors.reason = t("shared.validation.textMaxLength", {
        max: REASON_MAX_LENGTH,
      });
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
    // Vai trò bổ sung (kiêm nhiệm), loại trùng vai trò chính.
    const extraRoleIds = formState.additionalRoleIds.filter(
      (roleId) => roleId && roleId !== formState.roleId,
    );
    const currentExtraRoleIds = (editingUser?.roles ?? [])
      .slice(1)
      .map((role) => role.role_id);

    try {
      if (editingUser) {
        await updateUser.mutateAsync({
          userId: editingUser.user_id,
          assignment,
          reason,
          extraRoleIds,
          currentExtraRoleIds,
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
          extraRoleIds,
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
    ? getApiErrorMessage(usersQuery.error, t("iam.user.errLoadUsers"))
    : "";
  const roleError = rolesQuery.error
    ? getApiErrorMessage(rolesQuery.error, t("iam.user.errLoadRoles"))
    : "";

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="IAM-01">
      <div className="toolbar">
        <UiTextField
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={t("iam.user.searchPlaceholder")}
          slotProps={{
            htmlInput: { "aria-label": t("iam.user.searchAria") },
          }}
          sx={TOOLBAR_SEARCH_SX}
        />
        <UiSelect
          value={roleFilter}
          onChange={(value) => {
            setRoleFilter(value);
            setPage(1);
          }}
          disabled={rolesQuery.isLoading}
          aria-label={t("iam.user.roleFilterAria")}
          placeholder={t("iam.user.roleFilterPlaceholder")}
          minWidth={FILTER_WIDTH.select}
          options={roles.map((role) => ({
            value: role.role_id,
            label: role.role_name,
          }))}
        />
        <UiSelect
          value={departmentFilter}
          onChange={(value) => {
            setDepartmentFilter(value);
            setPage(1);
          }}
          disabled={departmentsQuery.isLoading}
          aria-label={t("iam.user.departmentFilterAria")}
          placeholder={t("iam.user.departmentFilterPlaceholder")}
          minWidth={FILTER_WIDTH.select}
          options={departments.map((department) => ({
            value: department.department_id,
            label: department.department_name,
          }))}
        />
        <UiSelect
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value as IamUserStatus | "");
            setPage(1);
          }}
          aria-label={t("iam.user.statusFilterAria")}
          placeholder={t("iam.user.statusFilterPlaceholder")}
          minWidth={FILTER_WIDTH.select}
          options={STATUS_OPTIONS.map((status) => ({
            value: status.value,
            label: status.label,
          }))}
        />
        <UiSelect
          value={perPage}
          onChange={(value) => {
            setPerPage(Number(value));
            setPage(1);
          }}
          aria-label={t("iam.user.pageSizeAria")}
          minWidth={FILTER_WIDTH.pageSize}
          options={perPageOptions.map((size) => ({
            value: size,
            label: `${size} / trang`,
          }))}
        />
        <div className="spacer" />
        {canManageUsers ? (
          <ActionButton
            kind="settings"
            onClick={() => setDepartmentManagerOpen(true)}
          >
            {t("iam.user.manageDepartments")}
          </ActionButton>
        ) : null}
        {canManageUsers ? (
          <ActionButton
            kind="create"
            onClick={openCreate}
            disabled={rolesQuery.isLoading || roles.length === 0}
          >
            {t("iam.user.create")}
          </ActionButton>
        ) : null}
      </div>

      {listError ? (
        <Box sx={{ marginBottom: "14px" }}>
          <UiAlert
            tone="error"
            action={
              <ActionButton kind="refresh" onClick={() => usersQuery.refetch()}>
                {t("iam.user.retry")}
              </ActionButton>
            }
          >
            {listError}
          </UiAlert>
        </Box>
      ) : null}
      {roleError ? (
        <Box sx={{ marginBottom: "14px" }}>
          <UiAlert tone="error">{roleError}</UiAlert>
        </Box>
      ) : null}

      <div className="table-wrap" aria-busy={usersQuery.isLoading}>
        <table>
          <thead>
            <tr>
              <th className="stt-col">STT</th>
              <SortableTh
                label={t("iam.user.colUser")}
                sortKey="name"
                sortState={sortState}
                onSort={requestSort}
              />
              <SortableTh
                label={t("iam.user.colDepartment")}
                sortKey="department"
                sortState={sortState}
                onSort={requestSort}
              />
              <SortableTh
                label={t("iam.user.colRole")}
                sortKey="role"
                sortState={sortState}
                onSort={requestSort}
              />
              <SortableTh
                label={t("iam.user.colScope")}
                sortKey="scope"
                sortState={sortState}
                onSort={requestSort}
              />
              <SortableTh
                label={t("iam.user.colStatus")}
                sortKey="status"
                sortState={sortState}
                onSort={requestSort}
                sortType="value"
              />
              <SortableTh
                label={t("iam.user.colLastLogin")}
                sortKey="lastLogin"
                sortState={sortState}
                onSort={requestSort}
                sortType="value"
              />
              <th aria-label={t("iam.user.actionsAria")} />
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading ? (
              <tr>
                <td colSpan={8}>
                  <span className="muted">{t("iam.user.loadingData")}</span>
                </td>
              </tr>
            ) : sortedUsers.length > 0 ? (
              sortedUsers.map((user) => {
                const primaryRole = user.roles?.[0];
                return (
                  <tr key={user.user_id}>
                    <td className="stt-col">
                      {mvpRowNumber(page, perPage, originalIndexOf(user))}
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <TruncatedText lines={1} maxWidth={240}>
                        {user.display_name}
                      </TruncatedText>
                      <TruncatedText lines={1} maxWidth={240} className="muted">
                        {user.username}
                      </TruncatedText>
                    </td>
                    <td>{departmentLabel(user)}</td>
                    <td>
                      {primaryRole?.role_name ?? t("iam.user.unassigned")}
                    </td>
                    <td>{scopeLabel(primaryRole, warehouseNames, t)}</td>
                    <td>
                      <span className={statusClass(user.status)}>
                        {statusLabel(user.status)}
                      </span>
                    </td>
                    <td>{formatLastLogin(user.last_login_at, t)}</td>
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
                            {t("iam.user.edit")}
                          </ActionButton>
                        ) : null}
                      </Stack>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8}>
                  <span className="muted">{t("iam.user.empty")}</span>
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
        itemLabel={t("iam.user.itemLabel")}
        onChange={setPage}
      />

      <UiDialog
        open={isModalOpen}
        onClose={guardBackdropClose(closeModal)}
        maxWidth="md"
        title={
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <span>
              {editingUser
                ? t("iam.user.dialogEdit")
                : t("iam.user.dialogCreate")}
            </span>
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={closeModal}
              disabled={isSaving}
            />
          </Stack>
        }
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={closeModal}
              disabled={isSaving}
            >
              {t("iam.user.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              disabled={isSaving || !formState.roleId}
              type="submit"
              form="iam-user-form"
            >
              {isSaving ? t("iam.user.saving") : t("iam.user.submit")}
            </ActionButton>
          </>
        }
      >
        <form id="iam-user-form" onSubmit={handleSubmit} noValidate>
          {formError ? (
            <Box sx={{ marginBottom: "14px" }}>
              <UiAlert tone="error">{formError}</UiAlert>
            </Box>
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
                <SectionTitle>{t("iam.user.sectionAccount")}</SectionTitle>
                <Stack spacing={2}>
                  <UiTextField
                    id="iam-display-name"
                    label={t("iam.user.fieldDisplayName")}
                    required
                    fullWidth
                    value={formState.displayName}
                    onChange={(event) =>
                      updateField("displayName", event.target.value)
                    }
                    autoFocus
                    disabled={isSaving}
                    error={Boolean(fieldErrors.displayName)}
                    helperText={fieldErrors.displayName}
                    slotProps={{
                      htmlInput: { maxLength: DISPLAY_NAME_MAX_LENGTH },
                    }}
                  />
                  <UiTextField
                    id="iam-username"
                    label={t("iam.user.fieldUsername")}
                    required
                    fullWidth
                    value={formState.username}
                    onChange={(event) =>
                      updateField("username", event.target.value)
                    }
                    autoComplete="off"
                    disabled={isSaving}
                    error={Boolean(fieldErrors.username)}
                    helperText={fieldErrors.username}
                    slotProps={{
                      htmlInput: { maxLength: USERNAME_MAX_LENGTH },
                    }}
                  />
                  <UiTextField
                    id="iam-phone"
                    label={t("iam.user.fieldPhone")}
                    fullWidth
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
                  <UiTextField
                    id="iam-email"
                    label="Email"
                    type="email"
                    fullWidth
                    value={formState.email}
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                    autoComplete="off"
                    disabled={isSaving}
                    error={Boolean(fieldErrors.email)}
                    helperText={fieldErrors.email}
                    slotProps={{ htmlInput: { maxLength: EMAIL_MAX_LENGTH } }}
                  />
                  <UiAutocomplete
                    data-testid="iam-department"
                    label={t("iam.user.colDepartment")}
                    value={formState.departmentId || null}
                    onChange={(next) =>
                      updateField(
                        "departmentId",
                        next == null ? "" : String(next),
                      )
                    }
                    disabled={isSaving || departmentsQuery.isLoading}
                    placeholder={t("iam.user.noDepartment")}
                    options={[
                      // Giữ được lựa chọn hiện tại khi phòng ban đã INACTIVE
                      // (danh mục dropdown chỉ nạp phòng ban ACTIVE).
                      ...(formState.departmentId &&
                      !departments.some(
                        (department) =>
                          department.department_id === formState.departmentId,
                      )
                        ? [
                            {
                              value: formState.departmentId,
                              label:
                                departmentNames.get(formState.departmentId) ??
                                (editingUser?.department?.department_name ||
                                  formState.departmentId),
                            },
                          ]
                        : []),
                      ...departments.map((department) => ({
                        value: department.department_id,
                        label: department.department_name,
                      })),
                    ]}
                  />
                  <UiTextField
                    id="iam-status"
                    select
                    label={t("iam.user.colStatus")}
                    required
                    fullWidth
                    value={formState.status}
                    onChange={(event) =>
                      updateField("status", event.target.value as IamUserStatus)
                    }
                    disabled={isSaving}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </UiTextField>
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
                <SectionTitle>{t("iam.user.sectionPermissions")}</SectionTitle>
                <Stack spacing={2}>
                  <div>
                    <UiAutocomplete
                      data-testid="iam-role"
                      label={t("iam.user.colRole")}
                      required
                      value={formState.roleId || null}
                      onChange={(next) =>
                        updateField("roleId", next == null ? "" : String(next))
                      }
                      disabled={isSaving || roles.length === 0 || isEditingSelf}
                      error={Boolean(fieldErrors.roleId)}
                      helperText={fieldErrors.roleId}
                      placeholder={t("iam.user.pickRole")}
                      options={roles.map((role) => ({
                        value: role.role_id,
                        label: role.role_name,
                      }))}
                    />
                    {isEditingSelf ? (
                      <FieldHint>{t("iam.user.noSelfRoleChange")}</FieldHint>
                    ) : null}
                  </div>
                  <div>
                    <UiAutocomplete
                      data-testid="iam-extra-roles"
                      multiple
                      label={t("iam.user.fieldExtraRoles")}
                      value={formState.additionalRoleIds}
                      onChange={(next) =>
                        updateField("additionalRoleIds", next.map(String))
                      }
                      disabled={isSaving || roles.length === 0 || isEditingSelf}
                      placeholder={
                        formState.additionalRoleIds.length === 0
                          ? t("iam.user.noExtraRoles")
                          : undefined
                      }
                      options={roles
                        .filter((role) => role.role_id !== formState.roleId)
                        .map((role) => ({
                          value: role.role_id,
                          label: role.role_name,
                        }))}
                    />
                    <FieldHint>{t("iam.user.extraRolesHint")}</FieldHint>
                  </div>
                  <div>
                    {/*
                      Không đánh dấu bắt buộc: scopeRef rỗng = "Toàn hệ thống"
                      là lựa chọn hợp lệ (BE roles.*.scope_ref nullable), nên
                      dấu * chỉ khiến người dùng tưởng phải chọn một kho.
                    */}
                    <UiAutocomplete
                      data-testid="iam-scope"
                      label={t("iam.user.fieldDataScope")}
                      value={formState.scopeRef}
                      onChange={(next) =>
                        updateField(
                          "scopeRef",
                          next == null ? "" : String(next),
                        )
                      }
                      disabled={isSaving || isEditingSelf}
                      options={[
                        // "Toàn hệ thống" là lựa chọn THẬT (scopeRef rỗng),
                        // không phải placeholder — phải chọn lại được.
                        { value: "", label: t("iam.user.scopeAllSystem") },
                        ...warehouses.map((warehouse) => ({
                          value: warehouse.id,
                          label: warehouse.label,
                        })),
                      ]}
                    />
                    <FieldHint>
                      {t("iam.user.scopeHint", {
                        scope: scopeTypeLabel(selectedRole?.scope_type),
                      })}
                    </FieldHint>
                  </div>
                  <UiTextField
                    id="iam-effective-from"
                    label={t("iam.user.fieldValidFrom")}
                    type="date"
                    fullWidth
                    value={formState.effectiveFrom}
                    onChange={(event) =>
                      updateField("effectiveFrom", event.target.value)
                    }
                    disabled={isSaving || isEditingSelf}
                    error={Boolean(fieldErrors.effectiveFrom)}
                    helperText={
                      fieldErrors.effectiveFrom ?? t("iam.user.dateHelper")
                    }
                    slotProps={{
                      htmlInput: { ...EFFECTIVE_DATE_INPUT },
                      inputLabel: { shrink: true },
                    }}
                  />
                  <UiTextField
                    id="iam-effective-to"
                    label={t("iam.user.fieldValidTo")}
                    type="date"
                    fullWidth
                    value={formState.effectiveTo}
                    onChange={(event) =>
                      updateField("effectiveTo", event.target.value)
                    }
                    disabled={isSaving || isEditingSelf}
                    error={Boolean(fieldErrors.effectiveTo)}
                    helperText={
                      fieldErrors.effectiveTo ?? t("iam.user.dateHelper")
                    }
                    slotProps={{
                      htmlInput: {
                        ...EFFECTIVE_DATE_INPUT,
                        // Lịch "đến" không cho chọn trước "từ" (nếu "từ" hợp lệ).
                        min:
                          formState.effectiveFrom &&
                          formState.effectiveFrom > EFFECTIVE_DATE_INPUT.min
                            ? formState.effectiveFrom
                            : EFFECTIVE_DATE_INPUT.min,
                      },
                      inputLabel: { shrink: true },
                    }}
                  />
                  <UiTextField
                    id="iam-password"
                    label={
                      editingUser
                        ? t("iam.user.fieldPasswordReset")
                        : t("iam.user.fieldPasswordNew")
                    }
                    required={!editingUser}
                    type="password"
                    fullWidth
                    value={formState.password}
                    onChange={(event) =>
                      updateField("password", event.target.value)
                    }
                    autoComplete="new-password"
                    placeholder={
                      editingUser
                        ? t("iam.user.passwordKeepHint")
                        : t("iam.user.passwordMinHint")
                    }
                    disabled={isSaving}
                    error={Boolean(fieldErrors.password)}
                    helperText={
                      fieldErrors.password ?? t("iam.user.passwordRuleHint")
                    }
                    slotProps={{
                      htmlInput: { maxLength: PASSWORD_MAX_LENGTH },
                    }}
                  />
                  <UiTextField
                    id="iam-reason"
                    label={t("iam.user.fieldUpdateReason")}
                    required
                    multiline
                    minRows={2}
                    fullWidth
                    value={formState.reason}
                    onChange={(event) =>
                      updateField("reason", event.target.value)
                    }
                    placeholder={t("iam.user.updateReasonPlaceholder")}
                    disabled={isSaving}
                    error={Boolean(fieldErrors.reason)}
                    helperText={
                      fieldErrors.reason ?? t("iam.user.updateReasonHint")
                    }
                    slotProps={{ htmlInput: { maxLength: REASON_MAX_LENGTH } }}
                  />
                  {editingUser ? (
                    <Box>
                      <FieldHint mt={0}>{t("iam.user.fieldVersion")}</FieldHint>
                      <Box
                        sx={{
                          mt: 0.5,
                          fontSize: 14,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1.5,
                          px: 1.5,
                          py: 1,
                        }}
                      >
                        {editingUser.version}
                      </Box>
                      <FieldHint>{t("iam.user.versionHint")}</FieldHint>
                    </Box>
                  ) : null}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </form>
      </UiDialog>

      <UiDialog
        open={Boolean(viewingUser)}
        onClose={closeView}
        maxWidth="sm"
        slotProps={{ paper: { sx: { maxWidth: 760 } } }}
        title={
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <span>{t("iam.user.detailTitle")}</span>
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={closeView}
            />
          </Stack>
        }
      >
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
              <UiDescriptions
                columns={2}
                items={[
                  {
                    label: t("iam.user.fieldDisplayName"),
                    value: viewingUser.display_name,
                  },
                  {
                    label: t("iam.user.fieldUsername"),
                    value: viewingUser.username,
                  },
                  {
                    label: t("iam.user.fieldPhone"),
                    value: viewingUser.phone || EMPTY_TEXT,
                  },
                  { label: "Email", value: viewingUser.email || EMPTY_TEXT },
                  {
                    label: t("iam.user.colDepartment"),
                    value: departmentLabel(viewingUser),
                  },
                  {
                    label: t("iam.user.colStatus"),
                    value: (
                      <UiStatusBadge
                        tone={statusBadgeTone(viewingUser.status)}
                        label={statusLabel(viewingUser.status)}
                      />
                    ),
                  },
                  {
                    label: t("iam.user.colLastLogin"),
                    value: formatLastLogin(viewingUser.last_login_at, t),
                  },
                  {
                    label: t("iam.user.fieldVersion"),
                    value: viewingUser.version,
                  },
                ]}
              />
            </Box>

            <Box>
              <SectionTitle mb={1}>
                {t("iam.user.rolesSection", {
                  count: viewingUser.roles?.length ?? 0,
                })}
              </SectionTitle>
              {viewingUser.roles && viewingUser.roles.length > 0 ? (
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <DialogTable
                    headers={[
                      t("iam.user.colRoleName"),
                      t("iam.user.colScopeName"),
                      t("iam.user.colValidity"),
                    ]}
                  >
                    {viewingUser.roles.map((role) => (
                      <tr key={role.role_id}>
                        <td>
                          <Stack
                            spacing={0.5}
                            sx={{ alignItems: "flex-start" }}
                          >
                            <span>{role.role_name}</span>
                            <UiStatusBadge
                              tone="neutral"
                              label={scopeTypeLabel(role.scope_type)}
                            />
                          </Stack>
                        </td>
                        <td>{scopeLabel(role, warehouseNames, t)}</td>
                        <td>{effectiveWindowLabel(role.pivot, t)}</td>
                      </tr>
                    ))}
                  </DialogTable>
                </Box>
              ) : (
                <Box sx={{ fontSize: 14, color: "text.secondary" }}>
                  {t("iam.user.noRoles")}
                </Box>
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
                <SectionTitle mb={0}>
                  {t("iam.user.overridesSection", { count: overrides.length })}
                </SectionTitle>
                {canManageUsers ? (
                  <ActionButton kind="grant" onClick={openGrantModal}>
                    {t("iam.user.grantOverride")}
                  </ActionButton>
                ) : null}
              </Stack>
              <FieldHint mt={0}>
                {t("iam.user.overridesHintA")} {t("iam.user.overridesHintB")}
              </FieldHint>
              {overrides.length > 0 ? (
                <Box
                  sx={{
                    mt: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <DialogTable
                    headers={[
                      t("iam.user.colPermission"),
                      t("iam.user.colGrantedAt"),
                      t("iam.user.colAction"),
                    ]}
                    lastColRight
                  >
                    {overrides.map((override) => (
                      <tr key={override.user_permission_id}>
                        <td>
                          <Stack spacing={0.25}>
                            <span>{override.permission_name}</span>
                            <Box
                              component="span"
                              sx={{ fontSize: 12, color: "text.secondary" }}
                            >
                              {override.permission_key}
                            </Box>
                          </Stack>
                        </td>
                        <td>{formatDateTime(override.granted_at)}</td>
                        <td>
                          {canManageUsers ? (
                            <ActionButton
                              kind="revoke"
                              onClick={() =>
                                openRevokeConfirm(override.permission_id)
                              }
                            >
                              {t("iam.user.revoke")}
                            </ActionButton>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </DialogTable>
                </Box>
              ) : (
                <Box sx={{ mt: 1, fontSize: 14, color: "text.secondary" }}>
                  {t("iam.user.noOverrides")}
                </Box>
              )}
            </Box>

            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <Box
                component="button"
                type="button"
                aria-expanded={isEffectiveOpen}
                onClick={() => setIsEffectiveOpen((open) => !open)}
                sx={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  px: 2,
                  py: 1.5,
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  font: "inherit",
                  textAlign: "left",
                  color: "text.primary",
                }}
              >
                <Box component="span" sx={{ fontWeight: 600, fontSize: 14 }}>
                  {t("iam.user.effectiveSection", {
                    count: effectivePermissionKeys.length,
                  })}
                </Box>
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    transition: "transform 0.2s",
                    transform: isEffectiveOpen ? "rotate(180deg)" : "none",
                  }}
                >
                  <UiIcon name="angle-down" size="md" />
                </Box>
              </Box>
              <Collapse in={isEffectiveOpen}>
                <Box sx={{ px: 2, pb: 2 }}>
                  {effectivePermissionKeys.length > 0 ? (
                    <Stack
                      direction="row"
                      spacing={0.75}
                      useFlexGap
                      sx={{ flexWrap: "wrap" }}
                    >
                      {effectivePermissionKeys.map((permissionKey) => (
                        <UiStatusBadge
                          key={permissionKey}
                          tone="neutral"
                          label={permissionKey}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Box sx={{ fontSize: 14, color: "text.secondary" }}>
                      {t("iam.user.noEffective")}
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Box>
          </Stack>
        ) : null}
      </UiDialog>

      <UiDialog
        open={isGrantModalOpen}
        onClose={closeGrantModal}
        maxWidth="xs"
        title={t("iam.user.grantTitle")}
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={closeGrantModal}
              disabled={grantPermission.isPending}
            >
              {t("iam.user.cancel")}
            </ActionButton>
            <ActionButton
              kind="grant"
              onClick={submitGrantPermission}
              disabled={grantPermission.isPending}
            >
              {t("iam.user.grantConfirm")}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {grantError ? <UiAlert tone="error">{grantError}</UiAlert> : null}
          <UiAutocomplete
            label={t("iam.user.fieldPermission")}
            value={grantPermissionId || null}
            onChange={(next) => {
              setGrantPermissionId(next == null ? "" : String(next));
              setGrantFieldErrors((current) => ({
                ...current,
                permission: undefined,
              }));
            }}
            error={Boolean(grantFieldErrors.permission)}
            helperText={grantFieldErrors.permission}
            placeholder={t("iam.user.pickPermission")}
            options={grantablePermissions.map((permission) => ({
              value: permission.permission_id,
              label:
                permission.permission_name +
                " (" +
                permission.permission_key +
                ")",
            }))}
          />
          <UiTextField
            label={t("iam.user.fieldReason")}
            required
            multiline
            minRows={2}
            fullWidth
            value={grantReason}
            onChange={(event) => {
              setGrantReason(event.target.value);
              setGrantFieldErrors((current) => ({
                ...current,
                reason: undefined,
              }));
            }}
            placeholder={t("iam.user.grantReasonPlaceholder")}
            error={Boolean(grantFieldErrors.reason)}
            helperText={grantFieldErrors.reason}
            slotProps={{ htmlInput: { maxLength: REASON_MAX_LENGTH } }}
          />
        </Stack>
      </UiDialog>

      <UiDialog
        open={Boolean(revokingPermissionId)}
        onClose={closeRevokeConfirm}
        maxWidth="xs"
        title={t("iam.user.revokeTitle")}
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={closeRevokeConfirm}
              disabled={revokePermission.isPending}
            >
              {t("iam.user.cancel")}
            </ActionButton>
            <ActionButton
              kind="revoke"
              onClick={submitRevokePermission}
              disabled={revokePermission.isPending}
            >
              {t("iam.user.revokeConfirm")}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {revokeError ? <UiAlert tone="error">{revokeError}</UiAlert> : null}
          <UiTextField
            label={t("iam.user.fieldReason")}
            required
            multiline
            minRows={2}
            fullWidth
            value={revokeReason}
            onChange={(event) => {
              setRevokeReason(event.target.value);
              setRevokeReasonError("");
            }}
            placeholder={t("iam.user.revokeReasonPlaceholder")}
            error={Boolean(revokeReasonError)}
            helperText={revokeReasonError || undefined}
            slotProps={{ htmlInput: { maxLength: REASON_MAX_LENGTH } }}
          />
        </Stack>
      </UiDialog>

      {departmentManagerOpen ? (
        <DepartmentManagerModal
          open={departmentManagerOpen}
          onClose={() => setDepartmentManagerOpen(false)}
        />
      ) : null}
    </div>
  );
}
