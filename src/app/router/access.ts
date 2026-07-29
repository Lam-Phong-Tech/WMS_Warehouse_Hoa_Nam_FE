import { ROUTES } from "@/shared/constants/routes";

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
    [ROUTES.MASTER_DATA]: ["sku.manage", "master.manage"],
    [ROUTES.SCAN]: ["inventory.trace", "scan.classify"],
    [ROUTES.INBOUND]: ["inbound.create", "inbound.post"],
    [ROUTES.PUTAWAY]: ["putaway.manage"],
    [ROUTES.OUTBOUND]: ["outbound.create", "outbound.post"],
    [ROUTES.INVENTORY]: ["inventory.view"],
    [ROUTES.STOCKTAKE]: ["stocktake.count"],
    [ROUTES.WARRANTY]: ["warranty.manage"],
    [ROUTES.REVERSE]: ["inventory.reversal.post"],
    [ROUTES.REPORTS]: ["report.view"],
    [ROUTES.COMPONENT_CATALOG]: undefined,

    // Shared/system.
    [ROUTES.PROFILE]: undefined,
    [ROUTES.AUDIT_LOGS]: "AUDIT_LOG_VIEW",
  };
