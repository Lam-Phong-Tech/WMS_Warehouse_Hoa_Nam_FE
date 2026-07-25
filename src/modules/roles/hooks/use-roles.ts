import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  rolesService,
  type RoleListParams,
} from '@/modules/roles/services/roles.service';
import { userRoleScopesService } from '@/modules/roles/services/user-role-scopes.service';
import { rolesKeys } from '@/modules/roles/services/roles.keys';
import type {
  RolePayload,
  RoleSyncPermissionsPayload,
} from '@/modules/roles/types/roles.types';

export const useRoles = (
  params: RoleListParams = {},
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: [...rolesKeys.lists(), params],
    queryFn: () => rolesService.getRoles(params),
    placeholderData: keepPreviousData,
    ...options,
  });
};

export const useRole = (id: number | null) => {
  return useQuery({
    queryKey: rolesKeys.detail(id!),
    queryFn: () => rolesService.getById(id!),
    enabled: id !== null,
  });
};

export const useCreateRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RolePayload) => rolesService.create(payload),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: rolesKeys.lists() });
    },
  });
};

export const useUpdateRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RolePayload }) =>
      rolesService.update(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() });
      return queryClient.invalidateQueries({ queryKey: rolesKeys.detail(id) });
    },
  });
};

export const useDeleteRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => rolesService.delete(id),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
  });
};

export const useRestoreRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rolesService.restore(id),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
  });
};

export const useArchiveRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rolesService.archive(id),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
  });
};

/** Gán (sync) danh sách quyền cho một vai trò. */
export const useSyncRolePermissions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: RoleSyncPermissionsPayload;
    }) => rolesService.syncPermissions(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() });
      return queryClient.invalidateQueries({ queryKey: rolesKeys.detail(id) });
    },
  });
};

/** Lấy danh sách phân quyền người dùng. Có thể lọc theo user_id, phân trang thật. */
export const useUserRoleScopes = (userId?: number, page = 1, perPage = 15) => {
  return useQuery({
    queryKey: ['user-role-scopes', userId, page, perPage],
    queryFn: () =>
      userRoleScopesService.getUserRoles({
        user_id: userId,
        page,
        per_page: perPage,
      }),
    placeholderData: (prev) => prev,
  });
};

/**
 * Đếm số nhân viên (distinct user) được gán cho TỪNG vai trò — dữ liệu thật
 * từ bảng `user_role_scopes` (thay thế mock `getMockUsersCount` cũ).
 * Trả về map `{ [role_id]: số_nhân_viên }` và trạng thái loading/error để UI
 * có thể hiển thị placeholder thay vì số ảo.
 */
export const useRoleUserCounts = () => {
  return useQuery<Record<number, number>>({
    queryKey: ['role-user-counts'],
    queryFn: () => userRoleScopesService.getRoleUserCounts(),
    staleTime: 60_000,
  });
};
