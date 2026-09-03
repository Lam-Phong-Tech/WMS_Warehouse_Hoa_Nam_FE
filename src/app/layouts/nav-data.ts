/**
 * NGUỒN NAV DATA DUY NHẤT của shell (Part 4 — đóng NAV-01).
 *
 * Trước đây sidebar đọc NAV_GROUPS (SideNav.tsx) còn breadcrumb đọc MENU
 * (menu.tsx) — hai cây lệch nhau (/scan, /pv-admin, /notifications). File này
 * hợp nhất: SideNav, breadcrumb, tiêu đề header và test RBAC menu đều đọc
 * từ đây. Icon là slug Flaticon — render qua UiIcon.
 *
 * QUY ƯỚC ICON: mọi icon trong menu phải KHÁC NHAU — icon của nhóm cha không
 * được trùng icon của trang con bên trong nó (nhìn vào không phân biệt được
 * đang ở cấp nào). Test `nav-data.test.ts` khoá điều này.
 *
 * Mỗi item dùng đúng route sở hữu để visibility đánh giá theo RBAC của
 * domain đó (ROUTE_PERMISSIONS), không theo screen-id trình bày.
 */
import type { VuexyNavIconName } from "@/shared/ui/icons";
import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { ROUTES } from "@/shared/constants/routes";
import { hasAnyWmsPermission } from "@/shared/constants/wms-permissions";

export interface NavItemData {
  screen: string;
  label: string;
  path: string;
  icon: string;
}

export interface NavGroupData {
  name: string;
  /**
   * Icon HÀNG CẤP 1 — tên trong bộ VUEXY_NAV_ICONS (vẽ lại từ demo UI/UX đã
   * chốt), KHÔNG phải slug Flaticon như `NavItemData.icon`: sidebar chỉ hiện
   * icon ở cấp này, và demo quy định đúng bộ hình đó.
   */
  icon: VuexyNavIconName;
  items: NavItemData[];
  /**
   * Nhóm chỉ có MỘT mục và được vẽ như một dòng menu phẳng (không có mũi tên
   * sổ, không có mục con) — đúng lối "Tổng quan vận hành" của demo Vuexy đã
   * chốt. Breadcrumb vẫn đọc group.name như các nhóm khác.
   */
  direct?: boolean;
  /**
   * Ở rail thu gọn, vẽ một gạch ngang 22px NGAY TRÊN nhóm này để tách cụm
   * (demo tách trước "Báo cáo" và "Hệ thống").
   */
  railDivider?: boolean;
}

