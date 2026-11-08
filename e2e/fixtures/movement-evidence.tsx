import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { MovementEvidenceDrawer } from "@/modules/reports/movement-trace/MovementEvidenceDrawer";
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
function Fixture() {
  const [open, setOpen] = useState(false);
  return (
    <main style={{ padding: 24 }}>
      <h1>Truy vết hàng hóa</h1>
      <button onClick={() => setOpen(true)}>Mở bằng chứng</button>
      {open && (
        <MovementEvidenceDrawer
          row={{
            id: "mv-1",
            movementNo: "MV-20261006-H1CPG6RU",
            occurredAt: "2026-10-06T08:30:00+07:00",
            movementType: "RECEIPT",
            productCode: "DCCS20061-2",
            productName: "Máy cắt cầm tay Hoa Nam",
            physicalCode:
              "SN-PN-RW-20261006-003-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
            warehouseCode: "KHO-TONG-HN",
            stockStatus: "AVAILABLE",
            qtyDelta: 1,
            actor: "Lê Quang Huy — Quản lý kho chi nhánh",
            sourceType: "INBOUND_DOCUMENT",
            sourceId: "in-1",
            sourceNo: "PN-RW-20261006",
            originalMovementId: "",
            originalMovementNo: "",
            correctionChainId: "",
            itemId: "",
            containerId: "",
          }}
          movementLabel="Nhập kho đã ghi sổ"
          occurredAtLabel="08:30 06/10/2026"
          sourceDocument="PN-RW-20261006 · Phiếu nhập / xuất kho"
          reversalChain="Chưa có"
          currentStatus={{ tone: "success", label: "Đang trong kho" }}
          onClose={() => setOpen(false)}
          onTrace={() => {
            document.body.dataset.traced = "true";
          }}
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
