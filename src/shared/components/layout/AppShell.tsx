import type { CSSProperties, ReactNode } from "react";
import { Layout } from "antd";

export interface AppShellProps {
  /** Left navigation area, usually an Ant Design Sider or mobile Drawer pair. */
  sider?: ReactNode;
  /** Top application bar. */
  header?: ReactNode;
  /** Breadcrumb or route context area above the page body. */
  breadcrumb?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Apply responsive padding for the outer content area. */
  responsivePadding?: boolean;
  /** Style for the root Layout. */
  rootStyle?: CSSProperties;
  /** Style for the inner Layout, for example fixed-sider offset. */
  mainStyle?: CSSProperties;
  /** Style for the outer Content area. */
  contentStyle?: CSSProperties;
  /** Optional framed page body style. When omitted, children render directly. */
  bodyStyle?: CSSProperties;
}

/**
 * Reusable app frame for authenticated screens.
 * It stays presentation-only: callers own RBAC, profile loading, responsive
 * state, route composition, and business data.
 */
export function AppShell({
  sider,
  header,
  breadcrumb,
  footer,
  children,
  responsivePadding = true,
  rootStyle,
  mainStyle,
  contentStyle,
  bodyStyle,
}: AppShellProps) {
  const defaultContentStyle: CSSProperties = {
    padding: responsivePadding ? "clamp(12px, 2vw, 24px)" : 24,
    minHeight: "calc(100vh - 64px)",
  };

  return (
    <Layout style={{ minHeight: "100vh", ...rootStyle }}>
      {sider}
      <Layout
        style={{ transition: "margin-inline-start 0.2s ease", ...mainStyle }}
      >
        {header}
        <Layout.Content style={{ ...defaultContentStyle, ...contentStyle }}>
          {breadcrumb}
          {bodyStyle ? <div style={bodyStyle}>{children}</div> : children}
        </Layout.Content>
        {footer}
      </Layout>
    </Layout>
  );
}
