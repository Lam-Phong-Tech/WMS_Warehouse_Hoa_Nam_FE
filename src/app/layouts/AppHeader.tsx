import { Button, Layout, Space, theme, Tooltip } from "antd";
import {
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { ContextSwitcher } from "@/modules/auth/components/ContextSwitcher";
import { UserMenu } from "@/app/layouts/UserMenu";
import { layoutStyles } from "@/app/layouts/layout.styles";

const { Header } = Layout;

interface Props {
  isMobile: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

/** Admin header: sidebar toggle, context switcher, notification placeholder and user menu. */
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
      <Button
        type="text"
        aria-label={
          isMobile
            ? drawerAriaLabel
            : collapsed
              ? "Mở rộng menu điều hướng"
              : "Thu gọn menu điều hướng"
        }
        icon={
          isMobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
        }
        onClick={onToggle}
        style={layoutStyles.headerToggleButton}
      />

      <Space size="middle" wrap={false}>
        <ContextSwitcher />

        <Tooltip title="Thông báo sắp ra mắt. Chưa có endpoint backend được duyệt.">
          <Button
            type="text"
            disabled
            aria-label="Thông báo sắp ra mắt, chưa khả dụng"
            icon={<BellOutlined />}
            style={layoutStyles.headerToggleButton}
          />
        </Tooltip>

        <UserMenu compact={isMobile} />
      </Space>
    </Header>
  );
}
