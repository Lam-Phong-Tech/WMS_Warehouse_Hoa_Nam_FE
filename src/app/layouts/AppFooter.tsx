import { Layout, Typography } from "antd";
import { layoutStyles } from "@/app/layouts/layout.styles";

const { Footer } = Layout;

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <Footer style={layoutStyles.footer}>
      <Typography.Text type="secondary">
        Hoa Nam ©{year} — Phát triển bởi Lam Phong Tech
      </Typography.Text>
    </Footer>
  );
}