export const NAV_GROUPS: NavGroupData[] = [
  {
    name: "Tổng quan",
    icon: "layout-dashboard",
    // Dòng phẳng ở đầu menu (demo: "Tổng quan vận hành") — không sổ nhóm.
    direct: true,
    items: [
      {
        screen: "MAP-01",
        path: ROUTES.DASHBOARD,
        label: "Tổng quan vận hành",
        icon: "sitemap",
      },
    ],
  },
  {
    name: "Danh mục",
    icon: "package-search",
    items: [
      {
        screen: "MST-01",
        path: ROUTES.MASTER_DATA,
        label: "Danh sách SKU",
        icon: "id-card-clip-alt",
      },
      {
        // SCR-MST-01 (REQ-SRS-029): master nuôi form tạo SKU đứng cạnh mục SKU.
        screen: "MST-CAT-01",
        path: ROUTES.CATALOG_MASTER,
        label: "Danh mục sản phẩm",
        icon: "apps",
      },
      {
        screen: "AGY-01",
        path: ROUTES.AGENCIES,
        label: "Danh mục đại lý / nơi nhận",
        icon: "shop",
      },
      {
        screen: "DEF-01",
        path: ROUTES.DEFECTS,
        label: "Danh mục bệnh / lỗi",
        icon: "triangle-warning",
      },
    ],
  },
  {
    name: "Nhập kho",
    icon: "package-plus",
    items: [
      {
        screen: "IN-01",
        path: ROUTES.INBOUND,
        label: "Danh sách phiếu nhập",
        icon: "inbox-in",
      },
      {
        screen: "PTW-00",
        path: ROUTES.PUTAWAY,
        label: "Danh sách linh kiện chờ xếp khay",
        icon: "swap",
      },
    ],
  },
  {
    name: "Xuất kho",
    icon: "package-minus",
    items: [
      {
        screen: "OUT-01",
        path: ROUTES.OUTBOUND,
        label: "Danh sách phiếu xuất",
        icon: "inbox-out",
      },
    ],
  },
  {
    // WAR-02/WAR-03/COMP-01 mở modal trên danh sách — deep-link ?screen= do
    // WarrantyPage xử lý, không liệt kê menu.
    name: "Bảo hành & linh kiện",
    icon: "briefcase-medical",
    items: [
      {
        screen: "WAR-01",
        path: ROUTES.WARRANTY,
        label: "Danh sách bảo hành",
        icon: "shield-check",
      },
      {
        // WAR-04 · trang riêng gom phiếu xuất linh kiện XUYÊN case (phản hồi
        // người dùng 2026-08-30) — COMP-01 (modal tạo/xem 1 phiếu) vẫn chỉ mở
        // từ trong WAR-03, trang này chỉ liệt kê + mở lại COMP-01 khi bấm dòng.
        screen: "WAR-04",
        path: ROUTES.WARRANTY_COMPONENT_ISSUES,
        label: "Danh sách phiếu xuất linh kiện",
        icon: "screwdriver",
      },
    ],
  },
  {
    name: "Tồn kho & truy vết",
    icon: "warehouse",
    items: [
      {
        screen: "INV-01",
        path: ROUTES.INVENTORY,
        label: "Tra cứu tồn & đối soát",
        icon: "boxes",
      },
      // {
      //   // NAV-01 fix: /scan trước đây chỉ vào được bằng URL trực tiếp.
      //   screen: "TRACE-01",
      //   path: ROUTES.SCAN,
      //   label: "Truy vết mã vật lý",
      //   icon: "barcode-read",
      // },
      {
        screen: "REV-00",
        path: ROUTES.REVERSE,
        label: "Danh sách phiếu điều chỉnh tồn kho",
        icon: "rotate-left",
      },
    ],
  },
  {
    // 8 mục — mỗi mục là MỘT trang riêng (trước đây gộp vào 1 trang có tab
    // bar nội trang; phản hồi người dùng 2026-08-30: muốn sổ ra sidebar như
    // các nhóm khác thay vì bấm tab trong trang).
    name: "Báo cáo",
    icon: "chart-column-big",
    railDivider: true,
    items: [
      {
        screen: "RPT-01",
        path: ROUTES.REPORTS_INVENTORY_FLOW,
        label: "Nhập – Xuất – Tồn",
        icon: "arrows-repeat",
      },
      {
        screen: "RPT-02",
        path: ROUTES.REPORTS_STOCK_RECONCILE,
        label: "Tồn kho & đối soát",
        icon: "balance-scale-left",
      },
      {
        screen: "RPT-03",
        path: ROUTES.REPORTS_TRACEABILITY,
        label: "Truy vết hàng hóa",
        icon: "barcode-read",
      },
      {
        screen: "RPT-04",
        path: ROUTES.REPORTS_IMPORT_QUALITY,
        label: "Nhập dữ liệu / đối chiếu & lỗi dữ liệu",
        icon: "clipboard-list-check",
      },
      {
        screen: "RPT-05",
        path: ROUTES.REPORTS_PACKING_LABEL,
        label: "Nhãn đóng gói – In / In lại",
        icon: "print",
      },
      {
        screen: "RPT-06",
        path: ROUTES.REPORTS_WARRANTY,
        label: "Bảo hành & linh kiện",
        icon: "shield-exclamation",
      },
      {
        screen: "RPT-07",
        path: ROUTES.REPORTS_RECIPIENT,
        label: "Xuất theo người nhận / đại lý",
        icon: "truck-container",
      },
      {
        screen: "RPT-08",
        path: ROUTES.REPORTS_PENDING_EVIDENCE,
        label: "Lịch sử nhập – xuất kho",
        icon: "paperclip-vertical",
      },
    ],
  },
  {
    name: "Hệ thống",
    icon: "settings-2",
    railDivider: true,
    items: [
      {
        screen: "IAM-01",
        path: ROUTES.IAM_USERS,
        label: "Danh sách người dùng & phân quyền",
        icon: "users",
      },
      // {
      //   // NAV-01 fix: PV admin (SCR-PV-ADM-01) trước đây không có trong sidebar.
      //   screen: "PV-ADM-01",
      //   path: ROUTES.PV_ADMIN,
      //   label: "Ứng dụng phân vùng (PV)",
      //   icon: "globe",
      // },
      {
        screen: "WH-01",
        path: ROUTES.WAREHOUSE_CONFIG,
        label: "Cấu hình kho",
        icon: "home",
      },
      {
        screen: "AUDIT-01",
        path: ROUTES.AUDIT_LOGS,
        label: "Nhật ký hệ thống",
        icon: "audit",
      },
    ],
  },
];

