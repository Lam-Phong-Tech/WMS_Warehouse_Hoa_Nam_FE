import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import type { Permission } from '@/shared/types/permission';

export const permissionsService = {
  /** Danh mục toàn bộ quyền trong hệ thống. GET /permissions */
  list(): Promise<Permission[]> {
    return http.get<Permission[]>(API_ENDPOINTS.PERMISSIONS);
  },
};
