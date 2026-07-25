import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userRoleScopesService } from '@/modules/roles/services/user-role-scopes.service';

export const DATA_SCOPES_QUERY_KEY = 'data-scopes';

export const useDataScopes = (userId?: number) => {
  return useQuery({
    queryKey: [DATA_SCOPES_QUERY_KEY, userId],
    queryFn: async () => {
      const data = await userRoleScopesService.getUserDataScopes(userId!);
      return { data };
    },
    enabled: !!userId,
  });
};

export const useAddDataScope = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      user_id: number;
      scope_type: string;
      scope_id: number;
      allow: boolean;
      reason?: string | null;
      effective_from?: string | null;
      effective_to?: string | null;
    }) => userRoleScopesService.addDataScope(payload),
    onSuccess: (_, { user_id }) => {
      queryClient.invalidateQueries({
        queryKey: [DATA_SCOPES_QUERY_KEY, user_id],
      });
    },
  });
};

export const useRevokeDataScope = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      userRoleScopesService.revokeDataScope(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DATA_SCOPES_QUERY_KEY] });
    },
  });
};
