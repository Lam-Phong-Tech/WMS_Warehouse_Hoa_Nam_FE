import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userRoleScopesService } from '@/modules/roles/services/user-role-scopes.service';
import type { AssignRoleToUserPayload } from '@/modules/roles/services/user-role-scopes.service';

export const useRolesAssignRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AssignRoleToUserPayload) =>
      userRoleScopesService.assignRoleToUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-role-scopes'] });
    },
  });
};

export const useRolesUpdateRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: AssignRoleToUserPayload;
    }) => userRoleScopesService.updateRoleScope(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-role-scopes'] });
    },
  });
};

export const useRolesRevokeRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      userRoleScopesService.revokeRoleFromUser(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-role-scopes'] });
    },
  });
};

export const useRevokeDataScope = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      userRoleScopesService.revokeDataScope(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-scopes'] });
    },
  });
};
