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

const SCREEN_META: Record<string, ScreenMeta> = {
  [ROUTES.DASHBOARD]: {
    title: "Bản đồ màn hình & phạm vi",
    description: "Tổng quan phạm vi wireframe MVP, không bao gồm App PV.",
  },
  [ROUTES.MASTER_DATA]: {
    title: "Danh sách SKU / Product Master",
    description: "Danh sách SKU, chỉ cần action Sửa.",
  },
  [ROUTES.AUDIT_LOGS]: {
    title: "Nhật ký kiểm tra",
    description: "Theo dõi lịch sử thao tác và thay đổi trong hệ thống.",
  },
  [ROUTES.INBOUND]: {
    title: "Danh sách phiếu nhập",
    description: "Danh sách phiếu nhập.",
  },
  [ROUTES.PUTAWAY]: {
    title: "Putaway linh kiện vào khay",
    description: "Màn Putaway linh kiện vào khay.",
  },
  [ROUTES.OUTBOUND]: {
    title: "Danh sách phiếu xuất",
    description: "Danh sách phiếu xuất.",
  },
  [ROUTES.WARRANTY]: {
    title: "Danh sách bảo hành",
    description: "Danh sách bảo hành.",
  },
  [ROUTES.INVENTORY]: {
    title: "Tra cứu tồn & đối soát",
    description: "Tra cứu tồn và đối soát.",
  },
  [ROUTES.SCAN]: {
    title: "Truy vết mã vật lý",
    description: "Truy vết mã vật lý.",
  },
  [ROUTES.REVERSE]: {
    title: "Danh sách phiếu Reversal",
    description: "Danh sách phiếu để chọn tạo Reversal.",
  },
  [ROUTES.STOCKTAKE]: {
    title: "Kiểm kê",
    description: "Kiểm kê và kiểm soát chênh lệch tồn kho.",
  },
  [ROUTES.REPORTS]: {
    title: "Báo cáo vận hành",
    description: "Demo thay đổi nội dung khi chọn các loại báo cáo.",
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

function resolveScreenMeta(pathname: string): ScreenMeta {
  const exact = SCREEN_META[pathname];
  if (exact) return exact;

  const parent = Object.entries(SCREEN_META).find(
    ([path]) => path !== "/" && pathname.startsWith(`${path}/`),
  );
  if (parent) return parent[1];

  return {
    title: "Hoa Nam WMS",
    description: "Bám BRD / SRS-FRD / BPD hiện tại",
  };
}

/**
 * Production shell mirrors the DOM hierarchy of HN_WMS_Wireframe_MVP.html:
 * 300px dark aside + main header + one white screen panel.
 */
export function MainLayout() {
  const location = useLocation();
  const isProfileLoaded = useAuthStore((state) => state.isProfileLoaded);
  const { isLoading: isLoadingProfile } = useMe();
  const meta = resolveScreenMeta(location.pathname);

  useEffect(() => {
    if (isProfileLoaded && !isLoadingProfile) {
      const timer = window.setTimeout(() => {
        preloadManager.preloadCriticalRoutes();
      }, 1000);
      preloadManager.preloadSecondaryRoutesOnIdle();
      return () => window.clearTimeout(timer);
    }
  }, [isProfileLoaded, isLoadingProfile]);

  if (isLoadingProfile && !isProfileLoaded) {
    return <Loading />;
  }

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
