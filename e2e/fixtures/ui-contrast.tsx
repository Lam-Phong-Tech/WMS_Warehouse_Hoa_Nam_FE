import { createRoot } from "react-dom/client";
import { useState, type CSSProperties } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { SkuMasterScreen } from "@/modules/master-data/pages/MvpMasterScreens";
import { RowActionButton } from "@/shared/components/actions/RowActionButton";
import { UiDrawer } from "@/shared/ui/components/UiDialog";
import { AppTopbar } from "@/app/layouts/topbar/AppTopbar";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";
import "@/styles/hn-wms-page-normalize.css";
import "@/styles/hn-wms-source-screen.css";
import "@/shared/ui/operations-ui.css";

initializeTheme();
useAuthStore.setState({ isSuperAdmin: true, isProfileLoaded: true });
const topbarOnly = new URLSearchParams(location.search).has("topbar");
if (topbarOnly) {
  await import("@/app/layouts/system-shell.css");
  useAuthStore.setState({
    isAuthenticated: false,
    user: { name: "Nguyễn Khoa" } as never,
  });
}
const shellStyle = {
  "--map-card": "var(--ops-surface)",
  "--map-surface": "var(--ops-canvas)",
  "--map-heading": "var(--ops-heading)",
  "--map-pale": "var(--ops-pale)",
  "--map-line": "var(--ops-line)",
  "--map-link": "var(--ops-link)",
  "--map-white": "var(--ops-on-primary)",
} as CSSProperties;
const sku = {
  sku_id: "sku-contrast",
  sku_code: "SKU-DEMO-001",
  sku_name: "Sản phẩm kiểm tra độ tương phản",
  sku_type: "PRODUCT",
  unit: "cái",
  status: "ACTIVE",
  is_serial_tracked: true,
  min_stock: 2,
  max_stock: 10,
  published_to_app: false,
  version: 1,
};
// Keep the production screen/hooks/normalizers; only replace read-only transport.
http.getPage = async (url) => {
  const catalogues = [
    "/brands",
    "/product-categories",
    "/product-models",
    "/power-sources",
    "/package-variants",
  ];
  if (url !== "/products" && !catalogues.includes(url)) {
    throw new Error(`Unexpected contrast fixture request: ${url}`);
  }
  return {
    data: url === "/products" ? [sku] : [],
    meta: { total: url === "/products" ? 1 : 0, current_page: 1, last_page: 1 },
  } as never;
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function SharedDrawerFixture() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Mở drawer dùng chung</button>
      <UiDrawer
        open={open}
        title="Drawer dùng chung"
        onClose={() => setOpen(false)}
        actions={
          <button onClick={() => setOpen(false)}>Đóng drawer dùng chung</button>
        }
      >
        Nội dung kiểm tra đường chia và tiêu đề dùng chung
      </UiDrawer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/master-data/skus?screen=MST-01"]}>
        <div
          className="hn-system-shell"
          style={topbarOnly ? shellStyle : undefined}
        >
          {topbarOnly ? (
            <AppTopbar showMenuButton={false} onOpenMenu={() => {}} />
          ) : null}
          <main style={{ padding: 16, minHeight: "100vh" }}>
            {!topbarOnly ? (
              <>
                <div className="hn-mvp-screen">
                  <SkuMasterScreen />
                </div>
                <RowActionButton kind="view" label="Mũi tên dùng chung" />
                <SharedDrawerFixture />
              </>
            ) : null}
          </main>
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
