export interface UserRoleAssignment {
  role_id: string;
  role_code: string;
  role_name: string;
  scope_ref?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  reason?: "EXPIRED" | "NOT_YET_EFFECTIVE" | null;
}

export interface User {
  id: number | string;
  user_id?: string;
  username?: string;
  name: string | null;
  display_name?: string;
  email: string;
  code: string;
  phone?: string | null;
  avatar?: {
    mime_type: string;
    size: number;
    updated_at: string;
    url: string;
  } | null;
  last_login_at?: string | null;
  status?: string;
  roles?: UserRoleAssignment[];
  inactive_roles?: UserRoleAssignment[];
  permissions?: string[];
  warehouse_scope_ids?: string[];
}
