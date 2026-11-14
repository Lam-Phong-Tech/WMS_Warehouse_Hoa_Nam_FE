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
  importDetails: {
    sourceId: "source-1",
    version: 2,
    mode: "DRY_RUN",
    uploader: "Nguyễn Văn An",
    uploaderAccount: "an.nv",
    uploadedAt: "2026-11-10T02:45:00Z",
    actorAccount: "admin",
    size: 2048,
    sheet: "Danh mục SKU",
    startedAt: "2026-11-14T03:00:00Z",
    completedAt: "2026-11-14T03:00:02Z",
    durationMs: 2000,
    updateExisting: false,
    sourceAvailable: true,
    sourceStatus: "AVAILABLE",
    errorExpiresAt: "",
    inserted: 0,
    updated: 0,
    notWritten: 5,
    plannedInserted: 2,
    plannedUpdated: 0,
  },
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
const latest = {
  import_report_id: "batch-1",
  source_file_id: "source-1",
  result_version: 2,
  file_name: file,
  file_sha256: "a".repeat(64),
  template_version: "v1.1.0",
  mode: "DRY_RUN",
  status: "REJECTED",
  total_rows: 5,
  valid_rows: 2,
  error_rows: 3,
  row_errors: [{ row: 45, code: "DUPLICATE" }],
  uploaded_by_name: "Nguyễn Văn An",
  uploaded_by_account: "an.nv",
  uploaded_at: "2026-11-10T02:45:00Z",
  created_at: "2026-11-14T03:00:00Z",
  started_at: "2026-11-14T03:00:00Z",
  completed_at: "2026-11-14T03:00:02Z",
  actor_name: "Quản trị viên",
  actor_account: "admin",
  processing_duration_ms: 2000,
  file_size_bytes: 2048,
  sheet_name: "Danh mục SKU",
  update_existing: false,
  source_file_available: true,
  source_file_status: "AVAILABLE",
  error_file_available: false,
  actual_inserted_rows: 0,
  actual_updated_rows: 0,
  not_written_rows: 5,
  planned_inserted_rows: 2,
  planned_updated_rows: 0,
};
client.setQueryData(
  ["rpt-04", "sku-import-versions", "batch-1"],
  [
    latest,
    {
      ...latest,
      import_report_id: "batch-v1",
      result_version: 1,
      mode: "COMMIT",
      status: "COMMITTED",
      total_rows: 5,
      valid_rows: 5,
      error_rows: 0,
      row_errors: [],
      actual_inserted_rows: 5,
      not_written_rows: 0,
    },
  ],
);
client.setQueryData(["rpt-04", "sku-import-issues", "batch-v1", 1], {
  rows: [],
  total: 0,
  lastPage: 1,
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
