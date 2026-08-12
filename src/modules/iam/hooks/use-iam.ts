import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createIamRole,
  createIamUserWithRole,
  deleteIamRole,
  getIamPermissions,
  getIamRole,
  getIamRoles,
  getIamUsers,
  syncIamRolePermissions,
  updateIamRole,
  updateIamUserWithRole,
} from "@/modules/iam/services/iam.service";
import { getMutationErrorMessage } from "@/shared/api/api-error";
import type {
  IamPermissionListParams,
  IamRoleListParams,
  IamRolePayload,
  IamRoleUpdatePayload,
  IamUserListParams,
  IamUserPayload,
  IamUserUpdatePayload,
} from "@/modules/iam/types/iam.types";

export const iamKeys = {
  all: ["iam"] as const,
  users: (params: IamUserListParams) => [...iamKeys.all, "users", params] as const,
  roles: (params: IamRoleListParams = {}) => [...iamKeys.all, "roles", params] as const,
  role: (roleId: string) => [...iamKeys.all, "role", roleId] as const,
  permissions: (params: IamPermissionListParams = {}) =>
    [...iamKeys.all, "permissions", params] as const,
};

export function useIamUsers(params: IamUserListParams) {
  return useQuery({
    queryKey: iamKeys.users(params),
    queryFn: () => getIamUsers(params),
  });
}

/** Keep data as IamRole[] for existing IAM-01 consumers. */
export function useIamRoles(params: IamRoleListParams = {}) {
  return useQuery({
    queryKey: iamKeys.roles(params),
    queryFn: () => getIamRoles(params),
    select: (result) => result.data,
    staleTime: 30_000,
  });
}

/** Use when a screen needs the role list together with API pagination metadata. */
export function useIamRolesPage(params: IamRoleListParams = {}) {
  return useQuery({
    queryKey: iamKeys.roles(params),
    queryFn: () => getIamRoles(params),
    staleTime: 30_000,
  });
}

export function useIamRole(roleId?: string) {
  return useQuery({
    queryKey: roleId ? iamKeys.role(roleId) : [...iamKeys.all, "role", "none"],
    queryFn: () => getIamRole(roleId as string),
    enabled: Boolean(roleId),
  });
}

export function useIamPermissions(params: IamPermissionListParams = {}) {
  return useQuery({
    queryKey: iamKeys.permissions(params),
    queryFn: () => getIamPermissions(params),
    select: (result) => result.data,
    staleTime: 60_000,
  });
}

function invalidateIam(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: iamKeys.all });
}

export function useCreateIamRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IamRolePayload) => createIamRole(payload),
    onSuccess: () => {
      toast.success("Đã tạo vai trò");
      void invalidateIam(queryClient);
    },
    onError: (error) => toast.error(getMutationErrorMessage(error)),
  });
}

export function useUpdateIamRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: string; payload: IamRoleUpdatePayload }) =>
      updateIamRole(roleId, payload),
    onSuccess: () => {
      toast.success("Đã cập nhật vai trò");
      void invalidateIam(queryClient);
    },
    onError: (error) => toast.error(getMutationErrorMessage(error)),
  });
}

export function useDeleteIamRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => deleteIamRole(roleId),
    onSuccess: () => {
      toast.success("Đã xoá vai trò");
      void invalidateIam(queryClient);
    },
    onError: (error) => toast.error(getMutationErrorMessage(error)),
  });
}

export function useSyncIamRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      syncIamRolePermissions(roleId, { permission_ids: permissionIds }),
    onSuccess: () => {
      toast.success("Đã áp dụng ma trận quyền");
      void invalidateIam(queryClient);
    },
    onError: (error) => toast.error(getMutationErrorMessage(error)),
  });
}

export function useCreateIamUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, roleId }: { payload: IamUserPayload; roleId: string }) =>
      createIamUserWithRole(payload, roleId),
    onSuccess: () => {
      toast.success("Đã thêm người dùng");
      void invalidateIam(queryClient);
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error));
    },
  });
}

export function useUpdateIamUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      payload,
      roleId,
    }: {
      userId: string;
      payload: IamUserUpdatePayload;
      roleId: string;
    }) => updateIamUserWithRole(userId, payload, roleId),
    onSuccess: () => {
      toast.success("Đã cập nhật người dùng");
      void invalidateIam(queryClient);
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error));
    },
  });
}
