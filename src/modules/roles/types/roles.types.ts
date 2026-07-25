import type { Permission } from '@/shared/types/permission';
export type { Permission } from '@/shared/types/permission';

export interface Role {
  id: number;
  code: string;
  name: string;
  tenant_id?: number | null;
  description: string | null;
  type: 'co_dinh' | 'linh_hoat';
  status: number;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  permissions: Permission[];
  /** Gợi ý scope khi gán role (VD: "1 chi nhánh", "Toàn doanh nghiệp") */
  scope_hint?: string;
  /** Số lượng user đang được gán role này */
  user_count?: number;
}

export interface RolePayload {
  code: string;
  name: string;
  description?: string;
  type?: 'co_dinh' | 'linh_hoat';
  status?: number;
}

/** Payload gán danh sách quyền cho vai trò. POST /roles/{id}/permissions */
export interface RoleSyncPermissionsPayload {
  permissions_id: number[];
}
