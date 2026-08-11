import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createIamUserWithRole,
  getIamRoles,
  getIamUsers,
  updateIamUserWithRole,
} from "@/modules/iam/services/iam.service";
import { getMutationErrorMessage } from "@/shared/api/api-error";
import type {
  IamUserListParams,
  IamUserPayload,
  IamUserUpdatePayload,
} from "@/modules/iam/types/iam.types";

export const iamKeys = {
  all: ["iam"] as const,
  users: (params: IamUserListParams) => [...iamKeys.all, "users", params] as const,
  roles: () => [...iamKeys.all, "roles"] as const,
};

export function useIamUsers(params: IamUserListParams) {
  return useQuery({
    queryKey: iamKeys.users(params),
    queryFn: () => getIamUsers(params),
  });
}

export function useIamRoles() {
  return useQuery({
    queryKey: iamKeys.roles(),
    queryFn: getIamRoles,
    staleTime: 60_000,
  });
}

export function useCreateIamUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, roleId }: { payload: IamUserPayload; roleId: string }) =>
      createIamUserWithRole(payload, roleId),
    onSuccess: () => {
      toast.success("Đã thêm người dùng");
      queryClient.invalidateQueries({ queryKey: iamKeys.all });
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
      queryClient.invalidateQueries({ queryKey: iamKeys.all });
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error));
    },
  });
}
