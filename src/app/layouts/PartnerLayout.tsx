import { Outlet } from "react-router-dom";
import { Layout, theme } from "antd";

const { Header, Content, Footer } = Layout;

/**
 * Khung partner: Layout khung dành cho Cổng đối tác.
 */
export function PartnerLayout() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: colorBgContainer,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18 }}>Partner Portal</h1>
      </Header>

      <Content style={{ margin: 24 }}>
        <div
          style={{
            padding: 24,
            minHeight: "calc(100vh - 64px - 48px)",
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </div>
      </Content>

      <Footer style={{ textAlign: "center" }}>
        ERP System ©{new Date().getFullYear()} Partner Portal
      </Footer>
    </Layout>
  );
}
