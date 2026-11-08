import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient as client } from "@/app/providers/query-client";
import { Toaster } from "sonner";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { http } from "@/shared/api/http";
import { SkuImportModal } from "@/modules/master-data/components/SkuImportModal";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";

declare global {
  interface Window {
    __skuImportUploads: number;
  }
}
window.__skuImportUploads = 0;
initializeTheme();
const scenario = new URLSearchParams(location.search).get("case");
const limits = {
  max_rows: 1000,
  max_file_size_kb: scenario === "oversize" ? 1024 : 10240,
  allowed_extensions: ["xlsx", "xls"],
};
// Production modal/service/digest and real Toaster; only replace HTTP transport.
http.getPage = async (url) => {
  if (url !== "/skus/import-reports") throw new Error(`Unexpected GET: ${url}`);
  return { data: [], meta: { constraints: limits } } as never;
};
http.post = async (url) => {
  if (url !== "/skus/import-excel") throw new Error(`Unexpected POST: ${url}`);
  window.__skuImportUploads += 1;
  if (scenario === "timeout")
    throw {
      isAxiosError: true,
      code: "ECONNABORTED",
      message: "timeout of 10000ms exceeded",
    };
  if (scenario === "server-size")
    throw {
      isAxiosError: true,
      response: { status: 413, data: "<html>Request Entity Too Large</html>" },
    };
  throw {
    isAxiosError: true,
    response: {
      status: 422,
      data: {
        error_code: "SKU_IMPORT_FILE_INVALID",
        message:
          scenario === "corrupt"
            ? "Unable to identify a reader for this file"
            : "Thiếu cột bắt buộc: sku_code (hoặc alias legacy code).",
        data: { committed: false, partial_write: false, constraints: limits },
      },
    },
  };
};
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <div className="hn-system-shell">
          <SkuImportModal
            open
            canImport
            onClose={() => {}}
            onImported={() => {
              throw new Error("Rejected file must not be imported");
            }}
          />
        </div>
        <Toaster position="top-right" className="app-toaster" />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
