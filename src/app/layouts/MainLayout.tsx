import { lazy, Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { SideNav } from "@/app/layouts/SideNav";
import { UserMenu } from "@/app/layouts/UserMenu";
import { useMe } from "@/modules/auth/hooks/use-me";
import { Loading } from "@/shared/components";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "hn-wms-sidebar-collapsed";

function readStoredSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const IamUsersGd1Page = lazy(() =>
  import("@/modules/iam/pages/IamUsersGd1Page").then((m) => ({
    default: m.IamUsersGd1Page,
  })),
);
const SkuMasterScreen = lazy(() =>
  import("@/modules/master-data/pages/MvpMasterScreens").then((m) => ({
    default: m.SkuMasterScreen,
  })),
);
const AgencyMasterScreen = lazy(() =>
  import("@/modules/master-data/pages/MvpMasterScreens").then((m) => ({
    default: m.AgencyMasterScreen,
  })),
);
const DefectMasterScreen = lazy(() =>
  import("@/modules/master-data/pages/MvpMasterScreens").then((m) => ({
    default: m.DefectMasterScreen,
  })),
);
const DashboardPage = lazy(() =>
  import("@/modules/dashboard/pages/DashboardPage").then((m) => ({
    default: m.default,
  })),
);
const InboundPage = lazy(() =>
  import("@/modules/inbound/pages/InboundPage").then((m) => ({
    default: m.default,
  })),
);
const PutawayPage = lazy(() =>
  import("@/modules/putaway/pages/PutawayPage").then((m) => ({
    default: m.default,
  })),
);
const OutboundPage = lazy(() =>
  import("@/modules/outbound/pages/OutboundPage").then((m) => ({
    default: m.default,
  })),
);
const WarrantyPage = lazy(() =>
  import("@/modules/warranty/pages/WarrantyPage").then((m) => ({
    default: m.default,
  })),
);
const InventoryPage = lazy(() =>
  import("@/modules/inventory/pages/InventoryPage").then((m) => ({
    default: m.default,
  })),
);
const ReversalPage = lazy(() =>
  import("@/modules/reverse/pages/ReversalPage").then((m) => ({
    default: m.default,
  })),
);
const ReportsPage = lazy(() =>
  import("@/modules/reports/pages/ReportsPage").then((m) => ({
    default: m.default,
  })),
);

type ScreenMeta = {
  title: string;
  description: string;
};

const MVP_SCREEN_META: Record<string, ScreenMeta> = {
  "MAP-01": {
    title: "Bản đồ màn hình & phạm vi",
    description:
      "Tổng quan phạm vi giao diện MVP, không bao gồm ứng dụng phân vùng.",
  },
  "IAM-01": {
    title: "Danh sách người dùng & phân quyền",
    description:
      "Danh sách người dùng, vai trò, phạm vi dữ liệu và trạng thái.",
  },
  "MST-01": {
    title: "Danh sách SKU / Danh mục sản phẩm",
    description: "Danh sách SKU và thao tác chỉnh sửa dữ liệu sản phẩm.",
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
  "IN-02": {
    title: "Tạo / sửa phiếu nhập nháp",
    description: "Tạo mới hoặc chỉnh sửa phiếu nhập chưa hoàn tất.",
  },
  "IN-03": {
    title: "Quét & hoàn tất nhập kho",
    description: "Quét hàng và hoàn tất nhập kho.",
  },
  "PTW-00": {
    title: "Danh sách linh kiện chờ xếp khay",
    description: "Danh sách linh kiện chờ xếp khay để chọn hộp cần xử lý.",
  },
  "PTW-01": {
    title: "Xếp linh kiện vào khay",
    description: "Xếp linh kiện từ hộp vào khay đích.",
  },
  "OUT-REQ-01": {
    title: "Tiếp nhận phiếu yêu cầu xuất",
    description:
      "Tiếp nhận phiếu yêu cầu xuất, có thể nhập dữ liệu từ tệp Excel.",
  },
  "OUT-01": {
    title: "Danh sách phiếu xuất",
    description: "Danh sách phiếu xuất.",
  },
  "OUT-03": {
    title: "Chi tiết phiếu xuất",
    description: "Chi tiết phiếu xuất khi mở hoặc xem phiếu.",
  },
  "OUT-02": {
    title: "Quét & đối chiếu sản phẩm",
    description: "Quét mã và đối chiếu sản phẩm trong phiếu xuất.",
  },
  "LBL-01": {
    title: "Nhãn đóng gói lô hàng",
    description:
      "Tạo, xem trước, chuẩn bị và in đúng một nhãn đóng gói cho phiếu/lô xuất; in lại được khi cần, không ảnh hưởng tồn kho.",
  },
  "RFID-01": {
    title: "RFID tùy chọn & hoàn tất xuất kho",
    description:
      "Gán RFID khi có thẻ và kiểm tra đủ điều kiện trước khi hoàn tất xuất kho.",
  },
  "WAR-01": {
    title: "Danh sách bảo hành",
    description: "Danh sách bảo hành.",
  },
  "WAR-02": {
    title: "Tiếp nhận bảo hành",
    description: "Tiếp nhận bảo hành.",
  },
  "WAR-03": {
    title: "Chi tiết bảo hành",
    description: "Chi tiết bảo hành.",
  },
  "COMP-01": {
    title: "Xuất linh kiện cho bảo hành",
    description: "Xuất linh kiện cho bảo hành.",
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
  "REV-01": {
    title: "Tạo phiếu điều chỉnh tồn kho",
    description: "Tạo phiếu điều chỉnh tồn kho.",
  },
  "RPT-01": {
    title: "Báo cáo vận hành",
    description:
      "Tồn kho, Nhập-Xuất-Tồn, Lịch sử phiếu, Đối soát toa, Nhật ký nhãn, Bảo hành, Xuất theo nơi nhận.",
  },
};

const ROUTE_DEFAULT_SCREEN: Record<string, string> = {
  [ROUTES.DASHBOARD]: "MAP-01",
  [ROUTES.IAM_USERS]: "IAM-01",
  [ROUTES.MASTER_DATA]: "MST-01",
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

const ROUTE_META: Record<string, ScreenMeta> = {
  [ROUTES.CATALOG_MASTER]: {
    title: "Danh mục sản phẩm",
    description:
      "Hãng, nhóm hàng, mẫu sản phẩm, nguồn điện và quy cách đóng gói dùng khi tạo SKU.",
  },
  [ROUTES.WAREHOUSE_CONFIG]: {
    title: "Cấu hình kho",
    description:
      "Thông tin, liên hệ và trạng thái của kho tổng duy nhất theo REQ-SRS-001.",
  },
  [ROUTES.IAM_ROLES]: {
    title: "Vai trò & phân quyền",
    description:
      "Quản trị mẫu vai trò và quyền sử dụng theo quy tắc phân quyền hiện hành.",
  },
  [ROUTES.AUDIT_LOGS]: {
    title: "Nhật ký kiểm tra",
    description: "Theo dõi lịch sử thao tác và thay đổi trong hệ thống.",
  },
  [ROUTES.PROFILE]: {
    title: "Hồ sơ cá nhân",
    description: "Thông tin tài khoản và ngữ cảnh truy cập hiện hành.",
  },
  [ROUTES.COMPONENT_CATALOG]: {
    title: "Danh mục linh kiện",
    description: "Danh mục linh kiện dùng nội bộ trong hệ thống.",
  },
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

function normalizeScreen(screen: string | null) {
  if (!screen) return screen;
  return MODAL_PARENT_SCREEN[screen] ?? screen;
}

function resolveScreenMeta(pathname: string, search: string): ScreenMeta {
  const requestedScreen = normalizeScreen(
    new URLSearchParams(search).get("screen"),
  );
  if (requestedScreen && MVP_SCREEN_META[requestedScreen]) {
    return MVP_SCREEN_META[requestedScreen];
  }
  const defaultScreen = ROUTE_DEFAULT_SCREEN[pathname];
  if (defaultScreen) return MVP_SCREEN_META[defaultScreen];
  return (
    ROUTE_META[pathname] ?? {
      title: "Hoa Nam WMS",
      description: "Bám BRD / SRS-FRD / BPD hiện tại",
    }
  );
}

function renderMvpScreen(sourceScreen: string, requestedScreen: string | null) {
  switch (sourceScreen) {
    case "MAP-01":
      return <DashboardPage />;
    case "IAM-01":
      return (
        <div className="hn-mvp-source-screen">
          <IamUsersGd1Page openCreateOnMount={requestedScreen === "IAM-02"} />
        </div>
      );
    case "MST-01":
      return (
        <div className="hn-mvp-source-screen">
          <SkuMasterScreen openCreateOnMount={requestedScreen === "MST-02"} />
        </div>
      );
    case "AGY-01":
      return (
        <div className="hn-mvp-source-screen">
          <AgencyMasterScreen
            openCreateOnMount={requestedScreen === "AGY-02"}
          />
        </div>
      );
    case "DEF-01":
      return (
        <div className="hn-mvp-source-screen">
          <DefectMasterScreen
            openCreateOnMount={requestedScreen === "DEF-02"}
          />
        </div>
      );
    case "IN-01":
      return (
        <div className="hn-mvp-source-screen">
          <InboundPage />
        </div>
      );
    case "PTW-00":
      return (
        <div className="hn-mvp-source-screen">
          <PutawayPage />
        </div>
      );
    case "OUT-01":
      return (
        <div className="hn-mvp-source-screen">
          <OutboundPage />
        </div>
      );
    case "WAR-01":
      return (
        <div className="hn-mvp-source-screen">
          <WarrantyPage />
        </div>
      );
    case "INV-01":
      return (
        <div className="hn-mvp-source-screen">
          <InventoryPage />
        </div>
      );
    case "REV-00":
      return (
        <div className="hn-mvp-source-screen">
          <ReversalPage />
        </div>
      );
    case "RPT-01":
      return (
        <div className="hn-mvp-source-screen">
          <ReportsPage />
        </div>
      );
    default:
      return <Outlet />;
  }
}

export function MainLayout() {
  const location = useLocation();
  const isProfileLoaded = useAuthStore((state) => state.isProfileLoaded);
  const { isLoading: isLoadingProfile } = useMe();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    readStoredSidebarCollapsed,
  );
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // localStorage không khả dụng (chế độ ẩn danh) — bỏ qua, chỉ giữ state trong phiên.
      }
      return next;
    });
  };
  const requestedScreen = new URLSearchParams(location.search).get("screen");
  const normalizedScreen = normalizeScreen(requestedScreen);
  const sourceScreen =
    normalizedScreen && MVP_SCREEN_META[normalizedScreen]
      ? normalizedScreen
      : null;
  const meta = resolveScreenMeta(location.pathname, location.search);

  if (isLoadingProfile && !isProfileLoaded) return <Loading />;

  return (
    <div
      className={`hn-mvp-app${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}
    >
      <aside className="hn-mvp-aside" aria-hidden={sidebarCollapsed}>
        <SideNav />
      </aside>
      <main className="hn-mvp-main">
        <header className="hn-mvp-header">
          <div className="hn-mvp-header-left">
            <button
              type="button"
              className="hn-mvp-sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Hiện menu" : "Ẩn menu"}
              aria-pressed={sidebarCollapsed}
              title={sidebarCollapsed ? "Hiện menu" : "Ẩn menu"}
            >
              {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
            <div className="hn-mvp-title">
              <h2>{meta.title}</h2>
              <p>{meta.description}</p>
            </div>
          </div>
          <UserMenu />
        </header>
        <div className="hn-mvp-content">
          <section className="hn-mvp-screen">
            {sourceScreen ? (
              <Suspense fallback={<Loading />}>
                {renderMvpScreen(sourceScreen, requestedScreen)}
              </Suspense>
            ) : (
              <Outlet />
            )}
          </section>
        </div>
        <footer className="hn-mvp-footer">
          Hoa Nam ©{new Date().getFullYear()} — Phát triển bởi Lam Phong Tech
        </footer>
      </main>
    </div>
  );
}
