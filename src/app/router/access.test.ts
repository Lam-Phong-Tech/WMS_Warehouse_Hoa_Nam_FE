import { describe, expect, it, vi } from "vitest";

vi.unmock("@/app/router/access");

describe("WMS route access contract", () => {
  it("keeps menu permissions aligned with route guard permissions", async () => {
    const { ROUTE_PERMISSIONS } = await import("@/app/router/access");
    const { MENU } = await import("@/app/layouts/menu");

    const leafItems = MENU.flatMap((group) => group.children ?? []);

    for (const item of leafItems) {
      expect(item.permission, `${item.key} menu permission`).toEqual(
        ROUTE_PERMISSIONS[item.key],
      );
    }
  });

  it("keeps route entry separate from sensitive action permissions", async () => {
    const { ROUTE_PERMISSIONS } = await import("@/app/router/access");
    const { ROUTES } = await import("@/shared/constants/routes");

    expect(ROUTE_PERMISSIONS).toMatchObject({
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
      [ROUTES.AUDIT_LOGS]: "AUDIT_LOG_VIEW",
      [ROUTES.PROFILE]: undefined,
    });

    expect(ROUTE_PERMISSIONS[ROUTES.STOCKTAKE]).not.toContain(
      "stocktake.adjust",
    );
    expect(ROUTE_PERMISSIONS[ROUTES.REPORTS]).not.toContain("report.export");
  });
});
