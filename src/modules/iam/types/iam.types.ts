export type IamUserStatus = "ACTIVE" | "INACTIVE" | "LOCKED";
export type IamRoleStatus = "ACTIVE" | "INACTIVE";
export type IamRoleScopeType = "SYSTEM" | "WAREHOUSE" | "FUNCTION";

export interface IamRolePivot {
  scope_ref?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface IamPermission {
  permission_id: string;
  permission_key: string;
  permission_name: string;
  scope_type?: IamRoleScopeType | null;
  status: IamRoleStatus;
}

export interface IamRole {
  role_id: string;
  role_code: string;
  role_name: string;
  scope_type?: IamRoleScopeType | null;
  status: IamRoleStatus;
  permissions?: IamPermission[];
  pivot?: IamRolePivot;
}

export interface IamUser {
  user_id: string;
  username: string;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  status: IamUserStatus;
  version: number;
  last_login_at?: string | null;
  roles?: IamRole[];
}

export interface IamUserListParams {
  keyword?: string;
  status?: IamUserStatus | "";
  page?: number;
  per_page?: number;
}

export interface IamRoleListParams {
  keyword?: string;
  status?: IamRoleStatus | "";
  scope_type?: IamRoleScopeType | "";
  page?: number;
  per_page?: number;
}

export interface IamPermissionListParams {
  keyword?: string;
  status?: IamRoleStatus | "";
  scope_type?: IamRoleScopeType | "";
  page?: number;
  per_page?: number;
}

export interface IamUserPayload {
  username: string;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  password?: string;
  status: IamUserStatus;
}

export interface IamUserUpdatePayload extends IamUserPayload {
  version: number;
}

export interface IamUserSaveInput {
  user: IamUserPayload | IamUserUpdatePayload;
  roleId: string;
}

/**
 * BR-IAM-08 "explicit role/scope assignment" + ERD user_roles: scope_ref là id
 * kho mà vai trò có hiệu lực (rỗng = toàn hệ thống), kèm cửa sổ hiệu lực.
 */
export interface IamUserRoleAssignment {
  role_id: string;
  scope_ref?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface IamRolePayload {
  role_code: string;
  role_name: string;
  scope_type?: IamRoleScopeType | null;
  status?: IamRoleStatus;
}

export type IamRoleUpdatePayload = Partial<IamRolePayload>;

export interface IamSyncRolePermissionsPayload {
  permission_ids: string[];
}
