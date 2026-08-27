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
  /**
   * BE tính từ chính bảng route lúc chạy (Modules/Auth/app/Support/PermissionEnforcementMap):
   * `false` = mã còn trong danh mục nhưng KHÔNG cổng nào đọc tới, tick vào ma trận
   * IAM-01 không cấp thêm gì. Optional để không vỡ với BE cũ hơn — thiếu trường thì
   * coi như còn hiệu lực.
   */
  is_enforced?: boolean;
  /** Mã canonical thay thế cho một mã đã ngừng hiệu lực (null nếu không phải mã cũ). */
  replaced_by?: string | null;
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

export interface IamDepartmentListParams {
  keyword?: string;
  status?: "ACTIVE" | "INACTIVE" | "";
  page?: number;
  per_page?: number;
}

export interface IamUser {
  user_id: string;
  username: string;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  department_id?: string | null;
  /** REQ-011: BE eager-load relation `department` trong user list. */
  department?: {
    department_id: string;
    department_code?: string;
    department_name: string;
  } | null;
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
  reason: string;
}

/** Quyền cấp riêng cho 1 tài khoản, cộng thêm vào quyền theo role (chỉ cấp thêm, không thu hồi quyền của role). */
export interface IamUserPermissionOverride {
  user_permission_id: string;
  permission_id: string;
  permission_key: string;
  permission_name: string;
  granted_by?: string | null;
  granted_at?: string | null;
}

export interface IamGrantUserPermissionPayload {
  permission_id: string;
  reason: string;
}

export interface IamRevokeUserPermissionPayload {
  reason: string;
}
