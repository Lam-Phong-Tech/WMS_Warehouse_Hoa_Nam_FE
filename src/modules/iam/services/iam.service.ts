import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type {
  IamRole,
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

export async function getIamRoles(): Promise<IamRole[]> {
  const result = await http.getPage<IamRole[]>(API_ENDPOINTS.ROLES, {
    params: { per_page: 100, status: "ACTIVE" },
  });
  return result.data;
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
): Promise<IamUser> {
  await updateIamUser(userId, payload);
  return assignIamUserRole(userId, roleId);
}