export const DEFAULT_SCREEN_BY_PATH: Record<string, string> = {
  [ROUTES.DASHBOARD]: "MAP-01",
  [ROUTES.IAM_USERS]: "IAM-01",
  [ROUTES.MASTER_DATA]: "MST-01",
  [ROUTES.CATALOG_MASTER]: "MST-CAT-01",
  [ROUTES.WAREHOUSE_CONFIG]: "WH-01",
  [ROUTES.AGENCIES]: "AGY-01",
  [ROUTES.DEFECTS]: "DEF-01",
  [ROUTES.INBOUND]: "IN-01",
  [ROUTES.PUTAWAY]: "PTW-00",
  [ROUTES.OUTBOUND]: "OUT-01",
  [ROUTES.WARRANTY]: "WAR-01",
  [ROUTES.WARRANTY_COMPONENT_ISSUES]: "WAR-04",
  [ROUTES.INVENTORY]: "INV-01",
  [ROUTES.SCAN]: "TRACE-01",
  [ROUTES.REVERSE]: "REV-00",
  [ROUTES.REPORTS_INVENTORY_FLOW]: "RPT-01",
  [ROUTES.REPORTS_STOCK_RECONCILE]: "RPT-02",
  [ROUTES.REPORTS_TRACEABILITY]: "RPT-03",
  [ROUTES.REPORTS_IMPORT_QUALITY]: "RPT-04",
  [ROUTES.REPORTS_PACKING_LABEL]: "RPT-05",
  [ROUTES.REPORTS_WARRANTY]: "RPT-06",
  [ROUTES.REPORTS_RECIPIENT]: "RPT-07",
  [ROUTES.REPORTS_PENDING_EVIDENCE]: "RPT-08",
  [ROUTES.AUDIT_LOGS]: "AUDIT-01",
  [ROUTES.PV_ADMIN]: "PV-ADM-01",
};

/** Screen-id dạng modal → màn danh sách cha (đánh dấu active + tiêu đề). */
export const MODAL_PARENT_SCREEN: Record<string, string> = {
  "IAM-02": "IAM-01",
  "MST-02": "MST-01",
  "AGY-02": "AGY-01",
  "DEF-02": "DEF-01",
  "IN-02": "IN-01",
  "IN-03": "IN-01",
  "PTW-01": "PTW-00",
  "OUT-REQ-01": "OUT-01",
  "OUT-03": "OUT-01",
  "OUT-02": "OUT-01",
  "LBL-01": "OUT-01",
  "RFID-01": "OUT-01",
  "WAR-02": "WAR-01",
  "WAR-03": "WAR-01",
  "COMP-01": "WAR-01",
  "TRACE-01": "INV-01",
  "REV-01": "REV-00",
};

export function normalizeScreen(screen: string | null | undefined) {
  if (!screen) return screen ?? null;
  return MODAL_PARENT_SCREEN[screen] ?? screen;
}

export function matchesPath(currentPath: string, targetPath: string) {
  return (
    currentPath === targetPath ||
    (targetPath !== "/" && currentPath.startsWith(`${targetPath}/`))
  );
}

export function canAccessPath(
  path: string,
  permissionCodes: string[],
  isSuperAdmin: boolean,
) {
  const required = ROUTE_PERMISSIONS[path];
  if (!required) return true;
  const permissions = Array.isArray(required) ? required : [required];
  return hasAnyWmsPermission(permissionCodes, permissions, isSuperAdmin);
}

/**
 * Lọc nav theo quyền — dùng bởi SideNav và test RBAC menu
 * (thay filterMenu của menu.tsx cũ).
 */
