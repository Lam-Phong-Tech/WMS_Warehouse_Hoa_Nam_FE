import { useAuthStore } from "@/shared/store/auth.store";
import { WmsContractError } from "@/shared/api/wms-contract";
import { hasAnyWmsPermission } from "@/shared/constants/wms-permissions";

/**
 * FE defense-in-depth only. Backend remains the authorization and data-scope
 * authority and must still return 403 for unauthorized direct API calls.
 */
export function assertWmsActionPermission(
  requiredCodes: readonly string[],
  action: string,
): void {
  const state = useAuthStore.getState();
  if (
    !hasAnyWmsPermission(
      state.permissionCodes,
      requiredCodes,
      state.isSuperAdmin,
    )
  ) {
    throw new WmsContractError(
      "WMS_FE_PERMISSION_REQUIRED",
      `${requiredCodes.join(" or ")} is required for ${action}`,
    );
  }
}
