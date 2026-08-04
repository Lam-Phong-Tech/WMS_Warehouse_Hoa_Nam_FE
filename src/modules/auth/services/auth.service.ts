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
import type { MeResponse } from "@/modules/auth/types/me.types";
import type { User } from "@/shared/types/user";
import { memoryStorage } from "@/shared/lib/memory-storage";

type BackendUser = Partial<User> & {
  user_id?: string;
  username?: string;
  display_name?: string;
  permissions?: string[];
};

type BackendLoginResponse = Omit<Partial<LoginResponse>, "user"> & {
  user: BackendUser;
};

type BackendMeResponse = Partial<MeResponse> & BackendUser;

function normalizeUser(user: BackendUser): User {
  return {
    ...user,
    id: user.id ?? user.user_id ?? "",
    user_id: user.user_id,
    username: user.username,
    name: user.name ?? user.display_name ?? user.username ?? null,
    display_name: user.display_name,
    email: user.email ?? "",
    code: user.code ?? user.username ?? user.user_id ?? "",
    roles: user.roles,
    permissions: user.permissions,
  };
}

function normalizeContexts(
  contexts: AuthContext[] | undefined,
): AuthContext[] {
  return Array.isArray(contexts) ? contexts : [];
}

function normalizeLoginResponse(data: BackendLoginResponse): LoginResponse {
  return {
    access_token: data.access_token ?? "",
    refresh_token: data.refresh_token,
    token_type: data.token_type ?? "bearer",
    expires_in: data.expires_in ?? 0,
    user: normalizeUser(data.user),
    available_contexts: normalizeContexts(data.available_contexts),
  };
}

function normalizeMeResponse(data: BackendMeResponse): MeResponse {
  const user = normalizeUser(data);
  const roles = data.roles ?? [];
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
    permissions: data.permissions ?? [],
    phone: data.phone ?? null,
    company: data.company ?? null,
    branch: data.branch ?? null,
    department: data.department ?? null,
    position: data.position ?? null,
    role: data.role ?? { id: 0, name: roles[0]?.role_name ?? "", permissions: [] },
    active_context: data.active_context ?? null,
    available_contexts: data.available_contexts ?? [],
    is_super_admin: isSuperAdmin,
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

  switchContext(data: SwitchContextRequest) {
    return http.post<SwitchContextResponse>(API_ENDPOINTS.SWITCH_CONTEXT, data);
  },

  /**
   * BE đọc refresh_token từ HttpOnly cookie — không cần body. Gọi qua `api`
   * trực tiếp (không phải `http`) trong axios interceptor để tránh vòng lặp
   * interceptor 401 tự refresh chính request refresh.
   */
  async refresh() {
    const refreshToken = memoryStorage.getRefreshToken();
    const response = await http.post<RefreshResponse>(
      API_ENDPOINTS.REFRESH,
      refreshToken ? { refresh_token: refreshToken } : undefined,
    );
    if (response.refresh_token) {
      memoryStorage.setRefreshToken(response.refresh_token);
    }
    return response;
  },

  changePassword(data: ChangePasswordRequest) {
    return http.post<null>(API_ENDPOINTS.CHANGE_PASSWORD, data);
  },
};

// Cửa công khai của module auth (gộp từ index.ts).
export { useLogin } from "@/modules/auth/hooks/use-login";
export { useLogout } from "@/modules/auth/hooks/use-logout";
