import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { buildCacheNamespace } from "@/shared/cache/cache-namespace";
import { connectEcho } from "@/shared/lib/echo";
import { useAuthStore } from "@/shared/store/auth.store";
import { createOperationalRefreshController } from "./operational-refresh";

// Mirrors WarehouseDataAccess's existing read permissions. The channel contains
// no records or IDs; scoped HTTP APIs still authorize every refreshed read.
const READ_PERMISSIONS = new Set([
  "warehouse.view",
  "sku.view",
  "sku.manage",
  "inbound.view",
  "outbound.view",
  "inventory.view",
  "inventory.trace",
  "warranty.view",
  "warranty.manage",
  "warranty.component_issue",
  "putaway.view",
  "putaway.manage",
  "container.view",
  "item_instance.view",
  "import_batch.view",
  "catalog.view",
  "pv.master.manage",
  "agency.view",
  "defect.view",
  "label.print",
  "packing_label.print",
  "outbound.request.import",
  "outbound.import",
  "report.view",
  "report.import_quality.view",
  "report.inventory_flow.view",
  "report.outbound_flow.view",
  "report.io_history.view",
  "report.recipient.view",
  "report.stock_reconcile.view",
  "report.traceability.view",
  "report.packing_label.view",
  "report.warranty.view",
  "report.export",
]);

function owner(state: ReturnType<typeof useAuthStore.getState>): string | null {
  const {
    profile,
    isAuthenticated,
    isProfileLoaded,
    permissionCodes,
    isSuperAdmin,
    currentContext,
  } = state;
  if (
    !isAuthenticated ||
    !isProfileLoaded ||
    !profile ||
    (!isSuperAdmin &&
      !permissionCodes.some((code) => READ_PERMISSIONS.has(code)))
  )
    return null;
  const namespace = buildCacheNamespace({
    userId: String(profile.user_id ?? profile.id),
    warehouseScopeIds: profile.warehouse_scope_ids ?? [],
    contextRef:
      currentContext?.scope_ref ??
      (currentContext?.warehouse_id != null
        ? String(currentContext.warehouse_id)
        : null),
    permissionCodes,
    isSuperAdmin,
  });
  return `${state.authEpoch}:${namespace}`;
}

/** One shell subscriber, independent of optional notifications and their actor exclusions. */
export function useWarehouseRealtime() {
  const queryClient = useQueryClient();
  const identity = useAuthStore(owner);

  useEffect(() => {
    if (!identity) return;
    let disposed = false;
    let echo: Awaited<ReturnType<typeof connectEcho>> = null;
    const isCurrent = () =>
      !disposed && owner(useAuthStore.getState()) === identity;
    const canFetch = () =>
      document.visibilityState !== "hidden" && navigator.onLine;
    const refresh = createOperationalRefreshController({
      queryClient,
      isCurrent,
      canFetch,
    });
    const resume = () => {
      if (isCurrent() && canFetch()) refresh.schedule();
    };

    void connectEcho()
      .then((connection) => {
        if (!isCurrent()) return;
        echo = connection;
        if (!connection) {
          resume();
          return;
        }
        const channel = connection.private("warehouse-data");
        channel.subscribed(resume);
        channel.listen(".warehouse.data.changed", (payload: unknown) => {
          if (
            payload &&
            typeof payload === "object" &&
            "domain" in payload &&
            payload.domain === "warehouse" &&
            isCurrent()
          ) {
            refresh.schedule();
          }
        });
      })
      .catch(resume);

    // Reconcile missed signals after network/sleep recovery. The interval is a
    // foreground fallback, not a second source of table or form state.
    const interval = window.setInterval(resume, 30_000);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      refresh.dispose();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      echo?.leave("warehouse-data");
    };
  }, [identity, queryClient]);
}
