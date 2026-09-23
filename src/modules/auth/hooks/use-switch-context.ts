import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import type { SwitchContextRequest } from "@/modules/auth/types/auth.types";
import { stopQueryPersistence } from "@/shared/cache/query-persister";

const CONTEXT_INDEPENDENT_QUERY_ROOTS: readonly string[] = ["audit-logs"];

export function isContextScopedQuery(queryKey: QueryKey): boolean {
  const root = queryKey[0];
  return !(
    typeof root === "string" && CONTEXT_INDEPENDENT_QUERY_ROOTS.includes(root)
  );
}

/**
 * Switch context is atomic from the UI perspective: once the new JWT arrives,
 * old profile/permissions are revoked immediately and all scope-sensitive data
 * is removed before protected UI can render again.
 */
export function useSwitchContext() {
  const queryClient = useQueryClient();
  const setToken = useAuthStore((s) => s.setToken);

  return useMutation({
    mutationFn: (data: SwitchContextRequest) => authService.switchContext(data),
    onSuccess: async (result) => {
      stopQueryPersistence();
      const scoped = {
        predicate: (query) => isContextScopedQuery(query.queryKey),
      } satisfies Parameters<typeof queryClient.cancelQueries>[0];
      // Cancel old requests before removing their data. Merely invalidating
      // leaves stale values available to the next context during refetch.
      await queryClient.cancelQueries(scoped);
      queryClient.removeQueries(scoped);
      setToken(result.access_token);
    },
    // Rỗng có chủ đích, KHÔNG thừa: ContextSwitcher.tsx tự toast qua callback
    // onError truyền vào .mutate(vars, {onError}) — nhưng đó là callback
    // PER-CALL của MutationObserver, tách biệt hoàn toàn khỏi
    // `mutation.options.onError` mà global MutationCache (query-client.ts)
    // kiểm tra để quyết định có tự bắn thêm toast hay không. Thiếu onError
    // NGAY TẠI ĐÂY (dù ContextSwitcher đã có onError riêng ở mutate()) thì
    // lưới an toàn vẫn không biết và tự bắn thêm 1 toast chung chung nữa.
    onError: () => {},
  });
}
