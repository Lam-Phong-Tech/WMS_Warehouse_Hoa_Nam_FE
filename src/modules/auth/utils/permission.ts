import { useAuthStore } from "@/shared/store/auth.store";
import {
  canonicalizeWmsPermission,
  hasAnyWmsPermission,
} from "@/shared/constants/wms-permissions";
import type { ScopeType } from "@/shared/types/permission.scope";

/**
 * @internal Không import file này trực tiếp trong code ứng dụng — dùng
 * `import { usePermissionState, hasPermission, useCan, useHasPermission } from '@/shared/components/permission'`
 * (component-level) hoặc `@/lib/permissions` (route-level/Can legacy).
 * Import trực tiếp bị chặn bởi ESLint `no-restricted-imports`
 * (eslint.config.js), trừ các file nội bộ triển khai hệ thống permission.
 */

export interface PermissionState {
  isSuperAdmin: boolean;
  permissionCodes: string[];
  currentScopeType: ScopeType | null;
  currentOrgUnitId: number | null;
  currentDepartmentId: number | null;
}

export function usePermissionState(): PermissionState {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const permissionCodes = useAuthStore((s) => s.permissionCodes);
  const currentContext = useAuthStore((s) => s.currentContext);
  const currentScopeType =
    (currentContext?.scope_type as ScopeType | null) ?? null;
  return {
    isSuperAdmin,
    permissionCodes,
    currentScopeType,
    currentOrgUnitId: currentContext?.org_unit_id ?? null,
    currentDepartmentId: currentContext?.department_id ?? null,
  };
}

/**
 * Hàm thuần kiểm tra permission. WMS code cũ được chuẩn hóa sang code canonical
 * trước khi so khớp để tránh UI và runtime catalog hiểu hai tên khác nhau.
 */
export function hasPermission(code: string, state: PermissionState): boolean {
  if (state.isSuperAdmin) return true;
  const canonicalCode = canonicalizeWmsPermission(code);
  return hasAnyWmsPermission(
    state.permissionCodes,
    [canonicalCode],
    state.isSuperAdmin,
  );
}

export function useCan(code: string): boolean {
  const state = usePermissionState();
  return hasPermission(code, state);
}

export function useHasPermission() {
  const state = usePermissionState();
  return (code: string) => hasPermission(code, state);
}
