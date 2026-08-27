import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createIamRole,
  createIamUserWithRole,
  deleteIamRole,
  getIamDepartments,
  getIamPermissions,
  getIamRole,
  getIamRoles,
  getIamUserPermissionOverrides,
  getIamUsers,
  grantIamUserPermission,
  revokeIamUserPermission,
  syncIamRolePermissions,
  updateIamRole,
  updateIamUserWithRole,
} from "@/modules/iam/services/iam.service";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import { getMutationErrorMessage } from "@/shared/api/api-error";
import type {
  IamDepartmentListParams,
  IamGrantUserPermissionPayload,
  IamPermissionListParams,
  IamRoleListParams,
  IamRolePayload,
  IamRoleUpdatePayload,
  IamUserListParams,
  IamUserPayload,
  IamUserRoleAssignment,
  IamUserUpdatePayload,
} from "@/modules/iam/types/iam.types";

export const iamKeys = {
  all: ["iam"] as const,
  users: (params: IamUserListParams) =>
    [...iamKeys.all, "users", params] as const,
  roles: (params: IamRoleListParams = {}) =>
    [...iamKeys.all, "roles", params] as const,
  role: (roleId: string) => [...iamKeys.all, "role", roleId] as const,
  permissions: (params: IamPermissionListParams = {}) =>
    [...iamKeys.all, "permissions", params] as const,
  departments: (params: IamDepartmentListParams = {}) =>
    [...iamKeys.all, "departments", params] as const,
};

/**
 * REQ-011: dropdown Phòng ban trên màn User (lọc + gán khi tạo/sửa).
 * Danh mục ít biến động nên cache 5 phút như danh sách kho.
 */
export function useIamDepartments(params: IamDepartmentListParams = {}) {
  return useQuery({
    queryKey: iamKeys.departments(params),
    queryFn: () => getIamDepartments(params),
    select: (result) => result.data,
    staleTime: 5 * 60_000,
  });
}

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

/**
 * BR-IAM-08: phạm vi dữ liệu (user_roles.scope_ref) trỏ tới kho, nên IAM-02 cần
 * danh sách kho để gán tường minh thay vì chỉ hiển thị scope_type của vai trò.
 */
export function useIamScopeWarehouses() {
  return useQuery({
    queryKey: [...iamKeys.all, "scope-warehouses"],
    queryFn: () => fetchWarehouses({ per_page: 100 }),
    staleTime: 5 * 60_000,
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
    mutationFn: ({
      roleId,
      payload,
    }: {
      roleId: string;
      payload: IamRoleUpdatePayload;
    }) => updateIamRole(roleId, payload),
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
    mutationFn: ({
      roleId,
      permissionIds,
      reason,
    }: {
      roleId: string;
      permissionIds: string[];
      reason: string;
    }) =>
      syncIamRolePermissions(roleId, {
        permission_ids: permissionIds,
        reason,
      }),
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
    mutationFn: ({
      payload,
      assignment,
      reason,
    }: {
      payload: IamUserPayload;
      assignment: IamUserRoleAssignment;
      reason: string;
    }) => createIamUserWithRole(payload, assignment, reason),
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
      assignment,
      reason,
      currentAssignment,
    }: {
      userId: string;
      payload: IamUserUpdatePayload;
      assignment: IamUserRoleAssignment;
      reason: string;
      currentAssignment?: IamUserRoleAssignment;
    }) =>
      updateIamUserWithRole(
        userId,
        payload,
        assignment,
        reason,
        currentAssignment,
      ),
    onSuccess: () => {
      toast.success("Đã cập nhật người dùng");
      void invalidateIam(queryClient);
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error));
    },
  });
}

/** Danh sách quyền cấp riêng (ngoài role) của 1 tài khoản. */
export function useIamUserPermissionOverrides(userId?: string) {
  return useQuery({
    queryKey: [...iamKeys.all, "user-permission-overrides", userId],
    queryFn: () => getIamUserPermissionOverrides(userId as string),
    enabled: Boolean(userId),
  });
}

export function useGrantIamUserPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: IamGrantUserPermissionPayload;
    }) => grantIamUserPermission(userId, payload),
    onSuccess: () => {
      toast.success("Đã cấp quyền riêng cho người dùng");
      void invalidateIam(queryClient);
    },
    onError: (error) => toast.error(getMutationErrorMessage(error)),
  });
}

export function useRevokeIamUserPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      permissionId,
      reason,
    }: {
      userId: string;
      permissionId: string;
      reason: string;
    }) => revokeIamUserPermission(userId, permissionId, { reason }),
    onSuccess: () => {
      toast.success("Đã thu hồi quyền cấp riêng");
      void invalidateIam(queryClient);
    },
    onError: (error) => toast.error(getMutationErrorMessage(error)),
  });
}
