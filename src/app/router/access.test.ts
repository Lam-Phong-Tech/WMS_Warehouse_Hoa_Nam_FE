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
      // Siết 27/08: gate theo API mà SCR-SCAN-01 thực sự gọi (physical-codes ->
      // inventory.trace; scan/batches + scan/events -> inventory.view).
      // scan.execute/scan.classify chỉ mở POST /scan/classify, không mở tab nào,
      // nên để chúng ở đây cho người vào màn rồi 403 cả ba tab.
      [ROUTES.SCAN]: ["inventory.trace", "inventory.view"],
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
      // "outbound.create" đã gỡ: BE thu hồi mã này 27/08 (không route nào đọc tới).
      [ROUTES.OUTBOUND]: [
        "outbound.view",
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

  it("fail-closed: route chưa khai báo nhận sentinel không ai có (WWHN-165)", async () => {
    const {
      ROUTE_PERMISSIONS,
      UNREGISTERED_ROUTE_PERMISSION,
      resolveRouteEntryPermission,
    } = await import("@/app/router/access");
    const { ROUTES } = await import("@/shared/constants/routes");
    const { WMS_PERMISSION_CATALOG } =
      await import("@/shared/constants/wms-permissions");

    // Route đã khai tường minh `undefined` (mở cho mọi user đã đăng nhập) phải
    // giữ nguyên semantic — resolver không được đổi thành sentinel.
    expect(resolveRouteEntryPermission(ROUTES.DASHBOARD)).toBeUndefined();
    expect(Object.hasOwn(ROUTE_PERMISSIONS, ROUTES.DASHBOARD)).toBe(true);

    // Route KHÔNG có entry -> sentinel -> RequirePermission chặn về /errors/403.
    expect(resolveRouteEntryPermission("/route-moi-quen-khai-bao")).toBe(
      UNREGISTERED_ROUTE_PERMISSION,
    );

    // Sentinel không bao giờ được seed thành permission thật.
    expect(Object.values(WMS_PERMISSION_CATALOG)).not.toContain(
      UNREGISTERED_ROUTE_PERMISSION,
    );
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

  /**
   * Bất biến bổ sung 27/08: mọi mã quyền dùng để gate route phải là mã canonical
   * có trong catalog. Gõ sai một ký tự (`inventory.trace` -> `inventory.tracee`)
   * không gây lỗi biên dịch: guard chỉ so chuỗi, không ai khớp, và màn hình im
   * lặng biến mất khỏi menu với MỌI vai trừ super admin — rất khó truy ngược.
   */
  it("mọi mã quyền gate route đều là mã canonical trong catalog", async () => {
    const { ROUTE_PERMISSIONS } = await import("@/app/router/access");
    const { isCanonicalWmsPermission } =
      await import("@/shared/constants/wms-permissions");

    const unknown = Object.entries(ROUTE_PERMISSIONS).flatMap(
      ([path, required]) => {
        if (!required) return [];
        const codes = Array.isArray(required) ? required : [required];
        return codes
          .filter((code) => !isCanonicalWmsPermission(code))
          .map((code) => `${path} -> ${code}`);
      },
    );

    expect(unknown).toEqual([]);
  });

  /**
   * Bất biến bổ sung 27/08: các bộ mã hành động phải khớp đúng danh sách OR của
   * route BE. Bỏ sót một nhánh OR khiến FE CHẶT HƠN backend — nút bị ẩn với người
   * thực ra có quyền, một lỗi phân quyền im lặng theo chiều ngược lại.
   */
  it("bộ mã hành động khớp danh sách OR của route BE", async () => {
    const { WMS_ACTION_PERMISSIONS } =
      await import("@/shared/constants/wms-permissions");

    // BE: permission:outbound.request.import|outbound.import
    expect(WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_IMPORT).toEqual([
      "outbound.request.import",
      "outbound.import",
    ]);
    // BE: permission:outbound.request.confirm|outbound.import
    expect(WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_CONFIRM).toEqual([
      "outbound.request.confirm",
      "outbound.import",
    ]);
    // BE: permission:outbound.request.manual_create|outbound.import
    expect(WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_MANUAL_CREATE).toEqual([
      "outbound.request.manual_create",
      "outbound.import",
    ]);
    // BE: permission:packing_label.preview|label.print
    expect(WMS_ACTION_PERMISSIONS.PACKING_LABEL_PREVIEW).toEqual([
      "packing_label.preview",
      "label.print",
    ]);
    // BE: permission:packing_label.ready|label.print
    expect(WMS_ACTION_PERMISSIONS.PACKING_LABEL_READY).toEqual([
      "packing_label.ready",
      "label.print",
    ]);
    // BE: permission:putaway.manage|container.manage
    expect(WMS_ACTION_PERMISSIONS.PUTAWAY_CONTAINER).toEqual([
      "putaway.manage",
      "container.manage",
    ]);
    // BE: permission:inbound.cancel|inbound.create
    expect(WMS_ACTION_PERMISSIONS.CANCEL_INBOUND).toEqual([
      "inbound.cancel",
      "inbound.create",
    ]);
  });
});
