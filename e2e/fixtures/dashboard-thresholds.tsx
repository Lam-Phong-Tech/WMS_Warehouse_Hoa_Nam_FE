import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { http } from "@/shared/api/http";
import { DashboardSystemViews } from "@/modules/dashboard/overview/DashboardSystemViews";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";
import "@/styles/hn-wms-page-normalize.css";
import "@/shared/ui/operations-ui.css";

initializeTheme();
const scenario = new URLSearchParams(location.search).get("state");
const skus =
  scenario === "empty"
    ? []
    : Array.from({ length: 125 }, (_, i) => ({
        sku_id: `sku-${i + 1}`,
        sku_code: `SKU-${String(i + 1).padStart(3, "0")}${i === 0 ? "-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" : ""}`,
        sku_name:
          i === 0
            ? "Sản phẩm với tên tiếng Việt dài và mã ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 cần hiển thị đầy đủ"
            : `Sản phẩm Hoa Nam ${i + 1}`,
        sku_type: "PRODUCT",
        min_stock: 5,
        max_stock: 10,
      }));
http.get = (async (url: string) => {
  if (url === "/skus/lookup") return skus;
  if (url === "/reports/inventory-reconciliation") {
    if (scenario === "error") throw new Error("Không tải được số liệu");
    return {
      data_as_of: "2026-11-05T15:00:00+07:00",
      rows: skus.map((sku, i) => ({
        product_code: sku.sku_code,
        product_name: sku.sku_name,
        sku_type: sku.sku_type,
        available_qty: i < 100 ? 3 : i < 120 ? 12 : 7,
      })),
    };
  }
  return { rows: skus, data: skus };
}) as typeof http.get;
http.getPage = (async () => ({
  data: skus,
  meta: { current_page: 1, last_page: 1, total: skus.length },
})) as typeof http.getPage;
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardSystemViews
          view="thresholds"
          onNavigate={(route) => {
            document.body.dataset.navigation = route;
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
