import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { ReversalDetailModal } from "@/modules/reverse/components/ReversalDetailModal";
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
import "@/modules/reverse/pages/reversal-list.css";
import "@/modules/reverse/components/reversal-create.css";

initializeTheme();
useAuthStore.setState({ isSuperAdmin: true });
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
const params = new URLSearchParams(location.search);
const status = params.get("status") === "DRAFT" ? "DRAFT" : "POSTED";
const code = "REV-20261102152937-6HEKQB-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
queryClient.setQueryData(["reversal", "detail", "rev-detail"], {
  id: "rev-detail",
  reversal_code: code,
  status,
  physical_return_status: "CONFIRMED",
  reference_document_type: "OUTBOUND",
  reference_document_code:
    "PX-20261029110011-PWESER-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  reference_document_id: "source-1",
  correction_chain_id: "75832abc-1234-5678-9000-abcdef3bfd0e",
  warehouse_id: "wh-1",
  warehouse_name: "Kho tổng Hoa Nam",
  total_lines: 12,
  total_qty: 24,
  reason:
    "Điều chỉnh sai sót, hàng đã về và đã kiểm tra đầy đủ chứng từ liên quan",
  created_at: "2026-11-02T15:29:00+07:00",
  created_by: "Quản trị viên 02",
  posted_by: "Quản trị viên 02",
  reversed_at: "2026-11-02T15:30:00+07:00",
  version: 4,
});
queryClient.setQueryData(
  ["reversal", "lines", "rev-detail"],
  Array.from({ length: 12 }, (_, i) => ({
    id: `line-${i + 1}`,
    reversal_id: "rev-detail",
    line_no: i + 1,
    sku: `DCKIT27-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-${i + 1}`,
    sku_name:
      "Bộ combo không dây với tên sản phẩm dài để kiểm tra khả năng hiển thị đầy đủ trong ngăn chi tiết",
    original_movement_id: "mv-internal",
    original_movement_code:
      "MV-20261029-AN9-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
    serial_number: `DCKIT27-001-SERIAL-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-${i + 1}`,
    original_qty: 5,
    reversal_qty: 2,
    reversed_qty: 2,
    remaining_qty: 3,
    return_condition: "SELLABLE",
    status,
  })),
);
queryClient.setQueryData(["document-attachments", "REVERSAL", "rev-detail"], {
  evidenceStatus: "PROVIDED",
  attachments: [],
});
function Fixture() {
  const [open, setOpen] = useState(false);
  return (
    <main style={{ padding: 24 }}>
      <h1>Danh sách phiếu điều chỉnh</h1>
      <button onClick={() => setOpen(true)}>Mở chi tiết</button>
      {open && (
        <ReversalDetailModal
          documentId="rev-detail"
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Fixture />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
