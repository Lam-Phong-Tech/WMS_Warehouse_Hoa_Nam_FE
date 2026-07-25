import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { authService } from '@/modules/auth/services/auth.service';
import { useAuthStore } from '@/shared/store/auth.store';
import type { SwitchContextRequest } from '@/modules/auth/types/auth.types';

/**
 * Query key gốc (queryKey[0]) của các domain ĐÃ XÁC NHẬN không lọc theo
 * data-scope (org_unit/department/warehouse) của context hiện tại — an toàn
 * giữ nguyên cache khi đổi context thay vì phải gọi lại API.
 *
 * P2: cố tình để danh sách này rất ngắn/bảo thủ. Chỉ thêm domain vào đây khi
 * đã xác nhận chắc chắn (đọc BE contract hoặc hỏi BE) rằng response không đổi
 * theo data-scope — thêm sai một domain vào đây gây stale data khó phát
 * hiện (nặng hơn nhiều so với việc invalidate thừa, vốn chỉ tốn 1 lần gọi lại
 * API). Domain mới/chưa xác nhận cứ để bị invalidate theo mặc định.
 *
 * - 'audit-logs': nhật ký hệ thống — quyền xem được BE enforce theo permission
 *   AUDIT_VIEW tại thời điểm gọi API, nội dung không lọc theo org_unit/
 *   department/warehouse của context đang chọn.
 */
const CONTEXT_INDEPENDENT_QUERY_ROOTS: readonly string[] = ['audit-logs'];

/** Tách riêng khỏi hook để unit test được mà không cần mock QueryClient. */
export function isContextScopedQuery(queryKey: QueryKey): boolean {
  const root = queryKey[0];
  return !(
    typeof root === 'string' && CONTEXT_INDEPENDENT_QUERY_ROOTS.includes(root)
  );
}

/**
 * Đổi bối cảnh hoạt động (vai trò + phạm vi) thật trên server.
 * POST /auth/switch-context cấp JWT mới đã nhúng context được chọn (token cũ
 * bị blacklist ngay) → lưu token mới → invalidate GET /auth/me để refetch
 * permission_codes/currentContext đúng theo context mới (xem
 * auth.store.setProfile). Hầu hết cache React Query cũng bị invalidate vì
 * data-scope (org_unit/department/warehouse) đổi theo context — trừ các
 * domain trong CONTEXT_INDEPENDENT_QUERY_ROOTS ở trên.
 */
export function useSwitchContext() {
  const queryClient = useQueryClient();
  const setToken = useAuthStore((s) => s.setToken);

  return useMutation({
    mutationFn: (data: SwitchContextRequest) => authService.switchContext(data),
    onSuccess: async (result) => {
      setToken(result.access_token);
      await queryClient.invalidateQueries({
        predicate: (query) => isContextScopedQuery(query.queryKey),
      });
    },
  });
}
