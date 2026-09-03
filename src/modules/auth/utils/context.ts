import type { AuthContext } from "@/modules/auth/types/auth.types";
import { tStatic, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";

const SCOPE_LABEL_KEYS: Record<string, MessageKey> = {
  he_thong: "auth.context.scopeSystem",
  SYSTEM: "auth.context.scopeSystem",
  chi_nhanh: "auth.context.scopeBranch",
  phong_ban: "auth.context.scopeDepartment",
  kho: "auth.context.scopeWarehouse",
  WAREHOUSE: "auth.context.scopeWarehouse",
};

function scopeLabel(scopeType: string, t: TranslateFn): string | undefined {
  const key = SCOPE_LABEL_KEYS[scopeType];
  return key ? t(key) : undefined;
}

/** Nhận `t` từ component (useT) để nhãn đổi theo ngôn ngữ; nơi ngoài React
 * dùng mặc định `tStatic` — đọc ngôn ngữ hiện tại tại thời điểm gọi. */
export function getScopeName(
  ctx: AuthContext,
  t: TranslateFn = tStatic,
): string {
  return (
    ctx.org_unit_name ??
    ctx.department_name ??
    ctx.warehouse_name ??
    ctx.scope_ref ??
    scopeLabel(ctx.scope_type, t) ??
    t("auth.context.scopeSystem")
  );
}

export function getScopeTypeLabel(
  ctx: AuthContext,
  t: TranslateFn = tStatic,
): string {
  return (
    scopeLabel(ctx.context_type ?? "", t) ??
    scopeLabel(ctx.scope_type, t) ??
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
