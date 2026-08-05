import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Drawer, Grid, Layout, theme } from "antd";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMe } from "@/modules/auth/hooks/use-me";
import { SideNav } from "@/app/layouts/SideNav";
import { AppHeader } from "@/app/layouts/AppHeader";
import { AppBreadcrumb } from "@/app/layouts/AppBreadcrumb";
import { AppFooter } from "@/app/layouts/AppFooter";
import { AppShell, Loading } from "@/shared/components";
import { preloadManager } from "@/shared/utils/preload-manager";
import { layoutStyles } from "@/app/layouts/layout.styles";

const { Sider } = Layout;
const SIDER_WIDTH = 280;
const SIDER_COLLAPSED_WIDTH = 80;

/**
 * Khung admin: lắp ráp Sidebar + Header + Breadcrumb + nội dung (Outlet) + Footer.
 * Phần hiển thị tách thành component riêng; ở đây chỉ điều phối state + responsive.
 */
export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;

  const isProfileLoaded = useAuthStore((s) => s.isProfileLoaded);
  const { isLoading: isLoadingProfile } = useMe();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    if (isProfileLoaded && !isLoadingProfile) {
      const timer = setTimeout(() => {
        preloadManager.preloadCriticalRoutes();
      }, 1000);

      preloadManager.preloadSecondaryRoutesOnIdle();

      return () => clearTimeout(timer);
    }
  }, [isProfileLoaded, isLoadingProfile]);

  const toggleSidebar = () =>
    isMobile
      ? setDrawerOpen((value) => !value)
      : setCollapsed((value) => !value);

  if (isLoadingProfile && !isProfileLoaded) {
    return <Loading />;
  }

  const sider = (
    <>
      {!isMobile ? (
        <Sider
          data-testid="desktop-navigation"
          aria-label="Menu điều hướng desktop"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={SIDER_WIDTH}
          collapsedWidth={SIDER_COLLAPSED_WIDTH}
          style={{
            ...layoutStyles.siderFixed,
            transition: "width 0.2s ease",
          }}
        >
          <SideNav collapsed={collapsed} />
        </Sider>
      ) : null}

      <Drawer
        placement="left"
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        closable={false}
        size={SIDER_WIDTH}
        autoFocus
        aria-label="Menu điều hướng"
        {...{ role: "navigation" }}
        styles={{
          body: layoutStyles.drawerBody,
          mask: layoutStyles.siderDrawerMask,
        }}
      >
        <SideNav onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </>
  );

  return (
    <AppShell
      sider={sider}
      header={
        <AppHeader
          isMobile={isMobile}
          collapsed={collapsed}
          onToggle={toggleSidebar}
        />
      }
      breadcrumb={<AppBreadcrumb />}
      footer={<AppFooter />}
      responsivePadding={false}
      rootStyle={layoutStyles.mainLayoutRoot}
      mainStyle={
        !isMobile
          ? layoutStyles.siderOffset(
              collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH,
            )
          : undefined
      }
      contentStyle={layoutStyles.contentMargin(isMobile)}
      bodyStyle={{
        ...layoutStyles.contentBody(colorBgContainer, borderRadiusLG),
        animation: "fadeIn 0.3s ease",
      }}
    >
      <Outlet />
    </AppShell>
  );
}
