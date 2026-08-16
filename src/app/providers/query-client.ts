import { QueryClient } from "@tanstack/react-query";
import { normalizeError } from "@/shared/api/api-error";

// Retry đúng semantics của HTTP contract:
// - 4xx là lỗi auth/permission/validation/business contract -> fail fast để UI
//   hiển thị ngay, không tự gửi lại request không thể tự hết lỗi.
// - network/timeout/5xx có thể là transient -> retry tối đa 1 lần.
// Điều này đặc biệt quan trọng với 401/403: route/action/data guard phải quan sát
// được lỗi thật từ backend thay vì bị một automatic retry che khuất.
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const { status } = normalizeError(error);
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

// Tách riêng khỏi query-provider.tsx (chỉ export component) — gộp chung sẽ
// vi phạm react-refresh/only-export-components (file export cả component lẫn
// hằng số làm mất Fast Refresh). Xuất ra ngoài để useSwitchContext gọi
// invalidateQueries() sau khi POST /auth/switch-context thành công, và
// auth.store gọi clear() khi logout — tránh hiển thị dữ liệu scope cũ sau khi
// user đổi vai trò/phạm vi hoặc đổi tài khoản (xem docs/TASK_BLOCKERS.md).
//
// Defaults thống nhất cho toàn ERP:
// - staleTime 60s: giảm refetch thừa cho danh mục/danh sách.
// - gcTime 5 phút: giữ cache đủ lâu khi đổi tab.
// - retry: 4xx không retry; transient/network/5xx retry tối đa 1 lần.
// - refetchOnWindowFocus false: tránh tự refetch gây giật UI.
// - mutations retry 0: không tự retry POST/PUT/DELETE để tránh lặp side effect.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
