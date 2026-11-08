import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import ReversalPage from "@/modules/reverse/pages/ReversalPage";
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
useAuthStore.setState({ isSuperAdmin: true });

declare global {
  interface Window {
    __reversalRequests: Record<string, unknown>[];
  }
}
window.__reversalRequests = [];
const records = Array.from({ length: 42 }, (_, index) => ({
  id: `reversal-${index + 1}`,
  reversal_code: `RV-${String(index + 1).padStart(3, "0")}-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789`,
  status: "POSTED",
  physical_return_status: "CONFIRMED",
  reference_document_type: "OUTBOUND",
  reference_document_code: `PX-20261104-${String(index + 1).padStart(3, "0")}-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789`,
  reference_document_id: `outbound-${index + 1}`,
  warehouse_id: "warehouse-1",
  warehouse_name: "Kho tổng Hoa Nam",
  total_lines: index + 1,
  total_qty: index + 2,
  reason: "Điều chỉnh phiếu xuất theo chứng từ đã kiểm tra và đối chiếu",
  created_at: "2026-11-04T08:10:00+07:00",
  created_by_name:
    "Nguyễn Văn Quản Trị Viên Với Tên Dài Để Kiểm Tra Giới Hạn Ô",
  posted_by_name: "Quản trị viên",
  version: 1,
}));

// Read-only production hook + service normalizer; every paging/filter request is observable.
http.getPage = async (url, config) => {
  if (url !== "/reversal-documents")
    throw new Error(`Unexpected reversal fixture GET: ${url}`);
  const params = { ...(config?.params ?? {}) };
  window.__reversalRequests.push(params);
  const page = Number(params.page ?? 1);
  const perPage = Number(params.per_page ?? 10);
  const keyword = String(params.keyword ?? "").toLowerCase();
  const status = String(params.status ?? "");
  const filtered = records.filter(
    (record) =>
      (!status || record.status === status) &&
      (!keyword ||
        `${record.reversal_code} ${record.reference_document_code} ${record.reason}`
          .toLowerCase()
          .includes(keyword)),
  );
  return {
    data: filtered.slice((page - 1) * perPage, page * perPage),
    meta: {
      total: filtered.length,
      current_page: page,
      per_page: perPage,
      last_page: Math.max(1, Math.ceil(filtered.length / perPage)),
    },
  } as never;
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/reverse?screen=REV-00"]}>
        <div className="hn-system-shell">
          <main
            style={{
              padding: "clamp(16px, 2vw, 24px)",
              minHeight: "100vh",
              background: "var(--ops-canvas)",
            }}
          >
            <div className="hn-mvp-screen">
              <ReversalPage />
            </div>
          </main>
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
