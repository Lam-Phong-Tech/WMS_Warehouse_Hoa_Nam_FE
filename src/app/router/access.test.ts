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

  it("pins each business domain to its owning permission set", async () => {
    const { ROUTE_PERMISSIONS } = await import("@/app/router/access");
    const { ROUTES } = await import("@/shared/constants/routes");

    expect(ROUTE_PERMISSIONS).toMatchObject({
      [ROUTES.DASHBOARD]: undefined,
      [ROUTES.IAM_USERS]: ["iam.user.view", "iam.user.manage"],
      [ROUTES.IAM_USER_CREATE]: ["iam.user.manage"],
      [ROUTES.IAM_ROLES]: [
        "iam.role.view",
        "iam.role.manage",
        "iam.permission.view",
      ],
      [ROUTES.MASTER_DATA]: ["sku.view", "sku.manage"],
      [ROUTES.AGENCIES]: ["agency.view", "agency.manage"],
      [ROUTES.DEFECTS]: ["defect.view", "defect.manage"],
      [ROUTES.SCAN]: ["inventory.trace", "scan.classify"],
      [ROUTES.INBOUND]: [
        "inbound.view",
        "inbound.create",
        "inbound.scan",
        "inbound.post",
      ],
      [ROUTES.PUTAWAY]: ["container.view", "container.manage"],
      [ROUTES.OUTBOUND]: [
        "outbound.view",
        "outbound.create",
        "outbound.scan",
        "outbound.post",
        "outbound.import",
      ],
      [ROUTES.INVENTORY]: ["inventory.view"],
      [ROUTES.WARRANTY]: ["warranty.manage"],
      [ROUTES.REVERSE]: ["inventory.reversal.post"],
      [ROUTES.REPORTS]: ["report.view"],
      [ROUTES.AUDIT_LOGS]: "AUDIT_LOG_VIEW",
      [ROUTES.PROFILE]: undefined,
    });

    expect(ROUTE_PERMISSIONS).not.toHaveProperty(ROUTES.STOCKTAKE);
    expect(ROUTE_PERMISSIONS[ROUTES.REPORTS]).not.toContain("report.export");
  });
});
