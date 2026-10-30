import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dayjs from "dayjs";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import WarrantyReportPage from "@/modules/reports/pages/WarrantyReportPage";
import { http } from "@/shared/api/http";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";
import "@/styles/hn-wms-page-normalize.css";
import "@/styles/hn-wms-source-screen.css";
import "@/shared/ui/operations-ui.css";
import "@/styles/hn-responsive.css";

const rows = [
  {
    warranty_case_id: "long-identifiers",
    case_no: "TC12-TEST-WARRANTY-202610251234567890-LONG-CASE-CODE",
    serial_no: "SERIAL-20261025-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
    sku_code: "TC11-TC12-TEST-SKU-20261025-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    sku_name:
      "Sản phẩm bảo hành với tên rất dài để kiểm tra giới hạn nội dung trong từng cột của báo cáo",
    components_issued:
      "Linh kiện thay thế có mã và tên rất dài để kiểm tra ô kế bên",
    received_at: dayjs().format("YYYY-MM-DD"),
    status: "REPAIRING",
  },
];
// Render the production report and CSS, with deterministic data and no backend writes.
http.get = async () => ({ rows }) as never;
http.getPage = async () =>
  ({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } }) as never;
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <main className="hn-system-shell" style={{ padding: 24 }}>
          <WarrantyReportPage />
        </main>
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