export function getVisibleNavGroups(
  permissionCodes: string[],
  isSuperAdmin: boolean,
): NavGroupData[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      canAccessPath(item.path, permissionCodes, isSuperAdmin),
    ),
  })).filter((group) => group.items.length > 0);
}

/** Tiêu đề/mô tả route ngoài NAV_GROUPS (header + breadcrumb). */
export const ROUTE_META: Record<
  string,
  { title: string; description: string }
> = {
  [ROUTES.IAM_ROLES]: {
    title: "Vai trò & phân quyền",
    description:
      "Quản trị mẫu vai trò và quyền sử dụng theo quy tắc phân quyền hiện hành.",
  },
  [ROUTES.PROFILE]: {
    title: "Hồ sơ cá nhân",
    description: "Thông tin tài khoản và ngữ cảnh truy cập hiện hành.",
  },
  [ROUTES.PUTAWAY_TRAYS]: {
    title: "Tổng quan tình trạng khay",
    description:
      "Xem nhanh khay trống / đang chứa / cần chú ý, không thao tác xếp khay.",
  },
  [ROUTES.NOTIFICATIONS]: {
    title: "Thông báo",
    description: "Danh sách thông báo hệ thống của tài khoản.",
  },
  [ROUTES.UI_FOUNDATION]: {
    title: "Foundation catalog",
    description: "Golden catalog của design system (DEV).",
  },
  [ROUTES.COMPONENT_CATALOG]: {
    title: "Foundation catalog",
    description: "Golden catalog của design system (DEV).",
  },
  [ROUTES.NO_PERMISSION]: {
    title: "Không có quyền truy cập",
    description: "Tài khoản hiện tại chưa được cấp quyền vào màn hình vừa mở.",
  },
};

/** Tiêu đề/mô tả theo screen-id (header của shell). */
export const SCREEN_META: Record<
  string,
  { title: string; description: string }
> = {
  "MAP-01": {
    title: "Tổng quan vận hành",
    description:
      "Tổng quan phạm vi giao diện, không bao gồm ứng dụng phân vùng.",
  },
  "IAM-01": {
    title: "Danh sách người dùng & phân quyền",
    description:
      "Danh sách người dùng, vai trò, phạm vi dữ liệu và trạng thái.",
  },
  "MST-01": {
    title: "Danh sách SKU",
    description: "Danh sách SKU và thao tác chỉnh sửa dữ liệu sản phẩm.",
  },
  "MST-CAT-01": {
    title: "Danh mục sản phẩm",
    description:
      "Hãng, nhóm hàng, mẫu sản phẩm, nguồn điện và quy cách đóng gói dùng khi tạo SKU.",
  },
  "WH-01": {
    title: "Cấu hình kho",
    description:
      "Thông tin, liên hệ và trạng thái của kho tổng duy nhất theo REQ-SRS-001.",
  },
  "AGY-01": {
    title: "Danh mục đại lý / nơi nhận",
    description: "Danh mục đại lý / nơi nhận hàng.",
  },
  "DEF-01": {
    title: "Danh mục bệnh / lỗi",
    description: "Danh mục bệnh / lỗi dùng cho bảo hành.",
  },
  "IN-01": {
    title: "Danh sách phiếu nhập",
    description: "Danh sách phiếu nhập.",
  },
  "PTW-00": {
    title: "Danh sách linh kiện chờ xếp khay",
    description: "Danh sách linh kiện chờ xếp khay để chọn hộp cần xử lý.",
  },
  "OUT-01": {
    title: "Danh sách phiếu xuất",
    description: "Danh sách phiếu xuất.",
  },
  "WAR-01": {
    title: "Danh sách bảo hành",
    description: "Danh sách bảo hành.",
  },
  "WAR-04": {
    title: "Danh sách phiếu xuất linh kiện",
    description: "Toàn bộ phiếu xuất linh kiện, xuyên các case bảo hành.",
  },
  "INV-01": {
    title: "Tra cứu tồn & đối soát",
    description: "Tra cứu tồn và đối soát.",
  },
  "TRACE-01": {
    title: "Truy vết mã vật lý",
    description: "Truy vết mã vật lý.",
  },
  "REV-00": {
    title: "Danh sách phiếu điều chỉnh tồn kho",
    description: "Danh sách phiếu để chọn tạo điều chỉnh tồn kho.",
  },
  "RPT-01": {
    title: "Nhập – Xuất – Tồn",
    description:
      "Cân đối tồn theo kỳ, biến động theo ngày và toàn bộ chứng từ phát sinh.",
  },
  "RPT-02": {
    title: "Tồn kho & đối soát",
    description: "Cơ cấu tồn kho hiện tại và tỷ lệ đối soát theo kỳ.",
  },
  "RPT-03": {
    title: "Truy vết hàng hóa",
    description: "Truy vết vòng đời sản phẩm theo mã vật lý hoặc SKU.",
  },
  "RPT-04": {
    title: "Nhập dữ liệu / đối chiếu & lỗi dữ liệu",
    description: "Kết quả Import/Scan theo thời gian và các mã lỗi phổ biến.",
  },
  "RPT-05": {
    title: "Nhãn đóng gói – In / In lại",
    description: "Kết quả in nhãn theo thời gian và máy in có nhiều lỗi nhất.",
  },
  "RPT-06": {
    title: "Bảo hành & linh kiện",
    description: "Tình trạng, xu hướng bảo hành và bệnh/lỗi theo SKU.",
  },
  "RPT-07": {
    title: "Xuất theo người nhận / đại lý",
    description: "Cơ cấu hàng đã xuất theo người nhận và loại người nhận.",
  },
  "RPT-08": {
    title: "Lịch sử nhập – xuất kho",
    description:
      "Lịch sử chứng từ nhập / xuất / hoàn tác đã ghi nhận theo posted_at.",
  },
  "AUDIT-01": {
    title: "Nhật ký hệ thống",
    description: "Theo dõi lịch sử thao tác và thay đổi trong hệ thống.",
  },
  "PV-ADM-01": {
    title: "Ứng dụng phân vùng (PV)",
    description: "Publish SKU, gắn ngành hàng và ưu tiên gợi ý cho app PV.",
  },
};

