import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMe } from "@/modules/auth/hooks/use-me";
import { SideNav } from "@/app/layouts/SideNav";
import { Loading } from "@/shared/components";
import { preloadManager } from "@/shared/utils/preload-manager";
import { ROUTES } from "@/shared/constants/routes";

type ScreenMeta = {
  title: string;
  description: string;
};

const MVP_SCREEN_META: Record<string, ScreenMeta> = {
  "MAP-01": { title: "Bản đồ màn hình & phạm vi", description: "Tổng quan phạm vi wireframe MVP, không bao gồm App PV." },
  "IAM-01": { title: "Danh sách người dùng & phân quyền", description: "Danh sách người dùng, vai trò, phạm vi dữ liệu và trạng thái." },
  "IAM-02": { title: "Thêm / sửa người dùng", description: "Form thêm / sửa người dùng." },
  "MST-01": { title: "Danh sách SKU / Product Master", description: "Danh sách SKU, chỉ cần action Sửa." },
  "MST-02": { title: "Tạo / sửa SKU", description: "Form tạo / sửa SKU." },
  "AGY-01": { title: "Danh mục đại lý / nơi nhận", description: "Danh mục đại lý / nơi nhận hàng." },
  "AGY-02": { title: "Thêm / sửa đại lý", description: "Form thêm / sửa đại lý." },
  "DEF-01": { title: "Danh mục bệnh / lỗi", description: "Danh mục bệnh / lỗi dùng cho bảo hành." },
  "DEF-02": { title: "Thêm / sửa bệnh / lỗi", description: "Form thêm / sửa bệnh / lỗi." },
  "IN-01": { title: "Danh sách phiếu nhập", description: "Danh sách phiếu nhập." },
  "IN-02": { title: "Tạo / sửa phiếu nhập DRAFT", description: "Tạo / sửa phiếu nhập DRAFT." },
  "IN-03": { title: "Quét & Full Post Receipt", description: "Quét hàng và Full Post Receipt." },
  "PTW-00": { title: "Danh sách linh kiện chờ xếp khay", description: "Danh sách linh kiện chờ xếp khay để chọn box Putaway." },
  "PTW-01": { title: "Putaway linh kiện vào khay", description: "Màn Putaway linh kiện vào khay." },
  "OUT-REQ-01": { title: "Tiếp nhận Phiếu yêu cầu xuất", description: "Tiếp nhận phiếu yêu cầu xuất, có import file Excel." },
  "OUT-01": { title: "Danh sách phiếu xuất", description: "Danh sách phiếu xuất." },
  "OUT-03": { title: "Chi tiết phiếu xuất", description: "Màn chi tiết phiếu xuất khi bấm Mở / Xem." },
  "OUT-02": { title: "Quét & match Item", description: "Quét và match Item." },
  "LBL-01": { title: "Nhãn từng Item", description: "In nhãn từng Item." },
  "RFID-01": { title: "Map RFID & Full Post Issue", description: "Map RFID và Full Post Issue." },
  "WAR-01": { title: "Danh sách bảo hành", description: "Danh sách bảo hành." },
  "WAR-02": { title: "Tiếp nhận bảo hành", description: "Tiếp nhận bảo hành." },
  "WAR-03": { title: "Chi tiết bảo hành", description: "Chi tiết bảo hành." },
  "COMP-01": { title: "Xuất linh kiện cho bảo hành", description: "Xuất linh kiện cho bảo hành." },
  "INV-01": { title: "Tra cứu tồn & đối soát", description: "Tra cứu tồn và đối soát." },
  "TRACE-01": { title: "Truy vết mã vật lý", description: "Truy vết mã vật lý." },
  "REV-00": { title: "Danh sách phiếu Reversal", description: "Danh sách phiếu để chọn tạo Reversal." },
  "REV-01": { title: "Tạo Reversal", description: "Tạo Reversal." },
  "RPT-01": { title: "Báo cáo vận hành", description: "Demo thay đổi nội dung khi chọn các loại báo cáo." },
};

const ROUTE_DEFAULT_SCREEN: Record<string, string> = {
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

const ROUTE_META: Record<string, ScreenMeta> = {
  [ROUTES.AUDIT_LOGS]: {
    title: "Nhật ký kiểm tra",
    description: "Theo dõi lịch sử thao tác và thay đổi trong hệ thống.",
  },
  [ROUTES.STOCKTAKE]: {
    title: "Kiểm kê",
    description: "Kiểm kê và kiểm soát chênh lệch tồn kho.",
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

function resolveScreenMeta(pathname: string, search: string): ScreenMeta {
  const requestedScreen = new URLSearchParams(search).get("screen");
  if (requestedScreen && MVP_SCREEN_META[requestedScreen]) {
    return MVP_SCREEN_META[requestedScreen];
  }

  const defaultScreen = ROUTE_DEFAULT_SCREEN[pathname];
  if (defaultScreen) return MVP_SCREEN_META[defaultScreen];

  const exact = ROUTE_META[pathname];
  if (exact) return exact;

  return {
    title: "Hoa Nam WMS",
    description: "Bám BRD / SRS-FRD / BPD hiện tại",
  };
}

/** Exact DOM shell of HN_WMS_Wireframe_MVP.html. */
export function MainLayout() {
  const location = useLocation();
  const isProfileLoaded = useAuthStore((state) => state.isProfileLoaded);
  const { isLoading: isLoadingProfile } = useMe();
  const meta = resolveScreenMeta(location.pathname, location.search);

  useEffect(() => {
    if (isProfileLoaded && !isLoadingProfile) {
      const timer = window.setTimeout(() => {
        preloadManager.preloadCriticalRoutes();
      }, 1000);
      preloadManager.preloadSecondaryRoutesOnIdle();
      return () => window.clearTimeout(timer);
    }
  }, [isProfileLoaded, isLoadingProfile]);

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
          <div className="hn-mvp-note-banner">
            Giao diện demo, dùng cho trao đổi BA/DEV/TEST.
          </div>
        </header>
        <section className="hn-mvp-screen">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
