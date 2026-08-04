import { ROUTES } from "@/shared/constants/routes";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

/**
 * Route permission is an entry/view gate only; backend still owns RBAC and
 * data-scope enforcement. Sensitive actions are guarded separately:
 * post receipt/issue, stocktake.adjust, warranty.temp_only, report.export,
 * reversal posting, and scan context permissions.
 */
export const ROUTE_PERMISSIONS: Record<
  string,
  string | string[] | undefined
> = {
  [ROUTES.DASHBOARD]: undefined,
  [ROUTES.MASTER_DATA]: [P.SKU_MANAGE, P.MASTER_MANAGE],
  [ROUTES.SCAN]: [P.INVENTORY_TRACE, P.SCAN_CLASSIFY],
  [ROUTES.INBOUND]: [P.INBOUND_CREATE, P.INBOUND_POST],
  [ROUTES.PUTAWAY]: [P.PUTAWAY_MANAGE],
  [ROUTES.OUTBOUND]: [P.OUTBOUND_CREATE, P.OUTBOUND_POST],
  [ROUTES.INVENTORY]: [P.INVENTORY_VIEW],
  [ROUTES.STOCKTAKE]: [P.STOCKTAKE_COUNT],
  [ROUTES.WARRANTY]: [P.WARRANTY_MANAGE],
  [ROUTES.REVERSE]: [P.REVERSAL_POST],
  [ROUTES.REPORTS]: [P.REPORT_VIEW],
  [ROUTES.AUDIT_LOGS]: P.AUDIT_LOG_VIEW,
  [ROUTES.COMPONENT_CATALOG]: undefined,
  [ROUTES.PROFILE]: undefined,
};
