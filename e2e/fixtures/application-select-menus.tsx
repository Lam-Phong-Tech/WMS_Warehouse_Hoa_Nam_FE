import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { ThresholdSkuList } from "@/modules/dashboard/overview/ThresholdSkuList";
import GoodsTraceReport from "@/modules/reports/movement-trace/GoodsTraceReport";
import { ReportExportAction } from "@/modules/reports/components/ReportExportAction";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/styles/hn-icon-font.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";
import "@/shared/ui/operations-ui.css";

initializeTheme();
useAuthStore.setState({
  isSuperAdmin: true,
  isAuthenticated: true,
  isProfileLoaded: true,
});
http.get = (async () => ({
  events: [
    {
      id: "event-1",
      qty_delta: -1,
      event_type: "ISSUE",
      event_label: "Xuất kho",
      source_type: "ISSUE_DOCUMENT",
      actor: "Người kiểm tra",
      occurred_at: "2026-11-16T08:00:00+07:00",
      code: "SKU-001",
    },
  ],
  entities: [],
  relations: [],
  complete: true,
  resolved: true,
  loaded_count: 1,
  total_count: 1,
  warnings: [],
})) as typeof http.get;
http.getPage = (async () => ({
  data: [],
  meta: { current_page: 1, last_page: 1, total: 0 },
})) as typeof http.getPage;
const view = new URLSearchParams(location.search).get("view");
const content =
  view === "threshold" ? (
    <ThresholdSkuList
      rows={[
        {
          sku: "LOW",
          name: "Thiếu tồn",
          kind: "PRODUCT",
          available: 1,
          min: 5,
          max: 10,
          state: "low",
        },
        {
          sku: "HIGH",
          name: "Dư tồn",
          kind: "PRODUCT",
          available: 20,
          min: 5,
          max: 10,
          state: "high",
        },
      ]}
      onNavigate={() => undefined}
    />
  ) : view === "export" ? (
    <ReportExportAction
      title="Xuất báo cáo mẫu"
      fileStem="BaoCao"
      total={1}
      currentCount={1}
      formats={["xlsx", "pdf"]}
      sections={[{ id: "detail", label: "Chi tiết", selected: true }]}
      onExport={() => undefined}
    />
  ) : (
    <GoodsTraceReport />
  );
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <main style={{ padding: 24, minWidth: 0 }}>{content}</main>
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
