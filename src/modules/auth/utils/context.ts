import type { AuthContext } from "@/modules/auth/types/auth.types";

export const SCOPE_LABELS: Record<string, string> = {
  he_thong: "Toàn hệ thống",
  SYSTEM: "Toàn hệ thống",
  chi_nhanh: "Chi nhánh",
  phong_ban: "Phòng ban",
  kho: "Kho",
  WAREHOUSE: "Kho",
};

export function getScopeName(ctx: AuthContext): string {
  return (
    ctx.org_unit_name ??
    ctx.department_name ??
    ctx.warehouse_name ??
    ctx.scope_ref ??
    SCOPE_LABELS[ctx.scope_type] ??
    "Toàn hệ thống"
  );
}

export function getScopeTypeLabel(ctx: AuthContext): string {
  return (
    SCOPE_LABELS[ctx.context_type ?? ""] ??
    SCOPE_LABELS[ctx.scope_type] ??
    ctx.scope_type
  );
}

export function getContextKey(ctx: AuthContext): string {
  return [
    ctx.role_id,
    ctx.context_type ?? ctx.scope_type,
    ctx.scope_ref ?? "",
    ctx.org_unit_id ?? "",
    ctx.department_id ?? "",
    ctx.warehouse_id ?? "",
  ].join(":");
}
