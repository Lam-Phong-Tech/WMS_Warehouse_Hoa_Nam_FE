import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import type {
  IamDepartment,
  IamDepartmentListParams,
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
  IamUserRoleAssignment,
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

/**
 * REQ-011: danh sách Phòng ban chỉ để gán/lọc trên màn User (user đã chủ ý bỏ
 * tab quản lý master Phòng ban nên không có create/update ở FE).
 * GET /departments trả respondPaginated chuẩn.
 */
export async function getIamDepartments(
  params: IamDepartmentListParams = {},
): Promise<IamPageResult<IamDepartment>> {
  const result = await http.getPage<IamDepartment[]>(
    API_ENDPOINTS.DEPARTMENTS,
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

/**
 * §8.1 IAM "If-Match on update": optimistic lock đi qua header như mọi aggregate
 * khác (412 STALE_VERSION), thay vì chỉ nhét `version` vào body.
 */
export function updateIamUser(
  userId: string,
  payload: IamUserUpdatePayload,
): Promise<IamUser> {
  return http.patch<IamUser>(`${API_ENDPOINTS.USERS}/${userId}`, payload, {
    headers: { "If-Match": String(payload.version) },
  });
}

/**
 * BR-IAM-08 + §8.1 IAM "explicit role/scope assignment": gửi dạng `roles[]` để
 * kèm được scope_ref (id kho) và cửa sổ hiệu lực, thay cho `role_ids[]` chỉ gán
 * được vai trò trần.
 */
export function assignIamUserRole(
  userId: string,
  assignment: IamUserRoleAssignment,
): Promise<IamUser> {
  return http.post<IamUser>(`${API_ENDPOINTS.USERS}/${userId}/roles`, {
    roles: [
      {
        role_id: assignment.role_id,
        scope_ref: assignment.scope_ref?.trim() ? assignment.scope_ref : null,
        effective_from: assignment.effective_from || null,
        effective_to: assignment.effective_to || null,
      },
    ],
  });
}

export async function createIamUserWithRole(
  payload: IamUserPayload,
  assignment: IamUserRoleAssignment,
): Promise<IamUser> {
  const created = await createIamUser(payload);
  return assignIamUserRole(created.user_id, assignment);
}

export async function updateIamUserWithRole(
  userId: string,
  payload: IamUserUpdatePayload,
  assignment: IamUserRoleAssignment,
  current?: IamUserRoleAssignment,
): Promise<IamUser> {
  const updated = await updateIamUser(userId, payload);
  // Chỉ gọi endpoint gán role khi role hoặc phạm vi thực sự đổi. BE chặn tự gán
  // role cho chính mình (SCR-IAM-01, no self-escalation) bất kể giá trị mới là
  // gì, nên gọi lại endpoint này một cách vô ích trên mỗi lần sửa hồ sơ của
  // chính actor (đổi số điện thoại, trạng thái...) sẽ luôn bị 409 dù không đổi.
  const unchanged =
    assignment.role_id === current?.role_id &&
    (assignment.scope_ref || null) === (current?.scope_ref || null) &&
    (assignment.effective_from || null) === (current?.effective_from || null) &&
    (assignment.effective_to || null) === (current?.effective_to || null);
  if (unchanged) {
    return updated;
  }
  return assignIamUserRole(userId, assignment);
}
