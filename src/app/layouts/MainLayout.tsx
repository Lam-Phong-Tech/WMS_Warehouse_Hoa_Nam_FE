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
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SideNav } from "@/app/layouts/SideNav";
import { AppTopbar } from "@/app/layouts/topbar/AppTopbar";
import { getBreadcrumbTrail } from "@/app/layouts/nav-data";
import { useMe } from "@/modules/auth/hooks/use-me";
import { useNotificationSocket } from "@/modules/notifications/hooks/useNotificationSocket";
import { Loading } from "@/shared/components";
import {
  Box,
  Drawer,
  LAYOUT,
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

const SIDEBAR_COLLAPSED_STORAGE_KEY = "hn-wms-sidebar-collapsed";

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
  // <lg (980): sidebar chuyển sang Drawer overlay + hamburger ở topbar
  // (hợp đồng responsive 360/768/1280 của SRS — không bóp 2 cột trên mobile).
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
  /**
   * Dashboard tự dựng nguyên khối theo demo UI/UX (page-wrap + breadcrumb riêng,
   * padding 20/24/48 của demo). Bọc thêm padding và breadcrumb của shell sẽ làm
   * lệch số đo demo và hiện breadcrumb hai lần — nên trang này chạy full-bleed.
   */
  const isDashboard = location.pathname === ROUTES.DASHBOARD;
  const trail = getBreadcrumbTrail(location.pathname);
  const navLabel = useNavLabel();

  if (isLoadingProfile && !isProfileLoaded) return <Loading />;

  return (
    <>
      <UiAppShell
        collapsed={sidebarCollapsed}
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
          <UiFooter>
            Hoa Nam ©{new Date().getFullYear()} — Phát triển bởi Lam Phong Tech
            ·{" "}
            <a
              href="https://www.flaticon.com/uicons"
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit" }}
            >
              Icons by Flaticon
            </a>
          </UiFooter>
        }
      >
        <Box
          sx={
            isDashboard
              ? { display: "grid" }
              : { padding: `${SPACING.xl}px`, display: "grid", gap: 2 }
          }
        >
          {isDashboard ? null : (
            <UiBreadcrumb
              items={trail.map((entry) => ({
                label: entry.i18nKey
                  ? navLabel(entry.i18nKey, entry.label)
                  : entry.label,
                onClick: entry.path ? () => navigate(entry.path!) : undefined,
              }))}
            />
          )}
          {/*
           * key theo pathname + ?screen= → remount chạy lại hiệu ứng chuyển màn
           * (hn-page-transition). KHÔNG đưa cả search vào key: 7 trang giữ bộ
           * lọc/phân trang trên query — remount theo search sẽ mất state.
           */}
          <Box
            component="section"
            key={`${location.pathname}|${requestedScreen ?? ""}`}
            className="hn-mvp-screen hn-page-transition"
            sx={{ minWidth: 0 }}
          >
            <Outlet />
          </Box>
        </Box>
      </UiAppShell>
      {!isDesktop ? (
        <Drawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          slotProps={{
            paper: { sx: { width: LAYOUT.sidebarWidth, maxWidth: "85vw" } },
          }}
        >
          <SideNav collapsed={false} />
        </Drawer>
      ) : null}
    </>
  );
}
