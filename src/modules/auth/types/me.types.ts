import type { AuthContext } from "@/modules/auth/types/auth.types";

export interface MeOrgRef {
  id: number;
  name: string;
}
export interface MeDepartmentRef {
  department_id?: string;
  department_name?: string;
  id?: number | string;
  name?: string;
}

export interface MePermission {
  id: number;
  name: string;
}

export interface MeRole {
  id: number;
  name: string;
  permissions: MePermission[];
}

export interface MeContext extends AuthContext {
  permission_codes: string[];
}

export interface MeRoleAssignment {
  role_id: string;
  role_code: string;
  role_name: string;
  scope_ref?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  reason?: "EXPIRED" | "NOT_YET_EFFECTIVE" | null;
}

/** GET /api/v1/auth/me — contract theo BE branch m1. */
export interface MeResponse {
  avatar?: {
    mime_type: string;
    size: number;
    updated_at: string;
    url: string;
  } | null;
  last_login_at?: string | null;
  id: number | string;
  user_id?: string;
  username?: string;
  name: string;
  display_name?: string;
  email: string;
  code: string;
  status?: string;
  version?: number;
  roles: MeRoleAssignment[];
  inactive_roles?: MeRoleAssignment[];
  permissions: string[];
  warehouse_scope_ids: string[];

  // Các field compatibility được FE giữ lại để các màn hồ sơ/layout cũ không vỡ.
  phone?: string | null;
  company: MeOrgRef | null;
  branch: MeOrgRef | null;
  department: MeDepartmentRef | null;
  position: MeOrgRef | null;
  role: MeRole | null;
  active_context: MeContext | null;
  available_contexts: MeContext[];
  is_super_admin?: boolean;
}
