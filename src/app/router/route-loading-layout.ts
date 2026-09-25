import { ROUTES } from "@/shared/constants/routes";
import type { LoadingSkeletonLayout } from "@/shared/ui/loading/LoadingSkeleton";

/** Layout metadata only; eagerly available before any report module or API. */
const ROUTE_LAYOUTS: Readonly<Record<string, LoadingSkeletonLayout>> = {
  [ROUTES.REPORTS_INVENTORY_FLOW]: "report",
  [ROUTES.REPORTS_OUTBOUND_FLOW]: "report",
  [ROUTES.REPORTS_STOCK_RECONCILE]: "reconcile",
  [ROUTES.REPORTS_TRACEABILITY]: "report",
  [ROUTES.REPORTS_IMPORT_QUALITY]: "report",
  [ROUTES.REPORTS_PACKING_LABEL]: "report",
  [ROUTES.REPORTS_WARRANTY]: "report",
  [ROUTES.REPORTS_RECIPIENT]: "report",
  [ROUTES.REPORTS_PENDING_EVIDENCE]: "report",
  [ROUTES.DASHBOARD]: "overview",
  [ROUTES.INVENTORY]: "reconcile",
  [ROUTES.PROFILE]: "detail",
  [ROUTES.MFA_SETUP]: "detail",
  [ROUTES.LOGIN]: "auth",
  [ROUTES.CHANGE_PASSWORD]: "auth",
  [ROUTES.FORGOT_PASSWORD]: "auth",
};

export function routeLoadingLayout(pathname: string): LoadingSkeletonLayout {
  // Query parameters select existing presentations, never fabricated states.
  const path = (pathname.split(/[?#]/, 1)[0] ?? "").replace(/\/+$/, "") || "/";
  return ROUTE_LAYOUTS[path] ?? "list";
}
