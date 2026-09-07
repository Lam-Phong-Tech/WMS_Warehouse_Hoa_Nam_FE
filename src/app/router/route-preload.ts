import { ROUTES } from "@/shared/constants/routes";
import type { RoutePreloadable } from "@/app/router/lazy-route";
import * as R from "@/app/router/route-components";

/**
 * NẠP TRƯỚC CHUNK CỦA ROUTE — để lúc người dùng bấm, màn mới không phải chờ tải mã.
 *
 * ĐO ĐƯỢC (Playwright, build production, 06–07/09/2026): lần đầu vào một màn báo
 * cáo, người dùng nhìn skeleton **300–370 ms** chỉ để tải + parse chunk của route,
 * rồi mới tới lượt gọi API. Ở máy chậm gấp 4 (giả lập CPU x4) là hơn một giây. Đó
 * là phần "lag khi chuyển tab" dễ cắt nhất, vì nó thuần tuý là chờ mạng.
 *
 * CÁCH LÀM — đúng cách Next.js/Remix làm với `<Link prefetch>`:
 *  1. Rê chuột / focus vào mục menu ⇒ nạp chunk của route đó ngay (người dùng mất
 *     ~150–300 ms từ lúc rê tới lúc bấm, vừa đủ để chunk về).
 *  2. Sau khi app rảnh (`requestIdleCallback`) ⇒ nạp dần các màn hay dùng, mỗi
 *     nhịp rảnh một chunk, để không tranh băng thông/CPU với việc người dùng đang
 *     làm.
 *  3. Lúc F5, `main.tsx` gọi `preloadRoute(location.pathname)` để chunk của ĐÚNG
 *     trang đích tải song song với vòng mạng `/auth/refresh`.
 *
 * KHÁC BẢN CŨ (07/09/2026): bảng này không còn lặp lại 30 chuỗi `import("...")`
 * song song với `router/index.tsx`. Cả hai nay trỏ vào CÙNG object `lazyRoute` ở
 * `route-components.ts`, nên (a) không thể lệch nhau khi thêm màn, và (b) nạp
 * trước xong thì render KHÔNG treo Suspense nữa — trước đây `React.lazy` vẫn treo
 * ở lần render đầu dù chunk đã nằm sẵn trong bộ nhớ, và React 19 chặn commit lại
 * trong 300 ms (xem `lazy-route.tsx`).
 */
type Preloadable = RoutePreloadable;

const LOADERS: Record<string, Preloadable> = {
  // Trang gốc điều hướng thẳng sang /dashboard — vào "/" thì chunk cần nạp là
  // chunk của Tổng quan, nếu không lần F5 ở "/" phải chờ thêm một vòng tải mã.
  [ROUTES.HOME]: R.DashboardPage as Preloadable,
  [ROUTES.DASHBOARD]: R.DashboardPage as Preloadable,
  [ROUTES.AUDIT_LOGS]: R.AuditLogsPage as Preloadable,
  [ROUTES.NOTIFICATIONS]: R.NotificationsPage as Preloadable,
  [ROUTES.IAM_USERS]: R.IamUsersGd1Page as Preloadable,
  [ROUTES.IAM_ROLES]: R.IamRolePermissionScreen as Preloadable,
  [ROUTES.MASTER_DATA]: R.SkuMasterScreen as Preloadable,
  [ROUTES.AGENCIES]: R.AgencyMasterScreen as Preloadable,
  [ROUTES.DEFECTS]: R.DefectMasterScreen as Preloadable,
  [ROUTES.CATALOG_MASTER]: R.CatalogMasterScreen as Preloadable,
  [ROUTES.WAREHOUSE_CONFIG]: R.WarehouseConfigScreen as Preloadable,
  [ROUTES.PV_PRODUCT_CATALOG]: R.PvProductCatalogPage as Preloadable,
  [ROUTES.SCAN]: R.PhysicalCodesPage as Preloadable,
  [ROUTES.INBOUND]: R.InboundPage as Preloadable,
  [ROUTES.PUTAWAY]: R.PutawayPage as Preloadable,
  [ROUTES.PUTAWAY_TRAYS]: R.TrayOverviewPage as Preloadable,
  [ROUTES.OUTBOUND]: R.OutboundPage as Preloadable,
  [ROUTES.INVENTORY]: R.InventoryPage as Preloadable,
  [ROUTES.WARRANTY]: R.WarrantyPage as Preloadable,
  [ROUTES.WARRANTY_COMPONENT_ISSUES]:
    R.WarrantyComponentIssueListPage as Preloadable,
  [ROUTES.REVERSE]: R.ReversalPage as Preloadable,
  [ROUTES.REPORTS_INVENTORY_FLOW]: R.InventoryFlowReportPage as Preloadable,
  [ROUTES.REPORTS_OUTBOUND_FLOW]: R.OutboundFlowReportPage as Preloadable,
  [ROUTES.REPORTS_STOCK_RECONCILE]: R.StockReconcileReportPage as Preloadable,
  [ROUTES.REPORTS_TRACEABILITY]: R.TraceabilityReportPage as Preloadable,
  [ROUTES.REPORTS_IMPORT_QUALITY]: R.ImportQualityReportPage as Preloadable,
  [ROUTES.REPORTS_PACKING_LABEL]: R.PackingLabelReportPage as Preloadable,
  [ROUTES.REPORTS_WARRANTY]: R.WarrantyReportPage as Preloadable,
  [ROUTES.REPORTS_RECIPIENT]: R.RecipientReportPage as Preloadable,
  [ROUTES.REPORTS_PENDING_EVIDENCE]: R.PendingEvidenceReportPage as Preloadable,
  [ROUTES.PV_ADMIN]: R.PvAdminPage as Preloadable,
  [ROUTES.PROFILE]: R.ProfilePage as Preloadable,
  [ROUTES.LOGIN]: R.LoginPage as Preloadable,
  [ROUTES.PV_CATALOG]: R.PvCatalogPage as Preloadable,
  [ROUTES.CHANGE_PASSWORD]: R.ChangePasswordPage as Preloadable,
  [ROUTES.FORGOT_PASSWORD]: R.ForgotPasswordPage as Preloadable,
};

