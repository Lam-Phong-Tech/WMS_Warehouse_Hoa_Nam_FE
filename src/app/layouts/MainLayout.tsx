/**
 * MainLayout — shell vận hành trên UiAppShell (Part 4 shell swap).
 *
 * SEC-RBAC-01 ĐÓNG TẠI ĐÂY: layout LUÔN render <Outlet/> — không còn
 * renderMvpScreen theo ?screen= (cơ chế cũ mount màn nghiệp vụ NGOÀI
 * RequirePermission của route đích). ?screen= chỉ còn 2 vai trò hợp lệ:
 * (1) tiêu đề header (resolveScreenMeta), (2) deep-link do CHÍNH page đích
 * xử lý sau khi đã qua guard (WAR-02, IN-02, MST-02…).
 *
 * Các class `hn-mvp-app/aside/main/screen` giữ làm test-hook (E2E wwhn-144) —
 * style nằm hoàn toàn trong UiAppShell/sx token.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { KeepAliveOutlet } from "@/app/layouts/KeepAliveOutlet";
import { SideNav } from "@/app/layouts/SideNav";
import { AppTopbar } from "@/app/layouts/topbar/AppTopbar";
import { getBreadcrumbTrail } from "@/app/layouts/nav-data";
import { AppPageHeader } from "@/app/layouts/AppPageHeader";
import { WarehousePausedBanner } from "@/app/layouts/WarehousePausedBanner";
import { useMe } from "@/modules/auth/hooks/use-me";
import { useNotificationSocket } from "@/modules/notifications/hooks/useNotificationSocket";
import { Loading } from "@/shared/components";
import {
  AUTH_BASELINE,
  Box,
  Drawer,
  SPACING,
  UiAppShell,
  useMediaQuery,
  UiBreadcrumb,
  UiFooter,
} from "@/shared/ui";
import { useAuthStore } from "@/shared/store/auth.store";
import { useNavLabel } from "@/shared/i18n/nav-labels";
import { ROUTES } from "@/shared/constants/routes";
import { useNavigate } from "react-router-dom";
import { queryClient } from "@/app/providers/query-client";
import { preloadCommonRoutesWhenIdle } from "@/app/router/route-preload";
import { tStatic as tUi } from "@/shared/i18n/useT";

/**
 * Màn TỰ dựng header riêng nên shell không render `AppPageHeader` — nếu không
 * sẽ có hai tiêu đề chồng nhau. Tất cả đều là bản port 1:1 từ mockup đã chốt
 * (Tổng quan vận hành + TRỌN BỘ 8 màn Báo cáo), header của chúng mang thêm
 * eyebrow "BÁO CÁO VẬN HÀNH · RPT-xx", chip và nút riêng.
 *
 * DANH SÁCH NÀY PHẢI ĐỦ CẢ 8 ROUTE `/reports/*` — liệt kê đúng thứ tự sidebar
 * để soát cho dễ. Thiếu route nào thì chính route đó hiện HAI tiêu đề chồng
 * nhau (đã xảy ra với RPT-04 và RPT-06).
 */
const ROUTES_WITH_OWN_HEADER: string[] = [
  ROUTES.PV_PRODUCT_CATALOG,
  ROUTES.DASHBOARD,
  ROUTES.REPORTS_INVENTORY_FLOW,
  ROUTES.REPORTS_OUTBOUND_FLOW,
  ROUTES.REPORTS_STOCK_RECONCILE,
  ROUTES.REPORTS_TRACEABILITY,
  ROUTES.REPORTS_IMPORT_QUALITY,
  ROUTES.REPORTS_PACKING_LABEL,
  ROUTES.REPORTS_WARRANTY,
  ROUTES.REPORTS_RECIPIENT,
  ROUTES.REPORTS_PENDING_EVIDENCE,
];

/**
 * Màn dựng NGUYÊN KHỐI theo mockup: tự có `page-wrap` (padding 20/24/48) và
 * breadcrumb riêng. Bọc thêm padding + breadcrumb của shell sẽ làm lệch số đo
 * mockup và hiện breadcrumb hai lần — nên các trang này chạy full-bleed.
 */
