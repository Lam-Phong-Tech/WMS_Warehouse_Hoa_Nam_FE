import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import InboundPage from "@/modules/inbound/pages/InboundPage";
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
declare global {
  interface Window {
    __inboundFilterRequests: Record<string, unknown>[];
  }
}
window.__inboundFilterRequests = [];
const rows = Array.from({ length: 24 }, (_, index) => ({
  id: `inbound-${index + 1}`,
  doc_no: `PN-${String(index + 1).padStart(3, "0")}-20261104`,
  doc_date: "2026-11-04T08:00:00+07:00",
  dst_warehouse_id: "warehouse-1",
  source_reference: "Nhà cung cấp Hoa Nam — Lô hàng kiểm tra bộ lọc",
  status: index % 2 === 0 ? "POSTED" : "DRAFT",
  pending_product_info: index % 3 === 0,
  pending_product_info_count: index % 3 === 0 ? 1 : 0,
  created_by_name: "Quản trị viên",
  created_at: "2026-11-04T08:00:00+07:00",
  updated_at: "2026-11-04T08:00:00+07:00",
  version: 1,
  lines: [
    {
      id: `line-${index + 1}`,
      product_id: "sku-1",
      sku_code: "SKU-FILTER-001",
      qty_planned: 10,
      scanned_qty: 10,
    },
  ],
}));

// Production list hook/normalizer with deterministic read-only responses.
http.getPage = async (url, config) => {
  if (url !== "/inbound-documents")
    throw new Error(`Unexpected inbound filter GET: ${url}`);
  const params = { ...(config?.params ?? {}) };
  window.__inboundFilterRequests.push(params);
  const keyword = String(params.keyword ?? "").toLowerCase();
  const status = String(params.status ?? "");
  const pending = params.pending_product_info;
  const page = Number(params.page ?? 1);
  const perPage = Number(params.per_page ?? 10);
  const filtered = rows.filter(
    (row) =>
      (!status || row.status === status) &&
      (pending === undefined || row.pending_product_info === pending) &&
      (!keyword ||
        `${row.doc_no} ${row.source_reference}`
          .toLowerCase()
          .includes(keyword)),
  );
  const sorted =
    params.sort_order === "asc" ? [...filtered].reverse() : filtered;
  return {
    data: sorted.slice((page - 1) * perPage, page * perPage),
    meta: {
      total: sorted.length,
      current_page: page,
      per_page: perPage,
      last_page: Math.max(1, Math.ceil(sorted.length / perPage)),
    },
  } as never;
};
http.post = async () => {
  throw new Error("Inbound filter fixture does not permit writes");
};

/** Sidebar sizing harness only; the page, CSS, controls, hooks and service are real. */
export function InboundFilterFixture() {
  const [sidebarWidth, setSidebarWidth] = useState(
    Number(new URLSearchParams(window.location.search).get("sidebar") ?? 300),
  );
  return (
    <div className="hn-system-shell inbound-filter-fixture">
      <style>{`
        .fixture-inbound-sidebar { position:fixed; inset:0 auto 0 0; box-sizing:border-box; padding:16px 12px; background:var(--ops-heading); color:white; }
        .fixture-inbound-sidebar strong { display:block; margin-bottom:16px; overflow:hidden; white-space:nowrap; }
        .fixture-inbound-sidebar button { width:100%; border:1px solid #ffffff55; background:transparent; color:white; padding:10px 4px; border-radius:6px; }
        .fixture-inbound-main { box-sizing:border-box; min-width:0; padding:24px; min-height:100vh; background:var(--ops-canvas); }
        @media(max-width:767px) { .fixture-inbound-sidebar { display:none; } .fixture-inbound-main { margin-left:0!important; width:100%!important; padding:16px; } }
      `}</style>
      <aside
        className="fixture-inbound-sidebar"
        style={{ width: sidebarWidth }}
        aria-label={`Thanh bên mẫu ${sidebarWidth}px`}
      >
        <strong>{sidebarWidth > 100 ? "Hoa Nam · WMS" : "HN"}</strong>
        <button
          type="button"
          aria-label={
            sidebarWidth > 100 ? "Thu gọn thanh bên" : "Mở rộng thanh bên"
          }
          onClick={() => setSidebarWidth((width) => (width > 100 ? 76 : 300))}
        >
          {sidebarWidth > 100 ? "Thu gọn thanh bên" : "→"}
        </button>
      </aside>
      <main
        className="fixture-inbound-main"
        style={{
          marginLeft: sidebarWidth,
          width: `calc(100% - ${sidebarWidth}px)`,
        }}
      >
        <div className="hn-mvp-screen">
          <InboundPage />
        </div>
      </main>
    </div>
  );
}
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/inbound?screen=IN-01"]}>
        <InboundFilterFixture />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