/**
 * Meta trả về khi route KHÔNG khai báo tiêu đề — shell dùng nó làm dấu hiệu
 * "màn này chưa có header chuẩn" và bỏ qua header thay vì in một cụm chữ vô
 * nghĩa (vd trang 404 khớp mọi đường dẫn).
 */
export const UNKNOWN_SCREEN_META = {
  title: "Hoa Nam WMS",
  description: "Bám BRD / SRS-FRD / BPD hiện tại",
};

/** Tiêu đề header: ?screen= (đã normalize) → default theo route → ROUTE_META. */
export function resolveScreenMeta(pathname: string, search: string) {
  const requested = normalizeScreen(new URLSearchParams(search).get("screen"));
  if (requested && SCREEN_META[requested]) return SCREEN_META[requested];
  const fallback = DEFAULT_SCREEN_BY_PATH[pathname];
  if (fallback && SCREEN_META[fallback]) return SCREEN_META[fallback];
  return ROUTE_META[pathname] ?? UNKNOWN_SCREEN_META;
}

export interface BreadcrumbEntry {
  label: string;
  path?: string;
  /**
   * Khoá tra i18n của nhãn: screen-id cho mục, tên icon cho nhóm. `undefined`
   * cho những chặng không nằm trong cây menu (Trang chủ, route ngoài nav) —
   * chỗ đó dùng thẳng `label`.
   */
  i18nKey?: string;
}

/**
 * Breadcrumb hợp nhất từ nav-data (đóng NAV-01): Trang chủ → nhóm → mục.
 * Route ngoài nav (profile/notifications/roles...) lấy nhãn từ ROUTE_META.
 */
export function getBreadcrumbTrail(pathname: string): BreadcrumbEntry[] {
  const home: BreadcrumbEntry = {
    label: "Trang chủ",
    path: ROUTES.DASHBOARD,
    i18nKey: "home",
  };
  if (pathname === ROUTES.DASHBOARD) return [home];

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (matchesPath(pathname, item.path)) {
        return [
          home,
          { label: group.name, i18nKey: group.icon },
          { label: item.label, i18nKey: item.screen },
        ];
      }
    }
  }
  const meta = ROUTE_META[pathname];
  if (meta) return [home, { label: meta.title }];
  return [home];
}
