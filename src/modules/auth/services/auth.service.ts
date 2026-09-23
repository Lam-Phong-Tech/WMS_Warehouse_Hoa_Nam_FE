import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { refreshSession } from "@/shared/api/axios";
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  AuthenticatedLogin,
  LoginRequest,
  LoginResponse,
  LoginResult,
  RefreshResponse,
  ResetPasswordRequest,
  SwitchContextRequest,
  SwitchContextResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from "@/modules/auth/types/auth.types";
import type { MeContext, MeResponse } from "@/modules/auth/types/me.types";
import type {
  MfaConfirmResult,
  MfaEnrollment,
  MfaStatus,
} from "@/modules/auth/types/mfa.types";
import type { User, UserRoleAssignment } from "@/shared/types/user";
import { tStatic } from "@/shared/i18n/useT";

export class AuthContractError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`AUTH_CONTRACT_INVALID(${field}): ${message}`);
    this.name = "AuthContractError";
    this.field = field;
  }
}

type BackendUser = Partial<User> & {
  user_id?: string;
  username?: string;
  display_name?: string;
  roles?: UserRoleAssignment[];
  permissions?: string[];
  warehouse_scope_ids?: string[];
};

type BackendLoginResponse = {
  /** WWHN-SEC-08: co mat khi tai khoan da bat MFA — KHONG kem access_token. */
  mfa_required?: boolean;
  mfa_token?: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  user?: BackendUser;
};

type BackendMeResponse = BackendUser & {
  status?: string;
  phone?: string | null;
  company?: MeResponse["company"];
  branch?: MeResponse["branch"];
  department?: MeResponse["department"];
  position?: MeResponse["position"];
  role?: MeResponse["role"];
};

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AuthContractError(field, "expected a non-empty string");
  }
  return value;
}

function requirePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new AuthContractError(field, "expected a positive number");
  }
  return value;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}

function normalizeRoles(value: unknown): UserRoleAssignment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const role = item as Partial<UserRoleAssignment>;
    if (
      typeof role.role_id !== "string" ||
      typeof role.role_code !== "string" ||
      typeof role.role_name !== "string"
    ) {
      return [];
    }
    return [
      {
        role_id: role.role_id,
        role_code: role.role_code,
        role_name: role.role_name,
        scope_ref:
          typeof role.scope_ref === "string" && role.scope_ref.trim() !== ""
            ? role.scope_ref
            : null,
      },
    ];
  });
}

function normalizeUser(input: BackendUser | undefined): User {
  if (!input) throw new AuthContractError("user", "missing user object");
  const id = input.id ?? input.user_id;
  if (id === undefined || id === null || String(id).trim() === "") {
    throw new AuthContractError("user.id", "missing stable user identifier");
  }

  const identity = input.email ?? input.username;
  requireNonEmptyString(identity, "user.email_or_username");
  const roles = normalizeRoles(input.roles);
  const permissions = normalizeStringArray(input.permissions);
  const warehouseScopeIds = normalizeStringArray(input.warehouse_scope_ids);

  return {
    ...input,
    id,
    user_id: input.user_id,
    username: input.username,
    name: input.name ?? input.display_name ?? input.username ?? null,
    display_name: input.display_name,
    email: input.email ?? input.username ?? "",
    code: input.code ?? input.username ?? input.user_id ?? String(id),
    roles,
    permissions,
    warehouse_scope_ids: warehouseScopeIds,
  };
}

/**
 * BE m1 không trả available_contexts. FE dựng danh sách kho từ
 * warehouse_scope_ids (ưu tiên) hoặc roles[].scope_ref để ContextSwitcher gọi
 * đúng POST /auth/switch-context.
 */
function deriveContexts(
  user: User,
  permissionCodes: string[] = [],
): MeContext[] {
  const roles = user.roles ?? [];
  const roleScopeRefs = roles
    .map((role) => role.scope_ref)
    .filter((value): value is string => Boolean(value));
  const warehouseScopes = Array.from(
    new Set([...(user.warehouse_scope_ids ?? []), ...roleScopeRefs]),
  );

  if (warehouseScopes.length > 0) {
    return warehouseScopes.map((scopeRef) => {
      const role =
        roles.find((item) => item.scope_ref === scopeRef) ?? roles[0];
      return {
        role_id: role?.role_id ?? scopeRef,
        role_name:
          role?.role_name ?? tStatic("auth.context.warehouseScopeRole"),
        scope_type: "kho",
        org_unit_id: null,
        org_unit_name: null,
        department_id: null,
        department_name: null,
        warehouse_id: null,
        warehouse_name: scopeRef,
        context_type: "WAREHOUSE",
        context_id: scopeRef,
        scope_ref: scopeRef,
        permission_codes: permissionCodes,
      };
    });
  }

  const role = roles[0];
  if (!role) return [];
  return [
    {
      role_id: role.role_id,
      role_name: role.role_name,
      scope_type: "he_thong",
      org_unit_id: null,
      org_unit_name: null,
      department_id: null,
      department_name: null,
      warehouse_id: null,
      warehouse_name: null,
      context_type: "SYSTEM",
      context_id: null,
      scope_ref: null,
      permission_codes: permissionCodes,
    },
  ];
}

