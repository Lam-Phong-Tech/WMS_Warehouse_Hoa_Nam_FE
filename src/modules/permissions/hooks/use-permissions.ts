import { useQuery } from '@tanstack/react-query';
import { permissionsService } from '../services/permissions.service';

export const PERMISSIONS_QUERY_KEY = ['permissions'] as const;

/** Danh mục tất cả quyền hạn trong hệ thống. Dùng cho màn phân quyền vai trò. */
export function usePermissions() {
  return useQuery({
    queryKey: PERMISSIONS_QUERY_KEY,
    queryFn: permissionsService.list,
    staleTime: 10 * 60 * 1000, // Danh mục quyền ít thay đổi — cache 10 phút.
  });
}
