import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  SwitchContextRequest,
  SwitchContextResponse,
} from '@/modules/auth/types/auth.types';
import type { MeResponse } from '@/modules/auth/types/me.types';

export const authService = {
  login(data: LoginRequest) {
    return http.post<LoginResponse>(API_ENDPOINTS.LOGIN, data);
  },

  logout() {
    return http.post<null>(API_ENDPOINTS.LOGOUT);
  },

  me() {
    return http.get<MeResponse>(API_ENDPOINTS.ME);
  },

  switchContext(data: SwitchContextRequest) {
    return http.post<SwitchContextResponse>(API_ENDPOINTS.SWITCH_CONTEXT, data);
  },

  /**
   * BE đọc refresh_token từ HttpOnly cookie — không cần body. Gọi qua `api`
   * trực tiếp (không phải `http`) trong axios interceptor để tránh vòng lặp
   * interceptor 401 tự refresh chính request refresh.
   */
  refresh() {
    return http.post<RefreshResponse>(API_ENDPOINTS.REFRESH);
  },

  changePassword(data: ChangePasswordRequest) {
    return http.post<null>(API_ENDPOINTS.CHANGE_PASSWORD, data);
  },
};

// Cửa công khai của module auth (gộp từ index.ts).
export { useLogin } from '@/modules/auth/hooks/use-login';
export { useLogout } from '@/modules/auth/hooks/use-logout';
