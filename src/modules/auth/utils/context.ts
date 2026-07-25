import type { AuthContext } from '@/modules/auth/types/auth.types';

/** Nhãn loại phạm vi theo scope_type trả về từ API. */
export const SCOPE_LABELS: Record<string, string> = {
  he_thong: 'Toàn hệ thống',
  chi_nhanh: 'Chi nhánh',
  phong_ban: 'Phòng ban',
  kho: 'Kho',
};

/** Tên phạm vi cụ thể của bối cảnh (vd "Chi Nhánh Hà Nội"). */
export function getScopeName(ctx: AuthContext): string {
  return (
    ctx.org_unit_name ??
    ctx.department_name ??
    ctx.warehouse_name ??
    SCOPE_LABELS[ctx.scope_type] ??
    'Toàn hệ thống'
  );
}

/** Nhãn loại phạm vi (vd "Chi nhánh"). */
export function getScopeTypeLabel(ctx: AuthContext): string {
  return SCOPE_LABELS[ctx.scope_type] ?? ctx.scope_type;
}

/** Khoá định danh duy nhất 1 bối cảnh — để so sánh và chọn. */
export function getContextKey(ctx: AuthContext): string {
  return [
    ctx.role_id,
    ctx.scope_type,
    ctx.org_unit_id ?? '',
    ctx.department_id ?? '',
    ctx.warehouse_id ?? '',
  ].join(':');
}
