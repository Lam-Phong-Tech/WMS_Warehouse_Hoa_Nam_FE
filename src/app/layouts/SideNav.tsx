import { useLocation, useNavigate } from "react-router-dom";
import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { ROUTES } from "@/shared/constants/routes";
import { hasAnyWmsPermission } from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";

type NavItem = { screen: string; label: string; path: string };
type NavGroup = { name: string; items: NavItem[] };

/**
 * Navigation follows the Hoa Nam MVP screen inventory while keeping transactional
 * subflows inside their owning list screens. Create/edit screens for IAM, SKU,
 * Agency, Defect and Inbound are in-page modals. Inbound scan/full-post is opened
 * from the receipt list, and Putaway detail is opened from the pending list.
 *
 * Each list item deliberately uses its owning route so visibility is evaluated
 * against that domain's RBAC permission rather than a presentation-only screen id.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    name: "00 · Tổng quan",
    items: [
      {
        screen: "MAP-01",
        path: ROUTES.DASHBOARD,
        label: "Bản đồ màn hình & phạm vi",
      },
    ],
  },
  {
    name: "01 · Hệ thống & danh mục",
    items: [
      {
        screen: "IAM-01",
        path: ROUTES.IAM_USERS,
        label: "Danh sách người dùng & phân quyền",
      },
      {
        screen: "MST-01",
        path: ROUTES.MASTER_DATA,
        label: "Danh sách SKU / Product Master",
      },
      {
        // SCR-MST-01 (REQ-SRS-029): hãng/nhóm hàng/model/nguồn điện/quy cách là
        // master nuôi form tạo SKU nên đứng ngay cạnh mục SKU.
        screen: "MST-CAT-01",
        path: ROUTES.CATALOG_MASTER,
        label: "Danh mục Product Master",
      },
      {
        // SCR-WH-01 (REQ-SRS-001): cấu hình đúng 01 kho tổng.
        screen: "WH-01",
        path: ROUTES.WAREHOUSE_CONFIG,
        label: "Cấu hình kho tổng",
      },
      {
        screen: "AGY-01",
        path: ROUTES.AGENCIES,
        label: "Danh mục đại lý / nơi nhận",
      },
      {
        screen: "DEF-01",
        path: ROUTES.DEFECTS,
        label: "Danh mục bệnh / lỗi",
      },
    ],
  },
  {
    name: "02 · Nhập kho",
    items: [
      {
        screen: "IN-01",
        path: ROUTES.INBOUND,
        label: "Danh sách phiếu nhập",
      },
      {
        screen: "PTW-00",
        path: ROUTES.PUTAWAY,
        label: "Danh sách linh kiện chờ xếp khay",
      },
    ],
  },
  {
    name: "03 · Xuất kho",
    items: [
      {
        screen: "OUT-01",
        path: ROUTES.OUTBOUND,
        label: "Danh sách phiếu xuất",
      },
    ],
  },
  {
    // WAR-02 / WAR-03 / COMP-01 mở modal ngay trên danh sách (giống IN-02/OUT-03)
    // nên không liệt kê trong menu; deep-link ?screen= vẫn được WarrantyPage xử lý.
    name: "04 · Bảo hành & linh kiện",
    items: [
      {
        screen: "WAR-01",
        path: ROUTES.WARRANTY,
        label: "Danh sách bảo hành",
      },
    ],
  },
  {
    // TRACE-01 / REV-01 mở modal ngay trên danh sách (giống WAR-02/COMP-01)
    // nên không liệt kê trong menu; deep-link ?screen= vẫn được hub page xử lý.
    name: "05 · Tồn kho & kiểm soát",
    items: [
      {
        screen: "INV-01",
        path: ROUTES.INVENTORY,
        label: "Tra cứu tồn & đối soát",
      },
      {
        screen: "REV-00",
        path: ROUTES.REVERSE,
        label: "Danh sách phiếu Reversal",
      },
    ],
  },
  {
    name: "06 · Báo cáo",
    items: [
      {
        screen: "RPT-01",
        path: ROUTES.REPORTS,
        label: "Báo cáo vận hành",
      },
    ],
  },
];

const DEFAULT_SCREEN_BY_PATH: Record<string, string> = {
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
  [ROUTES.INVENTORY]: "INV-01",
  [ROUTES.SCAN]: "TRACE-01",
  [ROUTES.REVERSE]: "REV-00",
  [ROUTES.REPORTS]: "RPT-01",
};

const MODAL_PARENT_SCREEN: Record<string, string> = {
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

function matchesPath(currentPath: string, targetPath: string) {
  return (
    currentPath === targetPath ||
    (targetPath !== "/" && currentPath.startsWith(`${targetPath}/`))
  );
}

function normalizeScreen(screen: string | null | undefined) {
  if (!screen) return screen;
  return MODAL_PARENT_SCREEN[screen] ?? screen;
}

export function SideNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const requestedScreen = new URLSearchParams(location.search).get("screen");
  const selectedScreen =
    normalizeScreen(requestedScreen) ??
    DEFAULT_SCREEN_BY_PATH[location.pathname];

  const canAccess = (path: string) => {
    const required = ROUTE_PERMISSIONS[path];
    if (!required) return true;
    const permissions = Array.isArray(required) ? required : [required];
    return hasAnyWmsPermission(permissionCodes, permissions, isSuperAdmin);
  };

  return (
    <nav data-testid="primary-navigation" aria-label="Điều hướng chính">
      <div className="hn-mvp-brand">
        <div className="hn-mvp-logo" aria-hidden="true">
          HN
        </div>
        <div className="hn-mvp-brand-copy">
          <h1>Hoa Nam WMS</h1>
        </div>
      </div>

      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => canAccess(item.path));
        if (visibleItems.length === 0) return null;
        return (
          <section key={group.name} aria-label={group.name}>
            <div className="hn-mvp-group">{group.name}</div>
            {visibleItems.map((item) => {
              const active =
                selectedScreen === item.screen &&
                matchesPath(location.pathname, item.path);
              return (
                <button
                  key={item.screen}
                  type="button"
                  className={`hn-mvp-nav-btn${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => navigate(`${item.path}?screen=${item.screen}`)}
                >
                  {item.label}
                </button>
              );
            })}
          </section>
        );
      })}
    </nav>
  );
}
