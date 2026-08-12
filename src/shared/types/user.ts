export interface UserRoleAssignment {
  role_id: string;
  role_code: string;
  role_name: string;
  scope_ref?: string | null;
}

export interface User {
  id: number | string;
  user_id?: string;
  username?: string;
  name: string | null;
  display_name?: string;
  email: string;
  code: string;
  roles?: UserRoleAssignment[];
  permissions?: string[];
  warehouse_scope_ids?: string[];
}
