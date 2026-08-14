import { lazy, Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SideNav } from "@/app/layouts/SideNav";
import { UserMenu } from "@/app/layouts/UserMenu";
import { useMe } from "@/modules/auth/hooks/use-me";
import { Loading } from "@/shared/components";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

const IamUserScreen = lazy(() =>
  import("@/modules/iam/pages/IamUserScreen").then((m) => ({
    default: m.IamUserScreen,
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
const MvpSourceScreen = lazy(() =>
  import("@/shared/components/mvp/MvpSourceScreen").then((m) => ({
    default: m.MvpSourceScreen,
  })),
);

type ScreenMeta = {
  title: string;
  description: string;
};

const MVP_SCREEN_META: Record<string, ScreenMeta> = {
  "MAP-01": {
    title: "Bản đồ màn hình & phạm vi",
    description: "Tổng quan phạm vi wireframe MVP, không bao gồm App PV.",
  },
  "IAM-01": {
    title: "Danh sách người dùng & phân quyền",
    description:
      "Danh sách người dùng, vai trò, phạm vi dữ liệu và trạng thái.",
  },
  "MST-01": {
    title: "Danh sách SKU / Product Master",
    description: "Danh sách SKU, chỉ cần action Sửa.",
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
    title: "Tạo / sửa phiếu nhập DRAFT",
    description: "Tạo / sửa phiếu nhập DRAFT.",
  },
  "IN-03": {
    title: "Quét & Full Post Receipt",
    description: "Quét hàng và Full Post Receipt.",
  },
  "PTW-00": {
    title: "Danh sách linh kiện chờ xếp khay",
    description: "Danh sách linh kiện chờ xếp khay để chọn box Putaway.",
  },
  "PTW-01": {
    title: "Putaway linh kiện vào khay",
    description: "Màn Putaway linh kiện vào khay.",
  },
  "OUT-REQ-01": {
    title: "Tiếp nhận Phiếu yêu cầu xuất",
    description: "Tiếp nhận phiếu yêu cầu xuất, có import file Excel.",
  },
  "OUT-01": {
    title: "Danh sách phiếu xuất",
    description: "Danh sách phiếu xuất.",
  },
  "OUT-03": {
    title: "Chi tiết phiếu xuất",
    description: "Màn chi tiết phiếu xuất khi bấm Mở / Xem.",
  },
  "OUT-02": { title: "Quét & match Item", description: "Quét và match Item." },
  "LBL-01": { title: "Nhãn từng Item", description: "In nhãn từng Item." },
  "RFID-01": {
    title: "Map RFID & Full Post Issue",
    description: "Map RFID và Full Post Issue.",
  },
  "WAR-01": { title: "Danh sách bảo hành", description: "Danh sách bảo hành." },
  "WAR-02": { title: "Tiếp nhận bảo hành", description: "Tiếp nhận bảo hành." },
  "WAR-03": { title: "Chi tiết bảo hành", description: "Chi tiết bảo hành." },
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
    title: "Danh sách phiếu Reversal",
    description: "Danh sách phiếu để chọn tạo Reversal.",
  },
  "REV-01": { title: "Tạo Reversal", description: "Tạo Reversal." },
  "RPT-01": {
    title: "Báo cáo vận hành",
    description: "Demo thay đổi nội dung khi chọn các loại báo cáo.",
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
  [ROUTES.IAM_ROLES]: {
    title: "Vai trò & phân quyền",
    description:
      "Quản trị role template và permission theo contract IAM hiện hành.",
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
    title: "Component catalog",
    description: "Danh mục component dùng nội bộ cho FE.",
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
    case "IAM-01":
      return <IamUserScreen openCreateOnMount={requestedScreen === "IAM-02"} />;
    case "MST-01":
      return (
        <SkuMasterScreen openCreateOnMount={requestedScreen === "MST-02"} />
      );
    case "AGY-01":
      return (
        <AgencyMasterScreen openCreateOnMount={requestedScreen === "AGY-02"} />
      );
    case "DEF-01":
      return (
        <DefectMasterScreen openCreateOnMount={requestedScreen === "DEF-02"} />
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
      // WarrantyPage tự đọc ?screen=WAR-02/WAR-03/COMP-01 để mở modal tương ứng.
      return (
        <div className="hn-mvp-source-screen">
          <WarrantyPage />
        </div>
      );
    case "INV-01":
      // InventoryPage tự đọc ?screen=TRACE-01 để mở modal truy vết.
      return (
        <div className="hn-mvp-source-screen">
          <InventoryPage />
        </div>
      );
    case "REV-00":
      // ReversalPage tự đọc ?screen=REV-01 để mở modal tạo reversal.
      return (
        <div className="hn-mvp-source-screen">
          <ReversalPage />
        </div>
      );
    default:
      return <MvpSourceScreen screenId={sourceScreen} />;
  }
}

/** Exact DOM shell of HN_WMS_Wireframe_MVP.html with selected edit flows folded into modals. */
export function MainLayout() {
  const location = useLocation();
  const isProfileLoaded = useAuthStore((state) => state.isProfileLoaded);
  const { isLoading: isLoadingProfile } = useMe();
  const requestedScreen = new URLSearchParams(location.search).get("screen");
  const normalizedScreen = normalizeScreen(requestedScreen);
  const sourceScreen =
    normalizedScreen && MVP_SCREEN_META[normalizedScreen]
      ? normalizedScreen
      : null;
  const meta = resolveScreenMeta(location.pathname, location.search);

  if (isLoadingProfile && !isProfileLoaded) return <Loading />;

  return (
    <div className="hn-mvp-app">
      <aside className="hn-mvp-aside">
        <SideNav />
      </aside>
      <main className="hn-mvp-main">
        <header className="hn-mvp-header">
          <div className="hn-mvp-title">
            <h2>{meta.title}</h2>
            <p>{meta.description}</p>
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
