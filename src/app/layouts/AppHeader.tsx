import { Button, Layout, Space, theme } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { ContextSwitcher } from "@/modules/auth/components/ContextSwitcher";
import { UserMenu } from "@/app/layouts/UserMenu";
import { NotificationBell } from "@/modules/notifications/components/NotificationBell";
import { layoutStyles } from "@/app/layouts/layout.styles";

const { Header } = Layout;

interface Props {
  isMobile: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

/** Header vận hành dùng cùng typography/palette với wireframe Hoa Nam WMS. */
export function AppHeader({ isMobile, collapsed, onToggle }: Props) {
  const {
    token: { colorBorderSecondary },
  } = theme.useToken();

  const drawerAriaLabel = "Mở/đóng menu điều hướng";

  return (
    <Header
      style={{
        ...layoutStyles.headerContainer,
        borderBottom: `1px solid ${colorBorderSecondary}`,
      }}
    >
      <Space size={10} wrap={false}>
        <Button
          data-testid="navigation-toggle"
          type="text"
          aria-label={
            isMobile
              ? drawerAriaLabel
              : collapsed
                ? "Mở rộng menu điều hướng"
                : "Thu gọn menu điều hướng"
          }
          icon={
            isMobile || collapsed ? (
              <MenuUnfoldOutlined />
            ) : (
              <MenuFoldOutlined />
            )
          }
          onClick={onToggle}
          style={layoutStyles.headerToggleButton}
        />
        {!isMobile && (
          <div
            aria-label="Hoa Nam Tools WMS"
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              whiteSpace: "nowrap",
              lineHeight: 1.2,
            }}
          >
            <strong style={{ color: "#2b2b2b", fontSize: 15, fontWeight: 800 }}>
              Hoa Nam Tools
            </strong>
            <span style={{ color: "#7a766c", fontSize: 12.5, fontWeight: 600 }}>
              WMS · Quản lý kho
            </span>
          </div>
        )}
      </Space>

      <Space size="middle" wrap={false}>
        <ContextSwitcher />

        <NotificationBell />

        <UserMenu compact={isMobile} />
      </Space>
    </Header>
  );
}
