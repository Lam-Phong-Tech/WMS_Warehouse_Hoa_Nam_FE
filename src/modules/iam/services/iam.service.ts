import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type {
  IamPermission,
  IamPermissionListParams,
  IamRole,
  IamRoleListParams,
  IamRolePayload,
  IamRoleUpdatePayload,
  IamSyncRolePermissionsPayload,
  IamUser,
  IamUserListParams,
  IamUserPayload,
  IamUserUpdatePayload,
} from "@/modules/iam/types/iam.types";

export interface IamPageResult<T> {
  data: T[];
  meta: Record<string, unknown>;
}

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
}

export async function getIamUsers(
  params: IamUserListParams,
): Promise<IamPageResult<IamUser>> {
  const result = await http.getPage<IamUser[]>(API_ENDPOINTS.USERS, {
    params: cleanParams({ ...params, per_page: params.per_page ?? 100 }),
  });
  return { data: result.data, meta: result.meta };
}

export async function getIamRoles(
  params: IamRoleListParams = {},
): Promise<IamPageResult<IamRole>> {
  const result = await http.getPage<IamRole[]>(API_ENDPOINTS.ROLES, {
    params: cleanParams({ ...params, per_page: params.per_page ?? 100 }),
  });
  return { data: result.data, meta: result.meta };
}

export async function getIamPermissions(
  params: IamPermissionListParams = {},
): Promise<IamPageResult<IamPermission>> {
  const result = await http.getPage<IamPermission[]>(
    API_ENDPOINTS.PERMISSIONS,
    {
      params: cleanParams({ ...params, per_page: params.per_page ?? 100 }),
    },
  );
  return { data: result.data, meta: result.meta };
}

export function getIamRole(roleId: string): Promise<IamRole> {
  return http.get<IamRole>(`${API_ENDPOINTS.ROLES}/${roleId}`);
}

export function createIamRole(payload: IamRolePayload): Promise<IamRole> {
  return http.post<IamRole>(API_ENDPOINTS.ROLES, payload);
}

export function updateIamRole(
  roleId: string,
  payload: IamRoleUpdatePayload,
): Promise<IamRole> {
  return http.patch<IamRole>(`${API_ENDPOINTS.ROLES}/${roleId}`, payload);
}

export function deleteIamRole(roleId: string): Promise<void> {
  return http.delete<void>(`${API_ENDPOINTS.ROLES}/${roleId}`);
}

export function syncIamRolePermissions(
  roleId: string,
  payload: IamSyncRolePermissionsPayload,
): Promise<IamRole> {
  return http.post<IamRole>(
    `${API_ENDPOINTS.ROLES}/${roleId}/permissions`,
    payload,
  );
}

export function createIamUser(payload: IamUserPayload): Promise<IamUser> {
  return http.post<IamUser>(API_ENDPOINTS.USERS, payload);
}

export function updateIamUser(
  userId: string,
  payload: IamUserUpdatePayload,
): Promise<IamUser> {
  return http.patch<IamUser>(`${API_ENDPOINTS.USERS}/${userId}`, payload);
}

export function assignIamUserRole(
  userId: string,
  roleId: string,
): Promise<IamUser> {
  return http.post<IamUser>(`${API_ENDPOINTS.USERS}/${userId}/roles`, {
    role_ids: [roleId],
  });
}

export async function createIamUserWithRole(
  payload: IamUserPayload,
  roleId: string,
): Promise<IamUser> {
  const created = await createIamUser(payload);
  return assignIamUserRole(created.user_id, roleId);
}

export async function updateIamUserWithRole(
  userId: string,
  payload: IamUserUpdatePayload,
  roleId: string,
  currentRoleId?: string,
): Promise<IamUser> {
  const updated = await updateIamUser(userId, payload);
  // Chỉ gọi endpoint gán role khi role thực sự đổi. BE chặn tự gán role cho
  // chính mình (SCR-IAM-01, no self-escalation) bất kể giá trị mới là gì, nên
  // gọi lại endpoint này một cách vô ích trên mỗi lần sửa hồ sơ của chính actor
  // (đổi số điện thoại, trạng thái...) sẽ luôn bị 409 dù không đổi vai trò.
  if (roleId === currentRoleId) {
    return updated;
  }
  return assignIamUserRole(userId, roleId);
}
