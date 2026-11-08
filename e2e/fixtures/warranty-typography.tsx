import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { SkuMasterScreen } from "@/modules/master-data/pages/MvpMasterScreens";
import WarrantyPage from "@/modules/warranty/pages/WarrantyPage";
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
const reference = new URLSearchParams(location.search).has("reference");
const sku = {
  sku_id: "sku-typography",
  sku_code: "SKU-DEMO-003",
  sku_name: "Máy khoan kiểm tra kiểu chữ",
  sku_type: "PRODUCT",
  unit: "cái",
  status: "ACTIVE",
  version: 1,
};
const warranty = {
  id: "wc-typography",
  case_code: "WC-20261104-003",
  sku: "SKU-DEMO-003",
  sku_name: sku.sku_name,
  identification_type: "IDENTIFIED",
  customer_name: "Nguyễn Văn An",
  defect: "Không lên nguồn",
  status: "RECEIVED",
  priority: "MEDIUM",
  received_at: "2026-11-04T08:00:00Z",
  created_at: "2026-11-04T08:00:00Z",
  created_by: "fixture",
  version: 1,
};
// Exercise production screens and CSS; replace only the read-only transport.
http.getPage = async (url) => {
  const data =
    url === "/products" ? [sku] : url === "/warranty-cases" ? [warranty] : [];
  return {
    data,
    meta: { total: data.length, current_page: 1, last_page: 1 },
  } as never;
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          reference
            ? "/master-data/skus?screen=MST-01"
            : "/warranty?screen=WAR-01",
        ]}
      >
        <div className="hn-system-shell">
          <main style={{ padding: 16, minHeight: "100vh" }}>
            <div className="hn-mvp-screen">
              {reference ? <SkuMasterScreen /> : <WarrantyPage />}
            </div>
          </main>
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
