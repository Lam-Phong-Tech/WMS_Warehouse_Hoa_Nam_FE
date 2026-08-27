import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  DownOutlined,
  FileTextOutlined,
  FundOutlined,
  HomeOutlined,
  InboxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  RightOutlined,
  RollbackOutlined,
  SettingOutlined,
  ShopOutlined,
  StockOutlined,
  SwapOutlined,
  TeamOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { ROUTES } from "@/shared/constants/routes";
import { hasAnyWmsPermission } from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";

type NavItem = { screen: string; label: string; path: string; icon: ReactNode };
type NavGroup = { name: string; icon: ReactNode; items: NavItem[] };

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
    name: "Tổng quan",
    icon: <BarChartOutlined />,
    items: [
      {
        screen: "MAP-01",
        path: ROUTES.DASHBOARD,
        label: "Bản đồ màn hình & phạm vi",
        icon: <BarChartOutlined />,
      },
    ],
  },
  {
    name: "Danh mục",
    icon: <SettingOutlined />,
    items: [
      {
        screen: "MST-01",
        path: ROUTES.MASTER_DATA,
        label: "Danh sách SKU",
        icon: <ProfileOutlined />,
      },
      {
        // SCR-MST-01 (REQ-SRS-029): hãng/nhóm hàng/model/nguồn điện/quy cách là
        // master nuôi form tạo SKU nên đứng ngay cạnh mục SKU.
        screen: "MST-CAT-01",
        path: ROUTES.CATALOG_MASTER,
        label: "Danh mục sản phẩm",
        icon: <AppstoreOutlined />,
      },
      {
        screen: "AGY-01",
        path: ROUTES.AGENCIES,
        label: "Danh mục đại lý / nơi nhận",
        icon: <ShopOutlined />,
      },
      {
        screen: "DEF-01",
        path: ROUTES.DEFECTS,
        label: "Danh mục bệnh / lỗi",
        icon: <WarningOutlined />,
      },
    ],
  },
  {
    name: "Nhập kho",
    icon: <InboxOutlined />,
    items: [
      {
        screen: "IN-01",
        path: ROUTES.INBOUND,
        label: "Danh sách phiếu nhập",
        icon: <InboxOutlined />,
      },
      {
        screen: "PTW-00",
        path: ROUTES.PUTAWAY,
        label: "Danh sách linh kiện chờ xếp khay",
        icon: <SwapOutlined />,
      },
    ],
  },
  {
    name: "Xuất kho",
    icon: <StockOutlined />,
    items: [
      {
        screen: "OUT-01",
        path: ROUTES.OUTBOUND,
        label: "Danh sách phiếu xuất",
        icon: <StockOutlined />,
      },
    ],
  },
  {
    // WAR-02 / WAR-03 / COMP-01 mở modal ngay trên danh sách (giống IN-02/OUT-03)
    // nên không liệt kê trong menu; deep-link ?screen= vẫn được WarrantyPage xử lý.
    name: "Bảo hành & linh kiện",
    icon: <ToolOutlined />,
    items: [
      {
        screen: "WAR-01",
        path: ROUTES.WARRANTY,
        label: "Danh sách bảo hành",
        icon: <ToolOutlined />,
      },
    ],
  },
  {
    // TRACE-01 / REV-01 mở modal ngay trên danh sách (giống WAR-02/COMP-01)
    // nên không liệt kê trong menu; deep-link ?screen= vẫn được hub page xử lý.
    name: "Tồn kho & kiểm soát",
    icon: <FundOutlined />,
    items: [
      {
        screen: "INV-01",
        path: ROUTES.INVENTORY,
        label: "Tra cứu tồn & đối soát",
        icon: <FundOutlined />,
      },
      {
        screen: "REV-00",
        path: ROUTES.REVERSE,
        label: "Danh sách phiếu điều chỉnh tồn kho",
        icon: <RollbackOutlined />,
      },
    ],
  },
  {
    name: "Báo cáo",
    icon: <FileTextOutlined />,
    items: [
      {
        screen: "RPT-01",
        path: ROUTES.REPORTS,
        label: "Báo cáo vận hành",
        icon: <FileTextOutlined />,
      },
    ],
  },
  {
    name: "Hệ thống",
    icon: <SettingOutlined />,
    items: [
      {
        // Gộp cả tab "Vai trò & ma trận quyền" và "Phòng ban" bên trong
        // (IamUsersGd1Page); route /system/roles vẫn sống cho deep-link.
        screen: "IAM-01",
        path: ROUTES.IAM_USERS,
        label: "Danh sách người dùng & phân quyền",
        icon: <TeamOutlined />,
      },
      {
        // SCR-WH-01 (REQ-SRS-001): cấu hình đúng 01 kho tổng.
        screen: "WH-01",
        path: ROUTES.WAREHOUSE_CONFIG,
        label: "Cấu hình kho",
        icon: <HomeOutlined />,
      },
      {
        // AUDIT-01: route + quyền audit_log.view đã có sẵn từ trước nhưng
        // chưa từng được liệt kê trong NAV_GROUPS (mảng menu.tsx tương ứng
        // chỉ dùng cho breadcrumb, không phải sidebar thật) nên mục này vô
        // hình với mọi user kể cả admin.
        screen: "AUDIT-01",
        path: ROUTES.AUDIT_LOGS,
        label: "Nhật ký hệ thống",
        icon: <AuditOutlined />,
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
  [ROUTES.AUDIT_LOGS]: "AUDIT-01",
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

export interface SideNavProps {
  /** true khi thanh bên đang ở chế độ thu gọn (chỉ còn dải icon nhóm). */
  collapsed?: boolean;
  /** Yêu cầu mở lại thanh bên đầy đủ (gọi khi bấm icon nhóm lúc đang thu gọn). */
  onExpand?: () => void;
  /** Đảo trạng thái thu gọn — nút đóng/mở nằm ngay trong thanh bên, cạnh tên hệ thống. */
  onToggle?: () => void;
}

export function SideNav({
  collapsed = false,
  onExpand,
  onToggle,
}: SideNavProps) {
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

  const activeGroupName = NAV_GROUPS.find((group) =>
    group.items.some(
      (item) =>
        selectedScreen === item.screen &&
        matchesPath(location.pathname, item.path),
    ),
  )?.name;

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(activeGroupName ? [activeGroupName] : []),
  );
  const isFirstRender = useRef(true);

  // Trang hiện tại đổi (điều hướng từ breadcrumb, deep-link, nút back...) —
  // luôn đảm bảo nhóm đang active được mở, không đụng tới các nhóm khác mà
  // người dùng đã tự mở/đóng. Bỏ qua lần render đầu vì state khởi tạo đã
  // tính sẵn giá trị này rồi.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!activeGroupName) return;
    setOpenGroups((prev) =>
      prev.has(activeGroupName) ? prev : new Set(prev).add(activeGroupName),
    );
  }, [activeGroupName]);

  const handleGroupHeaderClick = (name: string) => {
    if (collapsed) {
      onExpand?.();
      setOpenGroups((prev) => new Set(prev).add(name));
      return;
    }
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
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
        {onToggle ? (
          <button
            type="button"
            className="hn-mvp-aside-toggle"
            onClick={onToggle}
            aria-label={collapsed ? "Hiện menu" : "Ẩn menu"}
            aria-pressed={collapsed}
            title={collapsed ? "Hiện menu" : "Ẩn menu"}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        ) : null}
      </div>

      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => canAccess(item.path));
        if (visibleItems.length === 0) return null;
        const open = openGroups.has(group.name);
        return (
          <section key={group.name} aria-label={group.name}>
            <button
              type="button"
              className="hn-mvp-group"
              onClick={() => handleGroupHeaderClick(group.name)}
              aria-expanded={open}
              title={group.name}
            >
              <span className="hn-mvp-group-icon">{group.icon}</span>
              <span className="hn-mvp-group-label">{group.name}</span>
              <span className="hn-mvp-group-caret">
                {open ? <DownOutlined /> : <RightOutlined />}
              </span>
            </button>
            <div className={`hn-mvp-group-items${open ? "" : " is-collapsed"}`}>
              <div className="hn-mvp-group-items-inner">
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
                      onClick={() =>
                        navigate(`${item.path}?screen=${item.screen}`)
                      }
                    >
                      <span className="hn-mvp-nav-btn-icon">{item.icon}</span>
                      <span className="hn-mvp-nav-btn-label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </nav>
  );
}
