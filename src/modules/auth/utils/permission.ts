import { useAuthStore } from "@/shared/store/auth.store";
import type { ScopeType } from "@/shared/types/permission.scope";

/**
 * @internal Không import file này trực tiếp trong code ứng dụng — dùng
 * `import { usePermissionState, hasPermission, useCan, useHasPermission } from '@/shared/components/permission'`
 * (component-level) hoặc `@/lib/permissions` (route-level/Can legacy).
 * Import trực tiếp bị chặn bởi ESLint `no-restricted-imports`
 * (eslint.config.js), trừ các file nội bộ triển khai hệ thống permission.
 */

/**
 * State quyền tập trung, đọc từ auth store.
 * Tất cả các hook kiểm tra quyền (useCan, useCanAny, useCanAll, usePermission)
 * đều dựa vào hook này để ĐẢM BẢO SỐ LƯỢNG HOOK GỌI LÀ HẰNG SỐ
 * (không bao giờ gọi hook bên trong if/loop → tuân thủ Rules of Hooks).
 *
 * Mở rộng: thêm `currentScopeType` từ AuthContext.active_context để các
 * component/hook có thể kiểm tra data scope (row-level) bên cạnh permission code.
 */
export interface PermissionState {
  isSuperAdmin: boolean;
  permissionCodes: string[];
  /** Scope type của context đang active. null nếu là super-admin hoặc chưa có context. */
  currentScopeType: ScopeType | null;
  /** org_unit_id của context đang active. null nếu super-admin/không áp dụng. */
  currentOrgUnitId: number | null;
  /** department_id của context đang active. null nếu super-admin/không áp dụng. */
  currentDepartmentId: number | null;
}

/**
 * Hook đọc state quyền TẬP TRUNG — chỉ gọi store đúng 1 lần.
 * Đây là nguồn duy nhất cung cấp dữ liệu quyền cho mọi hook permission khác.
 *
 * Từ version mới, state trả về thêm `currentScopeType` (từ AuthContext.scope_type)
 * để hỗ trợ row-level scope checking bên cạnh permission code check. Đồng thời
 * trả thêm `currentOrgUnitId`/`currentDepartmentId` để so khớp theo ID cụ thể
 * với record (org_unit_id/department_id của bản ghi) — cần thiết vì BE chưa
 * trả field `scope`/`scope_type` theo từng record (xem `permission.scope.ts`).
 */
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
 * Hàm thuần (KHÔNG PHẢI HOOK): kiểm tra 1 permission code dựa trên state.
 * Dùng an toàn bên trong .some() / .every() / useMemo / render.
 */
export function hasPermission(code: string, state: PermissionState): boolean {
  return state.isSuperAdmin || state.permissionCodes.includes(code);
}

/** Tiện ích: có quyền `code` hay không. */
export function useCan(code: string): boolean {
  const state = usePermissionState();
  return hasPermission(code, state);
}

/**
 * Trả về hàm kiểm tra quyền: Super Admin có tất cả,
 * còn lại dựa trên danh sách permission_codes.
 */
export function useHasPermission() {
  const state = usePermissionState();
  return (code: string) => hasPermission(code, state);
}
