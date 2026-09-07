import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMutationErrorMessage,
  normalizeError,
} from "@/shared/api/api-error";
import { applyQueryCacheDefaults } from "@/shared/cache/apply-query-defaults";

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
// - staleTime/gcTime: KHÔNG còn một con số chung. Giá trị dưới đây chỉ là lưới
//   an toàn cho query chưa có root trong QUERY_CACHE_REGISTRY; chính sách thật
//   nằm ở @/shared/cache/cache-policy.ts và được áp theo tiền tố khoá bằng
//   applyQueryCacheDefaults() ngay dưới đây. Lý do: danh mục kho (đổi vài tháng
//   một lần) và số tồn kho (đổi từng phút) không thể dùng chung một ngưỡng.
// - retry: 4xx không retry; transient/network/5xx retry tối đa 1 lần.
// - refetchOnWindowFocus false: tránh tự refetch gây giật UI.
// - mutations retry 0: không tự retry POST/PUT/DELETE để tránh lặp side effect.
export const queryClient = new QueryClient({
  // Lưới an toàn: mutation nào KHÔNG tự khai onError sẽ vẫn báo lỗi cho người
  // dùng bằng thông điệp thân thiện, thay vì thất bại trong im lặng. Mutation
  // đã có onError riêng thì giữ nguyên (tránh toast trùng đôi).
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return;
      toast.error(getMutationErrorMessage(error));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
      // WWHN-325: networkMode mặc định "online" sẽ PAUSE mutation khi
      // navigator.onLine=false (mutationFn không chạy, guard offline ở axios
      // không kịp chặn) rồi TỰ RESUME và bắn request khi có mạng lại — đúng
      // hành vi queue+replay mà chính sách offline fail-closed cấm. "always"
      // buộc mutationFn chạy ngay để guard reject tức thì với
      // OFFLINE_MUTATION_BLOCKED, không giữ hàng đợi nào.
      networkMode: "always",
    },
  },
});

// Phải chạy NGAY khi module được nạp, trước khi bất kỳ query nào mount: defaults
// đăng ký sau lần fetch đầu tiên sẽ không cứu được request đã bay đi.
applyQueryCacheDefaults(queryClient);
