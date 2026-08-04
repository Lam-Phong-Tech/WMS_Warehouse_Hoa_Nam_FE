import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import type { SwitchContextRequest } from "@/modules/auth/types/auth.types";

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
 * is invalidated before protected UI can render again.
 */
export function useSwitchContext() {
  const queryClient = useQueryClient();
  const setToken = useAuthStore((s) => s.setToken);

  return useMutation({
    mutationFn: (data: SwitchContextRequest) => authService.switchContext(data),
    onSuccess: async (result) => {
      setToken(result.access_token);
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
      await queryClient.invalidateQueries({
        predicate: (query) => isContextScopedQuery(query.queryKey),
      });
    },
  });
}
