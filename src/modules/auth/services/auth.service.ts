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
import type { MeContext, MeResponse } from "@/modules/auth/types/me.types";
import type { User, UserRoleAssignment } from "@/shared/types/user";
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
  roles?: UserRoleAssignment[];
  permissions?: string[];
  warehouse_scope_ids?: string[];
};

type BackendLoginResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  user?: BackendUser;
};

type BackendMeResponse = BackendUser & {
  status?: string;
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
function deriveContexts(user: User, permissionCodes: string[] = []): MeContext[] {
  const roles = user.roles ?? [];
  const roleScopeRefs = roles
    .map((role) => role.scope_ref)
    .filter((value): value is string => Boolean(value));
  const warehouseScopes = Array.from(
    new Set([...(user.warehouse_scope_ids ?? []), ...roleScopeRefs]),
  );

  if (warehouseScopes.length > 0) {
    return warehouseScopes.map((scopeRef) => {
      const role = roles.find((item) => item.scope_ref === scopeRef) ?? roles[0];
      return {
        role_id: role?.role_id ?? scopeRef,
        role_name: role?.role_name ?? "Phạm vi kho",
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

function normalizeLoginResponse(data: BackendLoginResponse): LoginResponse {
  const user = normalizeUser(data.user);
  return {
    access_token: requireNonEmptyString(data.access_token, "access_token"),
    refresh_token: requireNonEmptyString(data.refresh_token, "refresh_token"),
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
    phone: null,
    company: null,
    branch: null,
    department: null,
    position: null,
    role: {
      id: 0,
      name: roles[0]?.role_name ?? "",
      permissions: [],
    },
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

export const authService = {
  async login(data: LoginRequest) {
    const response = await http.post<BackendLoginResponse>(API_ENDPOINTS.LOGIN, data);
    const normalized = normalizeLoginResponse(response);
    memoryStorage.setRefreshToken(normalized.refresh_token);
    return normalized;
  },

  logout() {
    const refreshToken = memoryStorage.getRefreshToken();
    memoryStorage.removeRefreshToken();
    return http.post<null>(
      API_ENDPOINTS.LOGOUT,
      refreshToken ? { refresh_token: refreshToken } : {},
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

  /**
   * Refresh supports two transports:
   * - memory token in JSON for same-tab/backward-compatible clients;
   * - HttpOnly cookie when JavaScript memory was lost by F5/new page load.
   *
   * The browser cannot inspect the HttpOnly cookie, therefore missing memory state
   * must never be treated as an unauthenticated session before this request runs.
   */
  async refresh(refreshToken?: string) {
    const token = refreshToken ?? memoryStorage.getRefreshToken();
    const response = await http.post<RefreshResponse>(
      API_ENDPOINTS.REFRESH,
      token ? { refresh_token: token } : {},
    );
    const normalized = normalizeTokenResponse(response);
    memoryStorage.setRefreshToken(
      requireNonEmptyString(normalized.refresh_token, "refresh_token"),
    );
    return normalized;
  },

  changePassword(data: ChangePasswordRequest) {
    return http.post<null>(API_ENDPOINTS.CHANGE_PASSWORD, data);
  },
};

export { useLogin } from "@/modules/auth/hooks/use-login";
export { useLogout } from "@/modules/auth/hooks/use-logout";
