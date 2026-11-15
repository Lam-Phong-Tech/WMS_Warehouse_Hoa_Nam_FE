import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
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
useAuthStore.setState({ isSuperAdmin: true, isProfileLoaded: true });
const status = new URLSearchParams(location.search).get("status") || "POSTED";
const cancelled = status === "CANCELLED";
const empty = cancelled || status === "DRAFT";
const actor = "nguyễn duy khánh a";
const line = {
  id: "line-1",
  product_id: "sku-1",
  sku_code: "DCMY155",
  product_name: "Cưa tròn dùng pin không chổi than – DCMY155 (BM/FK/Z)",
  product_type: "PRODUCT",
  product_unit: "cái",
  product_info_complete: true,
  qty_planned: 0,
  scanned_qty: 1,
};
const detail = {
  id: "receipt-1",
  doc_no: cancelled ? "PN-20261115162710" : "PN-20261115171816",
  status,
  version: 3,
  dst_warehouse_id: "warehouse-1",
  created_by_name: actor,
  created_at: "2026-11-15T10:18:00Z",
  updated_at: "2026-11-15T10:20:00Z",
  cancelled_by_name: cancelled ? actor : null,
  supplier: {
    id: "supplier-1",
    code: "NCC-008",
    name: "Công ty Cơ Khí Hoa Nam Test e3ac",
    status: "ACTIVE",
    version: 1,
  },
  note: "Kiểm tra số lượng và tình trạng hàng hóa trước khi nhập kho. Đối chiếu mã sản phẩm với chứng từ nhà cung cấp. ".repeat(
    10,
  ),
  lines: empty ? [] : [line],
  operation_history: [
    {
      id: "create",
      action: "CREATE",
      actor_name: actor,
      occurred_at: "2026-11-15T10:18:00Z",
      note: "Khởi tạo phiếu nhập kho.",
    },
    {
      id: "finish",
      action: cancelled ? "CANCEL" : status === "POSTED" ? "POST" : "EDIT",
      actor_name: actor,
      occurred_at: "2026-11-15T10:20:00Z",
      note: cancelled
        ? "Nhập nhầm nhà cung cấp."
        : "Đã kiểm tra thông tin phiếu.",
    },
  ],
};
// Only the read transport is replaced: production hooks, normalizers and drawer render unchanged.
http.get = async (url) => {
  if (url === "/inbound-documents/receipt-1") return detail as never;
  return [] as never;
};
http.getPage = async (url) =>
  ({
    data:
      url === "/warehouses"
        ? [
            {
              id: "warehouse-1",
              name: "Kho tổng Hoa Nam",
              code: "KHO-TONG-HN",
              status: "ACTIVE",
            },
          ]
        : url.includes("scan-entries") && !empty
          ? [
              {
                id: "entry-1",
                inbound_line_id: "line-1",
                item_id: "item-1",
                item_code: "DCMY155-001",
                sku_code: "DCMY155",
                sku_name: line.product_name,
                quantity: 1,
                scan_source: "CAMERA_OR_MANUAL_CODE",
                status: "ACTIVE",
                created_at: "2026-11-15T10:19:00Z",
              },
            ]
          : [],
    meta: {
      total: 0,
      current_page: 1,
      per_page: 200,
      last_page: 1,
      evidence_status: "NOT_REQUIRED",
      requires_evidence: false,
    },
  }) as never;
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <div className="hn-system-shell">
          <InboundScanModal documentId="receipt-1" onClose={() => {}} />
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
