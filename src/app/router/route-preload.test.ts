import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/shared/constants/routes";

const mocks = vi.hoisted(() => ({
  routes: {} as Record<
    string,
    {
      loaded: boolean;
      preload: ReturnType<typeof vi.fn>;
      isLoaded: () => boolean;
    }
  >,
}));
vi.mock("./route-components", () => {
  const names = [
    "DashboardPage",
    "AuditLogsPage",
    "NotificationsPage",
    "IamUsersGd1Page",
    "IamRolePermissionScreen",
    "SkuMasterScreen",
    "AgencyMasterScreen",
    "DefectMasterScreen",
    "CatalogMasterScreen",
    "WarehouseConfigScreen",
    "PvProductCatalogPage",
    "PhysicalCodesPage",
    "InboundPage",
    "PutawayPage",
    "TrayOverviewPage",
    "OutboundPage",
    "InventoryPage",
    "WarrantyPage",
    "WarrantyComponentIssueListPage",
    "ReversalPage",
    "InventoryFlowReportPage",
    "OutboundFlowReportPage",
    "StockReconcileReportPage",
    "TraceabilityReportPage",
    "ImportQualityReportPage",
    "PackingLabelReportPage",
    "WarrantyReportPage",
    "RecipientReportPage",
    "PendingEvidenceReportPage",
    "PvAdminPage",
    "ProfilePage",
    "LoginPage",
    "PvCatalogPage",
    "ChangePasswordPage",
    "ForgotPasswordPage",
  ];
  for (const name of names) {
    const route = {
      loaded: false,
      preload: vi.fn(),
      isLoaded: () => route.loaded,
    };
    mocks.routes[name] = route;
  }
  return mocks.routes;
});

describe("idle route preloading", () => {
  let module: typeof import("./route-preload");
  let cancel: (() => void) | undefined;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.stubGlobal("requestIdleCallback", (callback: () => void) =>
      window.setTimeout(callback, 0),
    );
    vi.stubGlobal("cancelIdleCallback", (id: number) =>
      window.clearTimeout(id),
    );
    vi.stubGlobal("navigator", { onLine: true, connection: {} });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    module = await import("./route-preload");
    for (const route of Object.values(mocks.routes)) {
      route.loaded = false;
      route.preload.mockReset().mockImplementation(async () => {
        route.loaded = true;
      });
    }
  });
  afterEach(() => {
    cancel?.();
    cancel = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("waits for an import to finish instead of downloading the whole queue concurrently", async () => {
    let finish!: () => void;
    mocks.routes.InventoryFlowReportPage.preload.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    cancel = module.preloadCommonRoutesWhenIdle();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.routes.InventoryFlowReportPage.preload).toHaveBeenCalledOnce();
    expect(mocks.routes.OutboundFlowReportPage.preload).not.toHaveBeenCalled();
    finish();
    await vi.advanceTimersByTimeAsync(401);
    expect(mocks.routes.OutboundFlowReportPage.preload).toHaveBeenCalledOnce();
  });

  it("yields while foreground API work is active", async () => {
    let busy = true;
    cancel = module.preloadCommonRoutesWhenIdle(() => busy);
    await vi.advanceTimersByTimeAsync(5_100);
    expect(mocks.routes.InventoryFlowReportPage.preload).not.toHaveBeenCalled();
    busy = false;
    await vi.advanceTimersByTimeAsync(2_100);
    expect(mocks.routes.InventoryFlowReportPage.preload).toHaveBeenCalledOnce();
  });

  it("cancels queued imports when the shell unmounts", async () => {
    cancel = module.preloadCommonRoutesWhenIdle();
    cancel();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.routes.InventoryFlowReportPage.preload).not.toHaveBeenCalled();
  });

  it("does not run speculative downloads with Save-Data enabled", async () => {
    vi.stubGlobal("navigator", {
      onLine: true,
      connection: { saveData: true },
    });
    cancel = module.preloadCommonRoutesWhenIdle();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.routes.InventoryFlowReportPage.preload).not.toHaveBeenCalled();
  });

  it("retries a failed hover preload even when lazyRoute swallowed the import failure", async () => {
    const route = mocks.routes.ProfilePage;
    route.preload.mockResolvedValue(undefined);
    module.preloadRoute(ROUTES.PROFILE);
    await vi.advanceTimersByTimeAsync(0);
    module.preloadRoute(ROUTES.PROFILE);
    await vi.advanceTimersByTimeAsync(0);
    expect(route.preload).toHaveBeenCalledTimes(2);
  });
});
