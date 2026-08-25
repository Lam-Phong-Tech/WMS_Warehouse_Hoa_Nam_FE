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

export interface IamDepartment {
  department_id: string;
  department_code: string;
  department_name: string;
  status: "ACTIVE" | "INACTIVE";
  description?: string | null;
}

export interface IamUser {
  user_id: string;
  username: string;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  department_id?: string | null;
  status: IamUserStatus;
  version: number;
  last_login_at?: string | null;
  roles?: IamRole[];
}

export interface IamUserListParams {
  keyword?: string;
  status?: IamUserStatus | "";
  department_id?: string;
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
  department_id?: string | null;
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