/**
 * Thứ tự nạp lúc rảnh: 8 màn báo cáo trước (nhóm người dùng than lag nhất khi
 * chuyển qua lại), rồi ba màn nghiệp vụ mở nhiều nhất trong ca.
 */
const IDLE_ORDER: string[] = [
  ROUTES.REPORTS_INVENTORY_FLOW,
  ROUTES.REPORTS_OUTBOUND_FLOW,
  ROUTES.REPORTS_STOCK_RECONCILE,
  ROUTES.REPORTS_TRACEABILITY,
  ROUTES.REPORTS_IMPORT_QUALITY,
  ROUTES.REPORTS_PACKING_LABEL,
  ROUTES.REPORTS_WARRANTY,
  ROUTES.REPORTS_RECIPIENT,
  ROUTES.REPORTS_PENDING_EVIDENCE,
  ROUTES.INBOUND,
  ROUTES.OUTBOUND,
  ROUTES.INVENTORY,
];

const started = new Set<string>();

/** Khoá tra: bỏ query string, và cắt đoạn `/new` (route tạo mới dùng chung chunk). */
function keyFor(pathname: string): string | null {
  const clean = pathname.split("?")[0].replace(/\/new$/, "");
  if (LOADERS[clean]) return clean;
  // Route có tham số (vd /pv/:id) hoặc route con: lấy tiền tố dài nhất khớp.
  // Loại ROUTES.HOME ("/") khỏi phép so tiền tố — nó khớp MỌI đường dẫn.
  const match = Object.keys(LOADERS)
    .filter((k) => k !== ROUTES.HOME && clean.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return match ?? null;
}

/** Nạp chunk của một route. An toàn gọi nhiều lần; lỗi mạng được nuốt (chỉ là nạp trước). */
export function preloadRoute(pathname: string): void {
  const key = keyFor(pathname);
  if (!key || started.has(key)) return;
  started.add(key);
  void LOADERS[key].preload().catch(() => {
    // Nạp trước thất bại (mất mạng, deploy giữa chừng) thì để lần bấm thật tự tải
    // lại — xoá dấu để không kẹt ở trạng thái "đã nạp".
    started.delete(key);
  });
}

/** Chunk của route này đã nằm sẵn trong bộ nhớ chưa (render sẽ không treo). */
export function isRoutePreloaded(pathname: string): boolean {
  const key = keyFor(pathname);
  return key ? LOADERS[key].isLoaded() : false;
}

/**
 * Nạp dần các màn hay dùng khi app rảnh. Mỗi nhịp rảnh một chunk; nhịp nào có
 * việc của người dùng thì nhường (rIC chỉ chạy khi luồng chính thật sự rảnh).
 * Không có rIC (Safari cũ) thì dùng setTimeout thưa.
 */
export function preloadCommonRoutesWhenIdle(): void {
  if (typeof window === "undefined") return;
  const queue = IDLE_ORDER.filter((p) => !started.has(p));
  if (queue.length === 0) return;

  // ĐO ĐƯỢC: bản đầu nạp 17 màn ngay khi rảnh ⇒ ~120 chunk đổ về trong lúc
  // người dùng vừa mở màn đầu tiên, tranh băng thông với chính request dữ liệu
  // của họ (màn Nhập–Xuất–Tồn lần đầu chậm hơn ~1 s). Nên: chờ 3 s sau khi shell
  // lên, mỗi nhịp rảnh THẬT SỰ (timeout dài) chỉ một chunk, và không nạp trong
  // lúc trang đang có request mạng.
  const schedule = (fn: () => void, delayMs = 0) => {
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
    };
    const run = () => {
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(fn, { timeout: 10_000 });
      } else {
        window.setTimeout(fn, 2_000);
      }
    };
    if (delayMs > 0) window.setTimeout(run, delayMs);
    else run();
  };

  const step = () => {
    const next = queue.shift();
    if (!next) return;
    preloadRoute(next);
    schedule(step, 400);
  };
  schedule(step, 3_000);
}
