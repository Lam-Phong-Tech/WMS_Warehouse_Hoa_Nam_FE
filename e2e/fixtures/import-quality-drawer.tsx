import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { ImportQualityBatchDrawer } from "@/modules/reports/import-match/ImportQualityBatchDrawer";
import type { ImportMatchBatch } from "@/modules/reports/import-match/import-match-model";
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
const file =
  "WWHN-172-SKU-import-template-v1.1.0-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789.xlsx";
const batch: ImportMatchBatch = {
  id: "batch-1",
  context: "IMPORT",
  batchNo: file,
  sourceFile: file,
  caption: "Nhập danh mục SKU · Chạy thử",
  checksum: "",
  sourceVersion: "",
  at: "2026-11-04T03:45:00+07:00",
  total: 5,
  success: 2,
  failed: 2,
  duplicate: 1,
  actor: "Quản trị viên",
  status: "INVALID",
  errors: [],
  matchLines: [],
  skuCodes: [],
  errorFileAvailable: false,
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
client.setQueryData(["rpt-04", "sku-import-issues", "batch-1", 1], {
  rows: [
    {
      rowNo: 2,
      field: "sku_code",
      code: "INVALID_CODE_FORMAT",
      message: "Mã SKU không hợp lệ.",
      rawValue: "???",
      severity: "ERROR",
      suggestedAction: "Kiểm tra lại định dạng mã SKU trong tệp nguồn.",
    },
    {
      rowNo: 45,
      field: "sku_code",
      code: "DUPLICATE",
      message: "Mã SKU trùng trong tệp.",
      rawValue: "SKU-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
      severity: "WARNING",
      suggestedAction: "Đổi mã SKU bị trùng trước khi nhập lại.",
    },
  ],
  total: 3,
  lastPage: 2,
});
client.setQueryData(["rpt-04", "sku-import-issues", "batch-1", 2], {
  rows: [
    {
      rowNo: 77,
      field: "sku_name",
      code: "REQUIRED",
      message: "Thiếu tên SKU.",
      rawValue: "",
      severity: "ERROR",
      suggestedAction: "Bổ sung tên SKU trong tệp.",
    },
  ],
  total: 3,
  lastPage: 2,
});
function Fixture() {
  const [open, setOpen] = useState(false);
  return (
    <main style={{ padding: 24 }}>
      <h1>Nhập dữ liệu & đối chiếu</h1>
      <button onClick={() => setOpen(true)}>Mở đợt nhập</button>
      {open && (
        <ImportQualityBatchDrawer
          batch={batch}
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Fixture />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
