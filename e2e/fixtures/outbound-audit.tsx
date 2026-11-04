import { createRoot } from "react-dom/client";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { AppProviders } from "@/app/providers/AppProviders";
import AlignedMvpOutboundPage from "@/modules/outbound/pages/AlignedMvpOutboundPage";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";

initializeTheme();
useAuthStore.setState({ isSuperAdmin: true, isProfileLoaded: true });

const document = {
  id: "outbound-audit-1",
  doc_no: "PX-AUDIT-0001",
  doc_date: "2026-11-04T08:00:00+07:00",
  src_warehouse_id: "warehouse-audit-1",
  outbound_request_id: "request-audit-1",
  request_no: "TOA-AUDIT-0001",
  recipient_name: "Dự án kiểm tra giao diện",
  status: "POSTED",
  version: 1,
  created_by_name: "Người kiểm tra",
  lines: [
    {
      id: "line-audit-1",
      sku_id: "sku-audit-1",
      sku_code: "SKU-AUDIT-01",
      qty_planned: 1,
      scanned_qty: 1,
    },
  ],
};

// Exercise the actual service normalizer, page and app providers. Only its
// read endpoint is replaced; this fixture performs no real API mutations.
http.getPage = async (url, config) => {
  if (url !== API_ENDPOINTS.OUTBOUND_DOCUMENTS) {
    throw new Error(`Unexpected outbound audit GET: ${url}`);
  }
  const status = config?.params?.status;
  const rows = !status || status === document.status ? [document] : [];
  return {
    data: rows,
    meta: {
      total: rows.length,
      current_page: 1,
      per_page: config?.params?.per_page ?? 10,
      last_page: 1,
    },
  } as never;
};

export function OutboundAudit() {
  const [sidebarWidth, setSidebarWidth] = useState(
    Number(new URLSearchParams(window.location.search).get("sidebar") ?? 0),
  );
  return (
    <AppProviders>
      <MemoryRouter initialEntries={["/outbound?screen=OUT-01"]}>
        {sidebarWidth > 0 ? (
          <aside
            aria-label="Thanh bên kiểm tra bố cục"
            style={{
              position: "fixed",
              inset: "0 auto 0 0",
              width: sidebarWidth,
              boxSizing: "border-box",
              padding: 12,
              background: "var(--ops-heading)",
              color: "var(--ops-on-primary)",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setSidebarWidth((width) => (width > 100 ? 76 : 300))
              }
            >
              {sidebarWidth > 100 ? "Thu gọn thanh bên" : "Mở rộng thanh bên"}
            </button>
          </aside>
        ) : null}
        <main
          style={{
            padding: 24,
            boxSizing: "border-box",
            marginLeft: sidebarWidth,
            width: `calc(100% - ${sidebarWidth}px)`,
          }}
        >
          <button
            type="button"
            style={{ minHeight: 40, marginBottom: 16 }}
            onClick={() =>
              toast.success("Đã cập nhật phiếu", {
                description: "Thao tác đã hoàn tất.",
              })
            }
          >
            Hiện thông báo thử
          </button>
          <AlignedMvpOutboundPage />
        </main>
      </MemoryRouter>
    </AppProviders>
  );
}

createRoot(window.document.getElementById("root")!).render(<OutboundAudit />);
