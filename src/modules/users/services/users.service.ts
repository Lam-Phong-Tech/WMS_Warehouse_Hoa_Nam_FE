import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import type { User } from '@/modules/users/types/users.types';

interface RawEmployee {
  user_id: number;
  code?: string;
  full_name?: string;
  email?: string;
  user: {
    email?: string;
    role?: string;
  };
  salary?: number;
  hire_date?: string | null;
  status?: number;
}

// Nơi cấu hình mọi lời gọi API của module users (cửa công khai của module).
export const usersService = {
  async list(): Promise<User[]> {
    const employees = await http.get<RawEmployee[]>(API_ENDPOINTS.EMPLOYEES);
    return (employees || [])
      .filter((emp) => emp && emp.user_id != null && emp.user != null)
      .map((emp) => ({
        id: emp.user_id,
        code: emp.code || `USER-${emp.user_id}`,
        name: emp.full_name || emp.user.email || `User #${emp.user_id}`,
        email: emp.email || emp.user.email || '',
        role: emp.user.role || 'staff',
        salary: emp.salary || 0,
        joinedAt: emp.hire_date || null,
        active: emp.status === undefined ? true : emp.status === 1,
      }));
  },

  /**
   * Vô hiệu hóa tài khoản người dùng. BE đã xác nhận: không có endpoint
   * /users/{id}/inactive riêng — chỉ có GET/PUT/DELETE /users/{id}. Tạm
   * dùng PUT /users/{id} với field status (0 = inactive) cho tới khi BE bổ
   * sung endpoint dedicated.
   */
  inactive(
    id: number,
    payload?: {
      reason?: string;
      effective_date?: string;
      confirm_14_day_rule?: boolean;
    },
  ) {
    return http.put<void>(`${API_ENDPOINTS.USERS}/${id}`, {
      status: 0,
      reason: payload?.reason || null,
      effective_date: payload?.effective_date || null,
    });
  },

  /**
   * Khôi phục / kích hoạt lại tài khoản người dùng. BE đã xác nhận: không có
   * endpoint /users/{id}/restore riêng. Tạm dùng PUT /users/{id} với
   * status: 1 cho tới khi BE bổ sung endpoint dedicated.
   */
  restore(id: number) {
    return http.put<void>(`${API_ENDPOINTS.USERS}/${id}`, { status: 1 });
  },
};

// Re-export hooks
export { useUsers } from '@/modules/users/hooks/use-users';
