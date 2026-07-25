import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Drawer, Grid, Layout, theme } from 'antd';
import { useAuthStore } from '@/shared/store/auth.store';
import { useMe } from '@/modules/auth/hooks/use-me';
import { SideNav } from '@/app/layouts/SideNav';
import { AppHeader } from '@/app/layouts/AppHeader';
import { AppBreadcrumb } from '@/app/layouts/AppBreadcrumb';
import { AppFooter } from '@/app/layouts/AppFooter';
import { Loading } from '@/shared/components';
import { preloadManager } from '@/shared/utils/preload-manager';
import { layoutStyles } from '@/app/layouts/layout.styles';

const { Sider, Content } = Layout;
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

  // Preload critical routes khi app đã load xong profile
  useEffect(() => {
    if (isProfileLoaded && !isLoadingProfile) {
      // Preload critical routes sau 1-2s để không block initial load
      const timer = setTimeout(() => {
        preloadManager.preloadCriticalRoutes();
      }, 1000);

      // Preload secondary routes khi browser idle
      preloadManager.preloadSecondaryRoutesOnIdle();

      return () => clearTimeout(timer);
    }
  }, [isProfileLoaded, isLoadingProfile]);

  const toggleSidebar = () =>
    isMobile ? setDrawerOpen((v) => !v) : setCollapsed((v) => !v);

  // Chờ nạp hồ sơ + quyền lần đầu (sau login / F5) để menu hiển thị đúng quyền.
  if (isLoadingProfile && !isProfileLoaded) {
    return <Loading />;
  }

  return (
    <Layout style={layoutStyles.mainLayoutRoot}>
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={SIDER_WIDTH}
          collapsedWidth={SIDER_COLLAPSED_WIDTH}
          style={{
            ...layoutStyles.siderFixed,
            transition: 'width 0.2s ease',
          }}
        >
          <SideNav collapsed={collapsed} />
        </Sider>
      )}

      <Drawer
        placement="left"
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        closable={false}
        size={SIDER_WIDTH}
        autoFocus
        aria-label="Menu điều hướng"
        {...{ role: 'navigation' }}
        styles={{
          body: layoutStyles.drawerBody,
          mask: layoutStyles.siderDrawerMask,
        }}
      >
        <SideNav onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <Layout
        style={
          !isMobile
            ? layoutStyles.siderOffset(
                collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH,
              )
            : undefined
        }
      >
        <AppHeader
          isMobile={isMobile}
          collapsed={collapsed}
          onToggle={toggleSidebar}
        />

        <Content style={layoutStyles.contentMargin(isMobile)}>
          <AppBreadcrumb />

          <div
            style={{
              ...layoutStyles.contentBody(colorBgContainer, borderRadiusLG),
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <Outlet />
          </div>
        </Content>

        <AppFooter />
      </Layout>
    </Layout>
  );
}
