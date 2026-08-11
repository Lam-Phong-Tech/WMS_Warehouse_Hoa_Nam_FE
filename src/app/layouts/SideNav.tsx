import { useLocation, useNavigate } from "react-router-dom";
import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

type NavItem = { screen: string; label: string; path: string };
type NavGroup = { name: string; items: NavItem[] };

/**
 * Navigation follows the Hoa Nam MVP screen inventory. Create/edit screens for
 * IAM, SKU, Agency and Defect are folded into their list screens as in-page
 * modals. Legacy *-02 deep links remain supported by MainLayout.
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
        path: ROUTES.MASTER_DATA,
        label: "Danh sách người dùng & phân quyền",
      },
      {
        screen: "MST-01",
        path: ROUTES.MASTER_DATA,
        label: "Danh sách SKU / Product Master",
      },
      {
        screen: "AGY-01",
        path: ROUTES.MASTER_DATA,
        label: "Danh mục đại lý / nơi nhận",
      },
      {
        screen: "DEF-01",
        path: ROUTES.MASTER_DATA,
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
        screen: "IN-02",
        path: ROUTES.INBOUND,
        label: "Tạo / sửa phiếu nhập DRAFT",
      },
      {
        screen: "IN-03",
        path: ROUTES.INBOUND,
        label: "Quét & Full Post Receipt",
      },
      {
        screen: "PTW-00",
        path: ROUTES.PUTAWAY,
        label: "Danh sách linh kiện chờ xếp khay",
      },
      {
        screen: "PTW-01",
        path: ROUTES.PUTAWAY,
        label: "Putaway linh kiện vào khay",
      },
    ],
  },
  {
    name: "03 · Xuất kho",
    items: [
      {
        screen: "OUT-REQ-01",
        path: ROUTES.OUTBOUND,
        label: "Tiếp nhận Phiếu yêu cầu xuất",
      },
      {
        screen: "OUT-01",
        path: ROUTES.OUTBOUND,
        label: "Danh sách phiếu xuất",
      },
      {
        screen: "OUT-03",
        path: ROUTES.OUTBOUND,
        label: "Chi tiết phiếu xuất",
      },
      {
        screen: "OUT-02",
        path: ROUTES.OUTBOUND,
        label: "Quét & match Item",
      },
      { screen: "LBL-01", path: ROUTES.OUTBOUND, label: "Nhãn từng Item" },
      {
        screen: "RFID-01",
        path: ROUTES.OUTBOUND,
        label: "Map RFID & Full Post Issue",
      },
    ],
  },
  {
    name: "04 · Bảo hành & linh kiện",
    items: [
      {
        screen: "WAR-01",
        path: ROUTES.WARRANTY,
        label: "Danh sách bảo hành",
      },
      {
        screen: "WAR-02",
        path: ROUTES.WARRANTY,
        label: "Tiếp nhận bảo hành",
      },
      {
        screen: "WAR-03",
        path: ROUTES.WARRANTY,
        label: "Chi tiết bảo hành",
      },
      {
        screen: "COMP-01",
        path: ROUTES.WARRANTY,
        label: "Xuất linh kiện cho bảo hành",
      },
    ],
  },
  {
    name: "05 · Tồn kho & kiểm soát",
    items: [
      {
        screen: "INV-01",
        path: ROUTES.INVENTORY,
        label: "Tra cứu tồn & đối soát",
      },
      {
        screen: "TRACE-01",
        path: ROUTES.SCAN,
        label: "Truy vết mã vật lý",
      },
      {
        screen: "REV-00",
        path: ROUTES.REVERSE,
        label: "Danh sách phiếu Reversal",
      },
      {
        screen: "REV-01",
        path: ROUTES.REVERSE,
        label: "Tạo Reversal",
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
  [ROUTES.MASTER_DATA]: "MST-01",
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
    normalizeScreen(requestedScreen) ?? DEFAULT_SCREEN_BY_PATH[location.pathname];

  const canAccess = (path: string) => {
    if (isSuperAdmin) return true;
    const required = ROUTE_PERMISSIONS[path];
    if (!required) return true;
    const permissions = Array.isArray(required) ? required : [required];
    return permissions.some((code) => permissionCodes.includes(code));
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
