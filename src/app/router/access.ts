import { ROUTES } from "@/shared/constants/routes";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

/**
 * Route access is an entry/UX gate only. Sensitive actions require their
 * action permission at component/service level and backend authorization.
 */
export const ROUTE_PERMISSIONS: Record<string, string | string[] | undefined> =
  {
    [ROUTES.DASHBOARD]: undefined,
    [ROUTES.MASTER_DATA]: [P.SKU_MANAGE, P.MASTER_MANAGE],
    [ROUTES.SCAN]: [P.INVENTORY_TRACE, P.SCAN_CLASSIFY],
    [ROUTES.INBOUND]: [
      P.INBOUND_VIEW,
      P.INBOUND_CREATE,
      P.INBOUND_SCAN,
      P.INBOUND_POST,
    ],
    [ROUTES.PUTAWAY]: [P.CONTAINER_VIEW, P.CONTAINER_MANAGE],
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
