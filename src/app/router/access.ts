import { ROUTES } from "@/shared/constants/routes";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

/** Route access is an entry/UX gate; BE remains authoritative for actions. */
export const ROUTE_PERMISSIONS: Record<string, string | string[] | undefined> =
  {
    [ROUTES.DASHBOARD]: undefined,

    [ROUTES.IAM_USERS]: [P.IAM_USER_VIEW, P.IAM_USER_MANAGE],
    [ROUTES.IAM_USER_CREATE]: [P.IAM_USER_MANAGE],
    [ROUTES.IAM_ROLES]: [
      P.IAM_ROLE_VIEW,
      P.IAM_ROLE_MANAGE,
      P.IAM_PERMISSION_VIEW,
    ],
    [ROUTES.MASTER_DATA]: [P.SKU_VIEW, P.SKU_MANAGE],
    [ROUTES.SKU_CREATE]: [P.SKU_MANAGE],
    [ROUTES.CATALOG_MASTER]: [P.CATALOG_VIEW, P.CATALOG_MANAGE],
    [ROUTES.WAREHOUSE_CONFIG]: [P.WAREHOUSE_VIEW, P.WAREHOUSE_MANAGE],
    [ROUTES.AGENCIES]: [P.AGENCY_VIEW, P.AGENCY_MANAGE],
    [ROUTES.AGENCY_CREATE]: [P.AGENCY_MANAGE],
    [ROUTES.DEFECTS]: [P.DEFECT_VIEW, P.DEFECT_MANAGE],
    [ROUTES.DEFECT_CREATE]: [P.DEFECT_MANAGE],
    // Gate theo đúng API mà màn hình thực sự gọi, không theo tên màn.
    // SCR-SCAN-01 có 3 tab: Mã vật lý (GET /physical-codes -> inventory.trace),
    // Lô quét và Sự kiện quét (GET /scan/batches, /scan/events -> inventory.view).
    // scan.execute/scan.classify chỉ mở POST /scan/classify — KHÔNG mở tab nào ở
    // đây. Để chúng trong danh sách vào màn khiến một vai chỉ có scan.execute vào
    // được nhưng cả ba tab đều 403; đó là lệch FE↔BE, không phải phân quyền.
    [ROUTES.SCAN]: [P.INVENTORY_TRACE, P.INVENTORY_VIEW],

    [ROUTES.INBOUND]: [
      P.INBOUND_VIEW,
      P.INBOUND_CREATE,
      P.INBOUND_SCAN,
      P.INBOUND_POST,
    ],
    // Canonical SRS/BE permission là putaway.view/manage. container.* chỉ giữ
    // compatibility cho route/backend cũ, không thay thế semantic permission putaway.
    [ROUTES.PUTAWAY]: [
      P.PUTAWAY_VIEW,
      P.PUTAWAY_MANAGE,
      P.CONTAINER_VIEW,
      P.CONTAINER_MANAGE,
    ],
    // Màn tổng quan khay (read-only) dùng chung quyền với luồng xếp khay.
    [ROUTES.PUTAWAY_TRAYS]: [
      P.PUTAWAY_VIEW,
      P.PUTAWAY_MANAGE,
      P.CONTAINER_VIEW,
      P.CONTAINER_MANAGE,
    ],

    // P.OUTBOUND_CREATE đã gỡ khỏi danh sách: mã `outbound.create` bị BE thu hồi
    // 27/08 vì không route nào đọc tới, nên không còn ai khớp được. Quyền vào màn
    // xuất kho vẫn đủ rộng nhờ các mã còn lại.
    [ROUTES.OUTBOUND]: [
      P.OUTBOUND_VIEW,
      P.OUTBOUND_SCAN,
      P.OUTBOUND_POST,
      P.OUTBOUND_IMPORT,
      P.OUTBOUND_REQUEST_IMPORT,
      P.OUTBOUND_REQUEST_CONFIRM,
      P.OUTBOUND_REQUEST_MANUAL_CREATE,
    ],
    [ROUTES.INVENTORY]: [P.INVENTORY_VIEW],
    // Annex C listWarrantyCases dùng warranty.view: LEADERSHIP/WAREHOUSE_APPROVER chỉ
    // được cấp quyền đọc nhưng vẫn phải vào được WAR-01 (nút ghi bị ẩn theo quyền).
    [ROUTES.WARRANTY]: [
      P.WARRANTY_VIEW,
      P.WARRANTY_MANAGE,
      P.WARRANTY_COMPONENT_ISSUE,
    ],
    // WWHN-242 · REV-00 là màn ĐỌC. SRS §RACI "Inventory query/trace/reversal" cấp
    // V cho WAREHOUSE_APPROVER/LEADERSHIP/VIEWER/WARRANTY_STAFF/WAREHOUSE_STAFF, và BE
    // mở GET /reversal-documents{,/:id,/:id/lines} bằng `inventory.view`; chỉ
    // store/confirm/post/cancel mới đòi `inventory.reversal.post`. Gate route chỉ bằng
    // REVERSAL_POST là fail-closed sai — khoá luôn màn danh sách của các vai chỉ đọc.
    // Hành vi ghi vẫn ẩn theo REVERSAL_POST bên trong REV-00/REV-01.
    [ROUTES.REVERSE]: [P.INVENTORY_VIEW, P.REVERSAL_POST],
    // 8 trang báo cáo con dùng chung report.view (không phân quyền riêng
    // từng trang — phản hồi người dùng 2026-08-30).
    [ROUTES.REPORTS_INVENTORY_FLOW]: [P.REPORT_VIEW],
    [ROUTES.REPORTS_STOCK_RECONCILE]: [P.REPORT_VIEW],
    [ROUTES.REPORTS_TRACEABILITY]: [P.REPORT_VIEW],
    [ROUTES.REPORTS_IMPORT_QUALITY]: [P.REPORT_VIEW],
    [ROUTES.REPORTS_PACKING_LABEL]: [P.REPORT_VIEW],
    [ROUTES.REPORTS_WARRANTY]: [P.REPORT_VIEW],
    [ROUTES.REPORTS_RECIPIENT]: [P.REPORT_VIEW],
    [ROUTES.REPORTS_PENDING_EVIDENCE]: [P.REPORT_VIEW],
    // WWHN-252 · SCR-PV-ADM-01: hai quyền TÁCH BIỆT cùng mở được màn quản trị
    // App PV — pv.master.manage (ngành nghề/tag/rule/hồ sơ hiển thị) và
    // pv.publish (bật/tắt hiển thị công khai). Vào được màn không có nghĩa là
    // làm được cả hai: từng hành động vẫn gate riêng trong PvAdminPage, và BE
    // mới là nơi cưỡng chế. SCR-PV-01/02 KHÔNG có mặt ở bảng này vì chúng là
    // route công khai, không đi qua RequirePermission.
    [ROUTES.PV_ADMIN]: [P.PV_MASTER_MANAGE, P.PV_PUBLISH],
    [ROUTES.AUDIT_LOGS]: P.AUDIT_LOG_VIEW,
    // REQ-017: route demo /component-catalog chỉ tồn tại ở bản DEV (xem
    // router/index.tsx). Production không có entry -> resolver trả sentinel
    // UNREGISTERED_ROUTE_PERMISSION -> fail-closed nếu route lọt lại.
    ...(import.meta.env.DEV
      ? {
          [ROUTES.COMPONENT_CATALOG]: undefined,
          // Part 2 Vuexy sync: foundation catalog — DEV-only, mọi user đã đăng nhập.
          [ROUTES.UI_FOUNDATION]: undefined,
        }
      : {}),
    [ROUTES.PROFILE]: undefined,
    // Hộp thư thông báo cá nhân — tự scope theo user_id ở BE, không cần permission riêng.
    [ROUTES.NOTIFICATIONS]: undefined,
  };

/**
 * WWHN-165: sentinel cấp cho route KHÔNG có entry trong ROUTE_PERMISSIONS.
 * Không role nào được seed permission này, nên RequirePermission luôn chặn về
 * /errors/403 — route mới quên khai báo sẽ fail-closed thay vì mở cho mọi user
 * đã đăng nhập. Muốn mở route cho mọi user phải khai tường minh `undefined`.
 */
export const UNREGISTERED_ROUTE_PERMISSION = "__route.not_registered__";

export function resolveRouteEntryPermission(
  path: string,
): string | string[] | undefined {
  return Object.hasOwn(ROUTE_PERMISSIONS, path)
    ? ROUTE_PERMISSIONS[path]
    : UNREGISTERED_ROUTE_PERMISSION;
}
