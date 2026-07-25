import type { ReactNode } from 'react';
import { Layout } from 'antd';

export interface AppShellProps {
  /** Thanh điều hướng bên trái (thường là <Sidebar>). */
  sider?: ReactNode;
  /** Thanh trên cùng (thường là <Header>). */
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Có apply responsive padding cho content không (mặc định true). */
  responsivePadding?: boolean;
}

/**
 * Khung bố cục tổng (sider + header + content + footer).
 * Component trình bày thuần — app dùng `app/layouts/MainLayout` để gắn state
 * (collapse, responsive, hồ sơ); AppShell có thể tái dùng cho layout phụ khác.
 */
export function AppShell({
  sider,
  header,
  footer,
  children,
  responsivePadding = true,
}: AppShellProps) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {sider}
      <Layout
        style={{
          transition: 'margin-inline-start 0.2s ease',
        }}
      >
        {header}
        <Layout.Content
          style={{
            padding: responsivePadding ? 'clamp(12px, 2vw, 24px)' : 24,
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          {children}
        </Layout.Content>
        {footer}
      </Layout>
    </Layout>
  );
}
