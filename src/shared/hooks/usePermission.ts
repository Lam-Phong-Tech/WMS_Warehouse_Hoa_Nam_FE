import { useMemo } from "react";
import {
  type PermissionMode,
  type PermissionContext,
  getPermissionCode,
} from "@/shared/types/permission";
import {
  usePermissionState,
  hasPermission,
} from "@/modules/auth/utils/permission";
import { hasScopeForAction } from "@/shared/types/permission.scope";
import {
  canonicalizeWmsPermission,
  resolveWmsPermissionAlternatives,
} from "@/shared/constants/wms-permissions";

export function usePermission(context: PermissionContext): {
  can: boolean;
  mode: PermissionMode;
  isHidden: boolean;
  isDisabled: boolean;
  permissionCode: string;
} {
  const { module, action, permissionCode: customCode, mode = "hide" } = context;

  const resolvedCode = useMemo(() => {
    if (customCode) return customCode;
    if (action && module) return getPermissionCode(action, module);
    return (module ?? "").toUpperCase();
  }, [module, action, customCode]);

  const state = usePermissionState();
  const hasCodePermission = hasPermission(resolvedCode, state);
  const scopePassed = hasScopeForAction(
    state.currentScopeType,
    module ?? "",
    action,
    state.isSuperAdmin,
  );
  const can = hasCodePermission && scopePassed;

  return {
    can,
    mode,
    isHidden: mode === "hide" && !can,
    isDisabled: mode === "disable" && !can,
    permissionCode: resolvedCode,
  };
}

/**
 * REQ-SRS-037 / WWHN-237: MVP không có permission kiểm kê hay sửa tồn trực tiếp,
 * nên không tồn tại nhóm quyền nào cần chặn OR-fallback về một mã `stocktake.*`.
 * Hàm chỉ canonicalize rồi OR các mã trong nhóm; mọi nhóm quyền hiện hành giữ
 * nguyên hành vi để không gây regression RBAC ngoài phạm vi.
 */
export function useCanAny(codes: string[]): boolean {
  const state = usePermissionState();
  return resolveWmsPermissionAlternatives(codes).some((code) =>
    hasPermission(code, state),
  );
}

export function useCanAll(codes: string[]): boolean {
  const state = usePermissionState();
  return codes
    .map(canonicalizeWmsPermission)
    .every((code) => hasPermission(code, state));
}
