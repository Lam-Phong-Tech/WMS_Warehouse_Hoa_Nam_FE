import { Button, Layout, Space, theme, Tooltip } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { ContextSwitcher } from '@/modules/auth/components/ContextSwitcher';
import { UserMenu } from '@/app/layouts/UserMenu';
import { layoutStyles } from '@/app/layouts/layout.styles';

const { Header } = Layout;

interface Props {
  isMobile: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

/** Thanh header admin: nút thu gọn sidebar + ContextSwitcher + thông báo + UserMenu. */
export function AppHeader({ isMobile, collapsed, onToggle }: Props) {
  const {
    token: { colorBorderSecondary },
  } = theme.useToken();

  const drawerAriaLabel = 'Mở/đóng menu điều hướng';

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
              ? 'Mở rộng menu điều hướng'
              : 'Thu gọn menu điều hướng'
        }
        icon={
          isMobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
        }
        onClick={onToggle}
        style={layoutStyles.headerToggleButton}
      />

      <Space size="middle" wrap={false}>
        <ContextSwitcher />

        {/*
          P2: Bell chưa có endpoint backend (BE /api/documentation hiện không
          có route notification nào) — disable + tooltip nói rõ "sắp ra mắt"
          thay vì để nút trông bấm được nhưng không có hành vi nghiệp vụ.
          Khi BE có API, bỏ `disabled` và nối vào danh sách thông báo thật.
        */}
        <Tooltip>
          <Button
            type="text"
            disabled
            aria-label="Thông báo (sắp ra mắt, chưa khả dụng)"
            icon={<BellOutlined />}
            style={layoutStyles.headerToggleButton}
          />
        </Tooltip>

        <UserMenu compact={isMobile} />
      </Space>
    </Header>
  );
}
