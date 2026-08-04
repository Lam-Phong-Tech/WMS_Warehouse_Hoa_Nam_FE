/**
 * Thư viện phân quyền (Permission & Role & Data Scope) — điểm vào DUY NHẤT.
 *
 * Hệ thống phân quyền ERP gồm 3 lớp:
 *
 * 1. **Route Guard** (route-level)
 *    - `RequirePermission` — chặn truy cập route nếu thiếu quyền.
 *    - `ProtectedRoute` — chưa đăng nhập → redirect /login.
 *    - `ROUTE_PERMISSIONS` — map path → permission code (access.ts).
 *
 * 2. **Component Guard** (UI-level)
 *    - `<Can permission="x">` — chỉ render children khi có quyền.
 *    - `useHasPermission()` / `useCan()` — hook kiểm tra quyền.
 *    - `useHasRole()` — kiểm tra role (nếu cần).
 *
 * 3. **Data Scope** (data-level)
 *    - `useDataScope()` — phạm vi dữ liệu từ AuthContext đang chọn.
 *    - `scopeToParams()` — scope → query params gửi API.
 *
 * @example
 * ```tsx
 * // Route guard
 * <RequirePermission permission="USER_VIEW">
 *   <UsersPage />
 * </RequirePermission>
 *
 * // UI guard
 * <Can permission="USER_CREATE">
 *   <Button>Thêm người dùng</Button>
 * </Can>
 *
 * // Data scope
 * const scope = useDataScope();
 * const params = scopeToParams(scope); // { org_unit_id: 1 }
 * ```
 */
export { useCan, useHasPermission } from "@/modules/auth/utils/permission";
export { Can } from "@/modules/auth/components/Can";
export { RequirePermission } from "@/app/router/RequirePermission";
export { ProtectedRoute } from "@/app/router/ProtectedRoute";
export {
  useDataScope,
  scopeToParams,
  toDataScope,
} from "@/modules/auth/utils/data-scope";
export { ROUTE_PERMISSIONS } from "@/app/router/access";

// === Data-Scope Permission ===
// Module: kiểm tra scope requirement cho action
export type {
  ScopeType,
  ScopeRequirement,
} from "@/shared/types/permission.scope";
export {
  MODULE_SCOPE_REQUIREMENTS,
  getScopeRequirement,
  hasScopeForAction,
  meetsMinScope,
} from "@/shared/types/permission.scope";
