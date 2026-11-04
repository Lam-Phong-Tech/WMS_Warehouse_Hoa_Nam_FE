import { DASHBOARD_CANONICAL, ROUTES } from "@/shared/constants/routes";
import { canAccessPath, getVisibleNavGroups } from "@/app/layouts/nav-data";
const HOMEPAGES: Record<string, string> = {
  dashboard: DASHBOARD_CANONICAL,
  inbound: ROUTES.INBOUND,
  outbound: ROUTES.OUTBOUND,
  inventory: ROUTES.INVENTORY,
};
export function resolvePreferredHomepage(
  home: string | undefined,
  permissions: string[],
  isSuperAdmin: boolean,
): string {
  const selected = home ? HOMEPAGES[home] : undefined;
  if (
    selected &&
    canAccessPath(selected.split("?")[0], permissions, isSuperAdmin)
  )
    return selected;
  if (canAccessPath(ROUTES.DASHBOARD, permissions, isSuperAdmin))
    return DASHBOARD_CANONICAL;
  return (
    getVisibleNavGroups(permissions, isSuperAdmin)
      .flatMap((group) => group.items)
      .find((item) => item.path !== ROUTES.PROFILE)?.path ?? ROUTES.PROFILE
  );
}
