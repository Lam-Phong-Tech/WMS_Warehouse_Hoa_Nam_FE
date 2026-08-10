import type { AuthContext } from "@/modules/auth/types/auth.types";

export interface MeOrgRef {
  id: number;
  name: string;
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
}

/** GET /api/v1/auth/me — contract theo BE branch m1. */
export interface MeResponse {
  id: number | string;
  user_id?: string;
  username?: string;
  name: string;
  display_name?: string;
  email: string;
  code: string;
  status?: string;
  roles: MeRoleAssignment[];
  permissions: string[];
  warehouse_scope_ids: string[];

  // Các field compatibility được FE giữ lại để các màn hồ sơ/layout cũ không vỡ.
  phone?: string | null;
  company: MeOrgRef | null;
  branch: MeOrgRef | null;
  department: MeOrgRef | null;
  position: MeOrgRef | null;
  role: MeRole;
  active_context: MeContext | null;
  available_contexts: MeContext[];
  is_super_admin?: boolean;
}