const ROUTES_FULL_BLEED: string[] = [
  ROUTES.DASHBOARD,
  ROUTES.REPORTS_STOCK_RECONCILE,
  ROUTES.REPORTS_INVENTORY_FLOW,
  ROUTES.REPORTS_OUTBOUND_FLOW,
  ROUTES.REPORTS_TRACEABILITY,
  ROUTES.REPORTS_PENDING_EVIDENCE,
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "hn-wms-sidebar-collapsed";
const SYSTEM_SIDEBAR_WIDTH = 300;

function readStoredSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  // Shell geometry is shared by every route; navigation must not resize it.
  // Below lg (980px), use the same overlay drawer on every screen.
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("lg"));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isProfileLoaded = useAuthStore((state) => state.isProfileLoaded);
  const { isLoading: isLoadingProfile } = useMe();
  useNotificationSocket();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    readStoredSidebarCollapsed,
  );
  // PEEK: đang thu gọn mà rê chuột/focus vào rail thì sidebar bung TẠM (không
  // ghi nhớ, không xô nội dung). Trạng thái "ghim" vẫn là sidebarCollapsed.
  const [sidebarPeek, setSidebarPeek] = useState(false);
  // Đổi trang trên mobile → tự đóng drawer điều hướng.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  // Sau khi shell đã lên và app rảnh: nạp dần chunk của các màn hay dùng, để lần
  // đầu bấm sang màn khác không phải nhìn skeleton chờ tải mã (xem route-preload.ts).
  useEffect(() => {
    return preloadCommonRoutesWhenIdle(
      () => queryClient.isFetching() > 0 || queryClient.isMutating() > 0,
    );
  }, []);

  // Màn ĐẦU TIÊN sau khi tải trang không chạy hiệu ứng chuyển trang: `main.tsx`
  // đặt `data-hn-first-load` trên <html>, `hn-motion.css` tắt animation khi còn
  // thuộc tính đó. Gỡ ngay sau khung hình đầu của shell, nên mọi lần điều hướng
  // SAU vẫn có hiệu ứng như cũ. Lý do: lúc F5 không có trang cũ nào để chuyển đi,
  // mà hiệu ứng thì bắt người dùng chờ thêm gần 0,3 giây sau khi đã có dữ liệu.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.removeAttribute("data-hn-first-load");
      });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const persistSidebarCollapsed = (next: boolean) => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // localStorage không khả dụng (ẩn danh) — giữ state trong phiên.
    }
  };
  const setCollapsed = (next: boolean) => {
    setSidebarPeek(false);
    setSidebarCollapsed(next);
    persistSidebarCollapsed(next);
  };
  /**
   * Nút tròn trong khối brand. Đang "he mở" mà bấm ⇒ GHIM MỞ luôn (đúng demo:
   * `setPersistentCollapsed(peeking ? false : !persistentlyCollapsed)`).
   */
  const toggleSidebar = () => {
    setCollapsed(sidebarPeek ? false : !sidebarCollapsed);
  };
  /** Bấm logo ở rail (hoặc bấm icon nhóm) ⇒ ghim mở lại. */
  const expandSidebar = () => setCollapsed(false);

  const requestedScreen = new URLSearchParams(location.search).get("screen");
  // MAP-01 vẫn là marker riêng cho phần BODY của Tổng quan; riêng shell
  // (sidebar + topbar) dùng SystemHNWeb trên MỌI route để điều hướng không đổi skin.
  const isMapReferenceScreen = location.pathname === ROUTES.DASHBOARD;
  const systemShellStyle = {
    // Light mode phải giữ đúng palette SystemHNWeb đã chốt (ảnh/reference MAP-01).
    // Dark/System vẫn đổi thật nhờ light-dark() + color-scheme trên <html>.
    "--map-navy": AUTH_BASELINE.navy,
    "--map-cta": AUTH_BASELINE.cta,
    "--map-accent": "var(--ops-primary)",
    "--map-heading": "var(--ops-heading)",
    "--map-link": "var(--ops-link)",
    "--map-card": "var(--ops-surface)",
    "--map-pale": "var(--ops-pale)",
    "--map-line": "var(--ops-line)",
    "--map-ink": "var(--ops-text)",
    "--map-muted": "var(--ops-muted)",
    "--map-surface": "var(--ops-canvas)",
    "--map-success": "var(--ops-success)",
    "--map-warning": "var(--ops-warning)",
    "--map-danger": "var(--ops-danger)",
    "--map-white": AUTH_BASELINE.white,
    "--map-hero-mid": AUTH_BASELINE.heroMid,
    "--map-hero-end": AUTH_BASELINE.heroEnd,
    "--map-focus-ring": "var(--ops-focus-ring)",
    "--map-card-shadow": "var(--ops-shadow-card)",
  } as CSSProperties;
  const isFullBleed = ROUTES_FULL_BLEED.includes(location.pathname);
  const ownsHeader = ROUTES_WITH_OWN_HEADER.includes(location.pathname);
  const trail = getBreadcrumbTrail(location.pathname);
  const navLabel = useNavLabel();

  if (isLoadingProfile && !isProfileLoaded) return <Loading />;

  return (
    <>
      <UiAppShell
        className={
          isMapReferenceScreen
            ? "hn-system-shell hn-map-shell"
            : "hn-system-shell"
        }
        style={systemShellStyle}
        sidebarClassName="hn-system-sidebar"
        mainClassName={isMapReferenceScreen ? "hn-map-main" : undefined}
        collapsed={sidebarCollapsed}
        sidebarWidth={SYSTEM_SIDEBAR_WIDTH}
        sidebarHidden={!isDesktop}
        peek={sidebarPeek}
        onPeekChange={setSidebarPeek}
        sidebar={
          <SideNav
            // Lúc "he mở", nội dung sidebar hiển thị y như khi đang mở rộng.
            collapsed={sidebarCollapsed && !sidebarPeek}
            onExpand={expandSidebar}
            onToggle={toggleSidebar}
          />
        }
        topbar={
          <AppTopbar
            showMenuButton={!isDesktop}
            onOpenMenu={() => setMobileNavOpen(true)}
          />
        }
        footer={
          /*
           * Không còn dòng ghi công "Icons by Flaticon" ở đây: UAT TC_UI_01
           * (09/2026) báo người dùng kho không hiểu dòng chữ tiếng Anh này là gì.
           * Bộ icon vẫn là Flaticon Uicons (xem src/styles/hn-icon-font.css) —
           * điều khoản ghi công của gói cần được xác nhận lại ở cấp dự án.
           */
          <UiFooter>
            Hoa Nam ©{new Date().getFullYear()}
            {" " + tUi("updatedUi.text_f23d4edc7b6e")}
          </UiFooter>
        }
      >
        <Box
          sx={
            isFullBleed
              ? { display: "grid" }
              : { padding: `${SPACING.xl}px`, display: "grid", gap: 2 }
          }
        >
          {isFullBleed ? null : (
            <UiBreadcrumb
              items={trail.map((entry) => ({
                label: navLabel(entry.i18nKey, entry.label),
                onClick: entry.path ? () => navigate(entry.path!) : undefined,
              }))}
            />
          )}
          {/*
           * Đặt TRÊN header trang: kho tạm dừng là trạng thái toàn hệ thống (BE đóng
           * băng mọi thao tác ghi), nên phải thấy được ở MỌI màn — không riêng màn
           * Cấu hình kho, vì chỗ người dùng gặp lỗi 409 lại là màn nhập/xuất/bảo hành.
           */}
          <WarehousePausedBanner />
          {ownsHeader ? null : <AppPageHeader />}
          {/*
           * Trang KHÔNG keep-alive: key theo pathname + ?screen= → remount chạy lại
           * hiệu ứng chuyển màn (hn-page-transition). KHÔNG đưa cả search vào key:
           * 7 trang giữ bộ lọc/phân trang trên query — remount theo search sẽ mất
           * state. Nhóm báo cáo đi qua keep-alive (xem KeepAliveOutlet): màn đã mở
           * được giữ ẩn, quay lại là hiện ngay; display:none→block tự chạy lại
           * animation chuyển màn nên không mất hiệu ứng.
           */}
          <KeepAliveOutlet
            transitionKey={`${location.pathname}|${requestedScreen ?? ""}`}
            className="hn-mvp-screen hn-page-transition"
          />
        </Box>
      </UiAppShell>
      {!isDesktop ? (
        <Drawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          slotProps={{
            paper: {
              className: "hn-system-drawer",
              style: systemShellStyle,
              sx: {
                width: `min(${SYSTEM_SIDEBAR_WIDTH}px, calc(100vw - 40px))`,
                maxWidth: "88vw",
                height: "100dvh",
                overflow: "hidden",
                color: "var(--map-white)",
                backgroundColor: "var(--map-navy)",
                backgroundImage:
                  'linear-gradient(180deg, color-mix(in srgb, var(--map-navy) 74%, transparent) 0%, color-mix(in srgb, var(--map-navy) 62%, transparent) 48%, color-mix(in srgb, var(--map-navy) 56%, transparent) 100%), url("/assets/systemhn/sidebar-warehouse-generated-fixed.webp")',
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center top",
                backgroundSize: "cover",
                boxShadow:
                  "4px 0 18px color-mix(in srgb, var(--map-navy) 22%, transparent)",
              },
            },
          }}
        >
          <SideNav collapsed={false} />
        </Drawer>
      ) : null}
    </>
  );
}
