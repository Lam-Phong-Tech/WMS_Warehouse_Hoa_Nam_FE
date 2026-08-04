import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import type {
  ChangePasswordRequest,
  AuthContext,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  SwitchContextRequest,
  SwitchContextResponse,
} from "@/modules/auth/types/auth.types";
import type {
  MeContext,
  MeResponse,
} from "@/modules/auth/types/me.types";
import type { User } from "@/shared/types/user";
import { memoryStorage } from "@/shared/lib/memory-storage";

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
  permissions?: string[];
};

type BackendLoginResponse = Omit<Partial<LoginResponse>, "user"> & {
  user?: BackendUser;
};

type BackendMeResponse = Partial<MeResponse> & BackendUser;

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

function normalizeUser(input: BackendUser | undefined): User {
  if (!input) throw new AuthContractError("user", "missing user object");
  const id = input.id ?? input.user_id;
  if (id === undefined || id === null || String(id).trim() === "") {
    throw new AuthContractError("user.id", "missing stable user identifier");
  }
  const identity = input.email ?? input.username;
  requireNonEmptyString(identity, "user.email_or_username");

  return {
    ...input,
    id,
    user_id: input.user_id,
    username: input.username,
    name: input.name ?? input.display_name ?? input.username ?? null,
    display_name: input.display_name,
    email: input.email ?? input.username ?? "",
    code: input.code ?? input.username ?? input.user_id ?? String(id),
    roles: input.roles,
    permissions: input.permissions,
  };
}

function normalizeContext(
  value: AuthContext | Partial<MeContext>,
  index: number,
  includePermissions = false,
): AuthContext | MeContext {
  if (!value || typeof value !== "object") {
    throw new AuthContractError(
      `available_contexts[${index}]`,
      "expected an object",
    );
  }
  requirePositiveNumber(value.role_id, `available_contexts[${index}].role_id`);
  requireNonEmptyString(
    value.scope_type,
    `available_contexts[${index}].scope_type`,
  );

  const normalized: AuthContext = {
    role_id: value.role_id as number,
    role_name: value.role_name || `Vai trò #${value.role_id}`,
    scope_type: value.scope_type as string,
    org_unit_id: value.org_unit_id ?? null,
    org_unit_name: value.org_unit_name ?? null,
    department_id: value.department_id ?? null,
    department_name: value.department_name ?? null,
    warehouse_id: value.warehouse_id ?? null,
    warehouse_name: value.warehouse_name ?? null,
  };

  if (!includePermissions) return normalized;
  return {
    ...normalized,
    permission_codes: Array.isArray(value.permission_codes)
      ? value.permission_codes.filter(
          (code): code is string =>
            typeof code === "string" && code.trim() !== "",
        )
      : [],
  };
}

function normalizeLoginContexts(
  contexts: AuthContext[] | undefined,
): AuthContext[] {
  if (contexts === undefined) return [];
  if (!Array.isArray(contexts)) {
    throw new AuthContractError("available_contexts", "expected an array");
  }
  return contexts.map(
    (context, index) => normalizeContext(context, index) as AuthContext,
  );
}

function normalizeMeContexts(
  contexts: MeContext[] | undefined,
): MeContext[] {
  if (contexts === undefined) return [];
  if (!Array.isArray(contexts)) {
    throw new AuthContractError("available_contexts", "expected an array");
  }
  return contexts.map(
    (context, index) => normalizeContext(context, index, true) as MeContext,
  );
}

function normalizeLoginResponse(data: BackendLoginResponse): LoginResponse {
  return {
    access_token: requireNonEmptyString(data.access_token, "access_token"),
    refresh_token: data.refresh_token,
    token_type: data.token_type ?? "bearer",
    expires_in: requirePositiveNumber(data.expires_in, "expires_in"),
    user: normalizeUser(data.user),
    available_contexts: normalizeLoginContexts(data.available_contexts),
  };
}

function normalizeMeResponse(data: BackendMeResponse): MeResponse {
  const user = normalizeUser(data);
  const roles = Array.isArray(data.roles) ? data.roles : [];
  const availableContexts = normalizeMeContexts(data.available_contexts);
  const activeContext = data.active_context
    ? (normalizeContext(data.active_context, 0, true) as MeContext)
    : null;
  const isSuperAdmin =
    data.is_super_admin ?? roles.some((role) => role.role_code === "SUPER_ADMIN");

  return {
    ...data,
    id: user.id,
    user_id: user.user_id,
    username: user.username,
    name: user.name ?? "",
    display_name: user.display_name,
    email: user.email,
    code: user.code,
    roles,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    phone: data.phone ?? null,
    company: data.company ?? null,
    branch: data.branch ?? null,
    department: data.department ?? null,
    position: data.position ?? null,
    role: data.role ?? {
      id: 0,
      name: roles[0]?.role_name ?? "",
      permissions: [],
    },
    active_context: activeContext,
    available_contexts: availableContexts,
    is_super_admin: isSuperAdmin,
  };
}

function normalizeTokenResponse<T extends RefreshResponse | SwitchContextResponse>(
  data: T,
): T {
  return {
    ...data,
    access_token: requireNonEmptyString(data.access_token, "access_token"),
    token_type: data.token_type ?? "bearer",
    expires_in: requirePositiveNumber(data.expires_in, "expires_in"),
  };
}

export const authService = {
  async login(data: LoginRequest) {
    const response = await http.post<BackendLoginResponse>(
      API_ENDPOINTS.LOGIN,
      data,
    );
    const normalized = normalizeLoginResponse(response);
    if (normalized.refresh_token) {
      memoryStorage.setRefreshToken(normalized.refresh_token);
    }
    return normalized;
  },

  logout() {
    const refreshToken = memoryStorage.getRefreshToken();
    memoryStorage.removeRefreshToken();
    return http.post<null>(
      API_ENDPOINTS.LOGOUT,
      refreshToken ? { refresh_token: refreshToken } : undefined,
    );
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

  async refresh() {
    const refreshToken = memoryStorage.getRefreshToken();
    const response = await http.post<RefreshResponse>(
      API_ENDPOINTS.REFRESH,
      refreshToken ? { refresh_token: refreshToken } : undefined,
    );
    const normalized = normalizeTokenResponse(response);
    if (normalized.refresh_token) {
      memoryStorage.setRefreshToken(normalized.refresh_token);
    }
    return normalized;
  },

  changePassword(data: ChangePasswordRequest) {
    return http.post<null>(API_ENDPOINTS.CHANGE_PASSWORD, data);
  },
};

export { useLogin } from "@/modules/auth/hooks/use-login";
export { useLogout } from "@/modules/auth/hooks/use-logout";