/**
 * P1 bảo mật 10/09/2026: object kết quả được dựng TƯỜNG MINH, không spread payload
 * của BE — nên kể cả một BE cũ còn trả refresh token trong JSON, giá trị đó không đi
 * vào kết quả, store hay storage nào của FE. Trình duyệt chỉ giữ refresh token trong
 * cookie HttpOnly do BE đặt.
 */
function normalizeLoginResponse(data: BackendLoginResponse): LoginResponse {
  const user = normalizeUser(data.user);
  return {
    access_token: requireNonEmptyString(data.access_token, "access_token"),
    token_type: data.token_type ?? "bearer",
    expires_in: requirePositiveNumber(data.expires_in, "expires_in"),
    user,
    available_contexts: deriveContexts(user),
  };
}

function normalizeMeResponse(data: BackendMeResponse): MeResponse {
  const user = normalizeUser(data);
  const roles = user.roles ?? [];
  const permissions = user.permissions ?? [];
  const warehouseScopeIds = user.warehouse_scope_ids ?? [];
  const availableContexts = deriveContexts(user, permissions);
  const isSuperAdmin = roles.some((role) => role.role_code === "SUPER_ADMIN");

  return {
    id: user.id,
    user_id: user.user_id,
    username: user.username,
    name: user.name ?? "",
    display_name: user.display_name,
    email: user.email,
    code: user.code,
    status: data.status,
    roles,
    permissions,
    warehouse_scope_ids: warehouseScopeIds,
    phone: data.phone ?? user.phone ?? null,
    company: data.company ?? null,
    branch: data.branch ?? null,
    department: data.department ?? null,
    position: data.position ?? null,
    role: data.role ?? null,
    active_context: null,
    available_contexts: availableContexts,
    is_super_admin: isSuperAdmin,
  };
}

function normalizeTokenResponse<
  T extends RefreshResponse | SwitchContextResponse,
>(data: T): T {
  return {
    ...data,
    access_token: requireNonEmptyString(data.access_token, "access_token"),
    token_type: data.token_type ?? "bearer",
    expires_in: requirePositiveNumber(data.expires_in, "expires_in"),
  };
}

/**
 * Hồ sơ đầy đủ suy ra từ trường `user` mà `POST /auth/refresh` trả kèm.
 *
 * VÌ SAO CẦN: sau mỗi lần F5, FE gọi `/auth/refresh` rồi CHỜ nó xong mới gọi
 * tiếp `/auth/me` — hai vòng mạng NỐI TIẾP nằm trên đúng đường tới hạn của mọi
 * lần tải trang. Nhưng `/auth/refresh` đã trả sẵn `user` với đúng shape mà
 * `/auth/me` trả (đối chiếu trên runtime thật: cùng roles, cùng 60 permission,
 * cùng warehouse_scope_ids). Vòng thứ hai là thừa.
 *
 * KHÔNG làm yếu mô hình fail-closed: hồ sơ vẫn do MÁY CHỦ phát ra, trong chính
 * response vừa cấp token đó — nên vẫn đúng nghĩa "permission/data-scope của đúng
 * JWT hiện tại". Trả `null` khi payload thiếu `permissions`, để nơi gọi rơi về
 * đường cũ (chờ `/auth/me`) thay vì tự đoán quyền.
 */
export function meResponseFromRefreshUser(user: unknown): MeResponse | null {
  if (user === null || typeof user !== "object") return null;

  const raw = user as BackendMeResponse;
  // Thiếu danh sách quyền thì KHÔNG dựng hồ sơ: fail-closed phải dựa trên quyền
  // do máy chủ khẳng định, không phải trên một object rỗng.
  if (!Array.isArray(raw.permissions)) return null;

  try {
    return normalizeMeResponse(raw);
  } catch {
    // Hợp đồng lệch (thiếu id/email...) -> để nơi gọi đi tiếp bằng /auth/me.
    return null;
  }
}

