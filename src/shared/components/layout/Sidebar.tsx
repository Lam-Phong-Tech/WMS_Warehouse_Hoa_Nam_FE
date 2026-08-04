import type { ReactNode } from "react";
import { Layout } from "antd";

const { Sider } = Layout;

export interface SidebarProps {
  collapsed?: boolean;
  width?: number;
  collapsedWidth?: number;
  children: ReactNode;
}

/** Thanh điều hướng trái (wrapper antd Sider) — đặt menu/logo bên trong. */
export function Sidebar({
  collapsed,
  width = 220,
  collapsedWidth = 64,
  children,
}: SidebarProps) {
  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={width}
      collapsedWidth={collapsedWidth}
    >
      {children}
    </Sider>
  );
}
