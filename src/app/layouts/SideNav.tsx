import { useLocation, useNavigate } from "react-router-dom";
import { ContextSwitcher } from "@/modules/auth/components/ContextSwitcher";
import { UserMenu } from "@/app/layouts/UserMenu";
import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

type NavItem = {
  path: string;
  label: string;
};

type NavGroup = {
  name: string;
  items: NavItem[];
};

/**
 * Navigation order and wording follow HN_WMS_Wireframe_MVP.html.
 * Only screens that have real FE routes are rendered; RBAC remains enforced.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    name: "00 · Tổng quan",
    items: [
      { path: ROUTES.DASHBOARD, label: "Bản đồ màn hình & phạm vi" },
    ],
  },
  {
    name: "01 · Hệ thống & danh mục",
    items: [
      { path: ROUTES.MASTER_DATA, label: "Danh sách SKU / Product Master" },
      { path: ROUTES.AUDIT_LOGS, label: "Nhật ký kiểm tra" },
    ],
  },
  {
    name: "02 · Nhập kho",
    items: [
      { path: ROUTES.INBOUND, label: "Danh sách phiếu nhập" },
      { path: ROUTES.PUTAWAY, label: "Putaway linh kiện vào khay" },
    ],
  },
  {
    name: "03 · Xuất kho",
    items: [{ path: ROUTES.OUTBOUND, label: "Danh sách phiếu xuất" }],
  },
  {
    name: "04 · Bảo hành & linh kiện",
    items: [{ path: ROUTES.WARRANTY, label: "Danh sách bảo hành" }],
  },
  {
    name: "05 · Tồn kho & kiểm soát",
    items: [
      { path: ROUTES.INVENTORY, label: "Tra cứu tồn & đối soát" },
      { path: ROUTES.SCAN, label: "Truy vết mã vật lý" },
      { path: ROUTES.REVERSE, label: "Danh sách phiếu Reversal" },
      { path: ROUTES.STOCKTAKE, label: "Kiểm kê" },
    ],
  },
  {
    name: "06 · Báo cáo",
    items: [{ path: ROUTES.REPORTS, label: "Báo cáo vận hành" }],
  },
];

function matchesPath(currentPath: string, targetPath: string) {
  return (
    currentPath === targetPath ||
    (targetPath !== "/" && currentPath.startsWith(`${targetPath}/`))
  );
}

export function SideNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);

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
          <p>Wireframe BA · MVP · Chưa gồm App PV</p>
        </div>
      </div>

      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => canAccess(item.path));
        if (visibleItems.length === 0) return null;

        return (
          <section key={group.name} aria-label={group.name}>
            <div className="hn-mvp-group">{group.name}</div>
            {visibleItems.map((item) => {
              const active = matchesPath(location.pathname, item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  className={`hn-mvp-nav-btn${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => navigate(item.path)}
                >
                  {item.label}
                </button>
              );
            })}
          </section>
        );
      })}

      <div className="hn-mvp-account">
        <div className="hn-mvp-group">Tài khoản</div>
        <ContextSwitcher />
        <div style={{ marginTop: 8 }}>
          <UserMenu compact={false} />
        </div>
      </div>
    </nav>
  );
}