export const authService = {
  async login(data: LoginRequest): Promise<LoginResult> {
    const response = await http.post<BackendLoginResponse>(
      API_ENDPOINTS.LOGIN,
      data,
    );

    // WWHN-SEC-08: mat khau dung moi la yeu to thu nhat. BE dung o day va KHONG
    // phat token nao; FE phai nhan ra nhanh nay truoc khi normalize, vi
    // normalizeLoginResponse() se nem AuthContractError khi thieu access_token.
    if (response.mfa_required === true) {
      return {
        kind: "mfa_required",
        mfa_required: true,
        mfa_token: requireNonEmptyString(response.mfa_token, "mfa_token"),
        expires_in: requirePositiveNumber(response.expires_in, "expires_in"),
      };
    }

    return { kind: "authenticated", ...normalizeLoginResponse(response) };
  },

  /**
   * Buoc 2 cua dang nhap. `code` co the la ma TOTP 6 chu so hoac mot ma khoi phuc.
   */
  async verifyMfa(mfaToken: string, code: string): Promise<AuthenticatedLogin> {
    const response = await http.post<BackendLoginResponse>(
      API_ENDPOINTS.MFA_VERIFY,
      { mfa_token: mfaToken, code },
    );
    return { kind: "authenticated", ...normalizeLoginResponse(response) };
  },

  mfaStatus() {
    return http.get<MfaStatus>(API_ENDPOINTS.MFA_STATUS);
  },

  mfaEnroll() {
    return http.post<MfaEnrollment>(API_ENDPOINTS.MFA_ENROLL, {});
  },

  mfaConfirm(code: string) {
    return http.post<MfaConfirmResult>(API_ENDPOINTS.MFA_CONFIRM, { code });
  },

  mfaDisable(password: string, code: string) {
    return http.post<null>(API_ENDPOINTS.MFA_DISABLE, { password, code });
  },

  /**
   * Refresh token của phiên nằm trong cookie HttpOnly: body rỗng, BE tự đọc cookie để
   * thu hồi đúng phiên rồi hết hạn cookie đó.
   */
  logout() {
    return http.post<null>(API_ENDPOINTS.LOGOUT, {}, { withCredentials: true });
  },

  async me() {
    const response = await http.get<BackendMeResponse>(API_ENDPOINTS.ME);
    return normalizeMeResponse(response);
  },

  async switchContext(data: SwitchContextRequest) {
    const response = await http.post<SwitchContextResponse>(
      API_ENDPOINTS.SWITCH_CONTEXT,
      data,
    );
    return normalizeTokenResponse(response);
  },

  /**
   * P1 bảo mật 10/09/2026 — làm mới phiên CHỈ bằng cookie HttpOnly.
   *
   * Request không mang refresh token nào (body rỗng); trình duyệt tự gửi cookie
   * `wms_refresh_token`, BE trả access token mới trong JSON và token xoay vòng trong
   * Set-Cookie. JavaScript không đọc được cookie đó, nên "không có token trong bộ nhớ"
   * không bao giờ được coi là chưa đăng nhập trước khi request này chạy. Dùng chung
   * single-flight và khoá liên tab với interceptor axios (`refreshSession`).
   */
  async refresh(): Promise<RefreshResponse> {
    const payload = await refreshSession();
    return {
      access_token: requireNonEmptyString(payload.access_token, "access_token"),
      token_type: payload.token_type ?? "bearer",
      expires_in: requirePositiveNumber(payload.expires_in, "expires_in"),
      user: payload.user as RefreshResponse["user"],
    };
  },

  changePassword(data: ChangePasswordRequest) {
    return http.post<null>(API_ENDPOINTS.CHANGE_PASSWORD, data);
  },

  /** Cũng dùng để "Gửi lại mã" — gọi lại chính request này, BE không có endpoint resend riêng. */
  forgotPassword(data: ForgotPasswordRequest) {
    return http.post<null>(API_ENDPOINTS.FORGOT_PASSWORD, data);
  },

  async verifyOtp(data: VerifyOtpRequest) {
    const response = await http.post<VerifyOtpResponse>(
      API_ENDPOINTS.VERIFY_OTP,
      data,
    );
    return {
      ...response,
      reset_token: requireNonEmptyString(response.reset_token, "reset_token"),
    };
  },

  resetPassword(data: ResetPasswordRequest) {
    return http.post<null>(API_ENDPOINTS.RESET_PASSWORD, data);
  },
};

export { useLogin } from "@/modules/auth/hooks/use-login";
export { useLogout } from "@/modules/auth/hooks/use-logout";
