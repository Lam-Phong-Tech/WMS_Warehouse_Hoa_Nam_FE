import { ROUTES } from "@/shared/constants/routes";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

/**
 * Single source of route-level permissions for both RequirePermission and menu
 * filtering. Route permissions are only UX gates; backend still owns RBAC and
 * data-scope enforcement.
 *
 * `undefined` means every authenticated user can enter the route.
 * `string[]` means OR: the user needs at least one listed permission.
 */
export const ROUTE_PERMISSIONS: Record<string, string | string[] | undefined> =
  {
    // WMS P0 bounded contexts from the technical architecture guide.
    [ROUTES.DASHBOARD]: undefined,
    [ROUTES.MASTER_DATA]: [P.SKU_MANAGE, P.MASTER_MANAGE],
    [ROUTES.SCAN]: [P.INVENTORY_TRACE, P.SCAN_CLASSIFY],
    [ROUTES.INBOUND]: [P.INBOUND_CREATE, P.INBOUND_POST],
    [ROUTES.PUTAWAY]: [P.PUTAWAY_MANAGE],
    [ROUTES.OUTBOUND]: [P.OUTBOUND_CREATE, P.OUTBOUND_POST],
    [ROUTES.INVENTORY]: [P.INVENTORY_VIEW],
    [ROUTES.STOCKTAKE]: [P.STOCKTAKE_COUNT, P.STOCKTAKE_ADJUST],
    [ROUTES.WARRANTY]: [P.WARRANTY_MANAGE],
    [ROUTES.REVERSE]: [P.REVERSAL_POST],
    [ROUTES.REPORTS]: [P.REPORT_VIEW, P.REPORT_EXPORT],
    [ROUTES.COMPONENT_CATALOG]: undefined,

    // Shared/system.
    [ROUTES.PROFILE]: undefined,
    [ROUTES.AUDIT_LOGS]: P.AUDIT_LOG_VIEW,
  };
