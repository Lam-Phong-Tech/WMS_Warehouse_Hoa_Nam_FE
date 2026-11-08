import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  StockReconcileDrilldown,
  type ReconcileDetailView,
} from "@/modules/reports/stock-reconcile/StockReconcileDrilldown";
import { http } from "@/shared/api/http";
import "@/modules/reports/stock-reconcile/stock-reconcile-report.css";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/app/layouts/system-shell.css";
import "@/index.css";
import "@/styles/hn-wms-page-normalize.css";
import "@/styles/hn-wms-source-screen.css";
import "@/shared/ui/operations-ui.css";
import "@/styles/hn-responsive.css";

initializeTheme();
http.get = async () =>
  ({
    rows: [
      {
        id: "mv-1",
        product_code: "HN-DRV-001",
        warehouse_code: "KHO-TONG-HN",
        qty_delta: 5,
        movement_no: "PN-20261006-001",
        movement_type: "RECEIPT",
        occurred_at: "2026-10-06T08:30:00+07:00",
      },
    ],
  }) as never;
function Fixture() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ReconcileDetailView>("quantity");
  return (
    <main style={{ padding: 24 }}>
      <h1>Tồn kho & đối soát</h1>
      <button
        onClick={() => {
          setView("quantity");
          setOpen(true);
        }}
      >
        Xem bằng chứng HN-DRV-001
      </button>
      {open && (
        <StockReconcileDrilldown
          row={{
            hasFlow: true,
            skuCode: "HN-DRV-001",
            skuName:
              "Bộ điều khiển động cơ với tên dài để kiểm tra nội dung tự xuống dòng trong thanh chi tiết",
            warehouse: "KHO-TONG-HN",
            kind: "PRODUCT",
            opening: 100,
            inbound: 5,
            productOutbound: 15,
            componentOutbound: 0,
            reversal: 2,
            closing: 92,
            ledgerStock: 92,
            actual: 90,
            available: 80,
            delta: -2,
            checks: ["ledger_to_balance"],
          }}
          range={{ from: "2026-10-01", to: "2026-10-31" }}
          asOf="2026-11-05T16:14:00+07:00"
          view={view}
          canExport={false}
          onViewChange={setView}
          onBack={() => setOpen(false)}
          onOpenInventory={() => {}}
          onOpenTrace={() => {}}
        />
      )}
    </main>
  );
}
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Fixture />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
