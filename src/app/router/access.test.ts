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
      [ROUTES.SCAN]: ["inventory.trace", "scan.execute", "scan.classify"],
      [ROUTES.INBOUND]: [
        "inbound.view",
        "inbound.create",
        "inbound.scan",
        "inbound.post",
      ],
      [ROUTES.PUTAWAY]: [
        "putaway.view",
        "putaway.manage",
        "container.view",
        "container.manage",
      ],
      [ROUTES.OUTBOUND]: [
        "outbound.view",
        "outbound.create",
        "outbound.scan",
        "outbound.post",
        "outbound.import",
        "outbound.request.import",
        "outbound.request.confirm",
        "outbound.request.manual_create",
      ],
      [ROUTES.INVENTORY]: ["inventory.view"],
      [ROUTES.WARRANTY]: [
        "warranty.view",
        "warranty.manage",
        "warranty.component_issue",
      ],
      // WWHN-242: REV-00 là màn đọc, BE cấp GET reversal-documents bằng inventory.view.
      [ROUTES.REVERSE]: ["inventory.view", "inventory.reversal.post"],
      [ROUTES.REPORTS]: ["report.view"],
      [ROUTES.AUDIT_LOGS]: "audit_log.view",
      [ROUTES.PROFILE]: undefined,
    });

    // REQ-SRS-037 (Must; nhãn `DEC-NO-STOCKTAKE-001` CHƯA có formal approval — xem
    // ghi chú thẩm quyền ở src/shared/constants/routes.ts): không có route, hằng số
    // route hay permission kiểm kê nào được phép tồn tại trên baseline MVP.
    expect(Object.keys(ROUTES)).not.toContain("STOCKTAKE");
    expect(
      Object.keys(ROUTE_PERMISSIONS).filter((path) =>
        path.toLowerCase().includes("stocktake"),
      ),
    ).toEqual([]);
    expect(ROUTE_PERMISSIONS[ROUTES.REPORTS]).not.toContain("report.export");
  });

  it("keeps canonical BE permission spelling for sensitive routes", async () => {
    const { WMS_PERMISSION_CATALOG: P, canonicalizeWmsPermission } =
      await import("@/shared/constants/wms-permissions");

    expect(P.AUDIT_LOG_VIEW).toBe("audit_log.view");
    expect(canonicalizeWmsPermission("AUDIT_LOG_VIEW")).toBe("audit_log.view");
    expect(P.SCAN_EXECUTE).toBe("scan.execute");
    expect(P.PUTAWAY_VIEW).toBe("putaway.view");
    expect(P.PUTAWAY_MANAGE).toBe("putaway.manage");
    expect(P.PACKING_LABEL_PREVIEW).toBe("packing_label.preview");
    expect(P.OUTBOUND_REQUEST_CONFIRM).toBe("outbound.request.confirm");
  });
});
