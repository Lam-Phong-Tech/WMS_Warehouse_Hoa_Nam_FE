import { useEffect } from "react";
import { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";

/** Fetch profile/permission/data-scope for the exact current JWT. */
export function useMe() {
  const token = useAuthStore((s) => s.token);
  const setProfile = useAuthStore((s) => s.setProfile);

  const query = useQuery({
    // Token là một phần query key để response/cache của JWT cũ không thể ghi
    // đè permission/currentContext sau refresh hoặc switch-context.
    queryKey: ["auth", "me", token],
    queryFn: () => authService.me(),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401 || status === 403) return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  useEffect(() => {
    if (query.data && token) setProfile(query.data);
  }, [query.data, setProfile, token]);

  return query;
}
