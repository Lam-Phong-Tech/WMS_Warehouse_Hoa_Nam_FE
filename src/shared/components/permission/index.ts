/**
 * Public API DUY NHẤT cho permission/component-level guard (UI: hide/disable
 * action theo permission + scope). Xem README.md trong thư mục này.
 *
 * Không import trực tiếp từ `@/shared/hooks/usePermission` hay
 * `@/modules/auth/utils/permission` trong code ứng dụng — luôn qua barrel
 * này (enforce bằng ESLint `no-restricted-imports`, xem eslint.config.js).
 *
 * Route-level guard (RequirePermission/ProtectedRoute) và data-scope theo
 * context (useDataScope) nằm ở entry point riêng: `@/lib/permissions`.
 */
export { PermissionGuard } from "./PermissionGuard";
export { ActionButton } from "./ActionButton";
export type { PermissionGuardProps } from "./PermissionGuard";
export type { ActionButtonProps } from "./ActionButton";

// Re-export row-level scope helpers
export {
  canAction,
  getRecordScope,
  type RowScopeRecord,
  canActionOnRow,
  canActionOnRowWithScope,
  isRecordInScopeById,
  type RowScopeContext,
  type RowScopeTarget,
} from "@/shared/types/permission.scope";
export { Can } from "@/modules/auth/components/Can";
export type { CanProps } from "@/modules/auth/components/Can";

// Re-export permission utilities for convenience
export {
  usePermissionState,
  hasPermission,
  useCan,
  useHasPermission,
} from "@/modules/auth/utils/permission";

// Re-export usePermission hook (module+action scope-aware check) + tiện ích
export {
  usePermission,
  useCanAny,
  useCanAll,
} from "@/shared/hooks/usePermission";
