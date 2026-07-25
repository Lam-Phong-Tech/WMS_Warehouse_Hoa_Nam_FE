import { useAuthStore } from '@/shared/store/auth.store';
import type { AuthContext } from '@/modules/auth/types/auth.types';

/**
 * Phạm vi dữ liệu hiện tại (suy từ bối cảnh đang chọn ở ContextSwitcher).
 * Module dùng để lọc danh sách theo scope khi cần.
 */
export interface DataScope {
  scopeType: string;
  orgUnitId: number | null;
  departmentId: number | null;
  warehouseId: number | null;
}

export function toDataScope(ctx: AuthContext | null): DataScope | null {
  if (!ctx) return null;
  return {
    scopeType: ctx.scope_type,
    orgUnitId: ctx.org_unit_id,
    departmentId: ctx.department_id,
    warehouseId: ctx.warehouse_id,
  };
}

/** Hook đọc phạm vi dữ liệu hiện tại từ store. */
export function useDataScope(): DataScope | null {
  const ctx = useAuthStore((s) => s.currentContext);
  return toDataScope(ctx);
}

/**
 * Chuyển scope thành query params để gắn vào API (khi BE yêu cầu FE gửi scope).
 * Bỏ qua các giá trị null. `he_thong` (toàn hệ thống) → không kèm scope.
 *
 * Lưu ý: nếu BE tự suy scope từ token (JWT đã có scope_type/org_unit_id...),
 * KHÔNG cần dùng hàm này.
 */
export function scopeToParams(scope: DataScope | null): Record<string, number> {
  if (!scope || scope.scopeType === 'he_thong') return {};
  const params: Record<string, number> = {};
  if (scope.orgUnitId != null) params.org_unit_id = scope.orgUnitId;
  if (scope.departmentId != null) params.department_id = scope.departmentId;
  if (scope.warehouseId != null) params.warehouse_id = scope.warehouseId;
  return params;
}
