import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { OPERATIONS_REPORT_ENDPOINTS } from "@/modules/reports/operations/report-data";
import InboundFlowReport from "@/modules/reports/inventory-flow/InboundFlowReport";
import OutboundFlowReport from "@/modules/reports/inventory-flow/OutboundFlowReport";
import RecipientAgencyReport from "@/modules/reports/recipient-agency/RecipientAgencyReport";
import ImportQualityBaseline from "@/modules/reports/import-match/ImportQualityBaseline";
import { AppTopbar } from "@/app/layouts/topbar/AppTopbar";
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
useAuthStore.setState({
  isSuperAdmin: true,
  isProfileLoaded: true,
  isAuthenticated: true,
  user: {
    id: 1,
    name: "Nguyễn Duy Khánh",
    email: "khanh@example.test",
    code: "HN-01",
  } as never,
  profile: {
    name: "Nguyễn Duy Khánh",
    email: "khanh@example.test",
  } as never,
  permissionCodes: ["report.view", "report.export"],
});

const SKUS = [
  {
    sku_id: "sku-a",
    sku_code: "SKU-A",
    sku_name: "Máy bơm A",
    sku_type: "PRODUCT",
    unit: "Cái",
  },
  {
    sku_id: "sku-b",
    sku_code: "SKU-B",
    sku_name: "Bo mạch B",
    sku_type: "COMPONENT",
    unit: "Bộ",
  },
];

const BASE_DOC = {
  warehouse_code: "KHO-HN",
  created_by_name: "Nguyễn Kho",
  posted_at: "2026-11-05T08:00:00+07:00",
  document_date: "2026-11-05",
  lines: [
    {
      id: "line-1",
      product_code: "SKU-A",
      product_name: "Máy bơm A",
      expected_qty: 10,
      scanned_qty: 10,
      posted_qty: 10,
    },
  ],
};

const DOCUMENTS = [
  ...Array.from({ length: 6 }, (_, index) => ({
    ...BASE_DOC,
    id: `in-${index}`,
    document_no: `PN-20261105-${String(index + 1).padStart(3, "0")}`,
    doc_type: "INBOUND",
    status: index % 2 === 0 ? "POSTED" : "DRAFT",
    counterpart: `Nhà cung cấp Hoa Nam ${index + 1}`,
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    ...BASE_DOC,
    id: `out-${index}`,
    document_no: `PX-20261105-${String(index + 1).padStart(3, "0")}`,
    doc_type: "OUTBOUND",
    status: index % 2 === 0 ? "POSTED" : "DRAFT",
    counterpart: `Đại lý Minh Anh ${index + 1}`,
  })),
];

const XNT_LINES = [
  {
    id: "xnt-1",
    product_code: "SKU-A",
    warehouse_code: "KHO-HN",
    opening: 100,
    receipt_net: 60,
    issue_net: 20,
    component_issue_net: 5,
    reversal_unlinked_net: 0,
    closing: 135,
  },
  {
    id: "xnt-2",
    product_code: "SKU-B",
    warehouse_code: "KHO-HN",
    opening: 50,
    receipt_net: 10,
    issue_net: 5,
    component_issue_net: 0,
    reversal_unlinked_net: 0,
    closing: 55,
  },
];

const RECIPIENT_ROWS = Array.from({ length: 6 }, (_, index) => ({
  document_id: `out-${index}`,
  outbound_no: `PX-20261105-${String(index + 1).padStart(3, "0")}`,
  document_date: "2026-11-05",
  recipient_id: `receiver-${index}`,
  agency_id: `ag-${index}`,
  agency_code: `AG${index + 1}`,
  agency_name: `Đại lý An Phát ${index + 1}`,
  recipient_name: `Nguyễn Văn Minh ${index + 1}`,
  recipient_type: "AGENCY",
  sku_id: "sku-a",
  product_code: "SKU-A",
  product_name: "Máy bơm A",
  issued_qty: 10 + index,
  scanned_qty: 10 + index,
}));

const IMPORT_ROWS = Array.from({ length: 8 }, (_, index) => ({
  import_report_id: `batch-${index}`,
  file_name: `WWHN-172-SKU-import-${index + 1}.xlsx`,
  created_at: "2026-11-05T08:00:00+07:00",
  total_rows: 5,
  valid_rows: index % 3 === 0 ? 3 : 5,
  error_rows: index % 3 === 0 ? 2 : 0,
  duplicate_rows: 0,
  actor_id: "user-1",
  status: index % 3 === 0 ? "INVALID" : "VALID",
  mode: "IMPORT",
  error_file_available: false,
}));

function page(rows: unknown[], total = rows.length) {
  return {
    data: rows,
    meta: {
      current_page: 1,
      last_page: 1,
      total,
      per_page: 100,
    },
  } as never;
}

const INBOUND_DETAIL = {
  id: "in-0",
  doc_no: "PN-20261109-0004",
  doc_date: "2026-11-09T14:40:00+07:00",
  status: "POSTED",
  warehouse_id: "warehouse-1",
  created_by_name: "nguyễn duy khánh a",
  created_at: "2026-11-09T14:40:00+07:00",
  posted_at: "2026-11-09T14:41:00+07:00",
  version: 1,
  supplier: {
    id: "supplier-1",
    code: "NCC-003",
    name: "Kubota Việt Nam",
  },
  lines: [
    {
      id: "line-1",
      sku_code: "D054212",
      sku_name: "Mỏ lết điều chỉnh 12 inch",
      unit: "cái",
      qty_planned: 1,
      scanned_qty: 1,
      product_info_complete: true,
    },
  ],
  status_history: [
    {
      id: "history-1",
      to_status: "SCANNING",
      created_at: "2026-11-09T14:41:00+07:00",
      changed_by_name: "nguyễn duy khánh a",
    },
    {
      id: "history-2",
      to_status: "POSTED",
      created_at: "2026-11-09T14:41:00+07:00",
      changed_by_name: "nguyễn duy khánh a",
    },
  ],
};

const INBOUND_SCAN_ENTRIES = [
  {
    id: "entry-1",
    inbound_line_id: "line-1",
    item_code: "D054212",
    sku_code: "D054212",
    sku_name: "Mỏ lết điều chỉnh 12 inch",
    quantity: 1,
    status: "ACTIVE",
    created_at: "2026-11-09T14:41:00+07:00",
  },
];

http.get = async (url: string) => {
  if (url === "/inbound-documents/in-0") return INBOUND_DETAIL as never;
  if (url === API_ENDPOINTS.SKU_LOOKUP) return SKUS as never;
  if (url === API_ENDPOINTS.REPORTS_XNT_ENHANCED)
    return { lines: XNT_LINES } as never;
  if (url === API_ENDPOINTS.REPORTS_INVENTORY_LEDGER)
    return { rows: new URLSearchParams(location.search).has("dailyBars")
      ? ["in", "out"].flatMap((kind) => [4, 46].map((qty, index) => {
        const date = new Date();
        date.setDate(date.getDate() - index);
        return {
          id: `${kind}-movement-${index}`,
          occurred_at: `${date.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })}T08:00:00+07:00`,
          movement_type: kind === "in" ? "RECEIPT" : "ISSUE",
          product_code: index === 0 ? "SKU-A" : "SKU-B",
          source_id: `${kind}-${index * 2}`,
          qty_delta: kind === "in" ? qty : -qty,
        };
      })) : [] } as never;
  if (url === API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY)
    return { rows: new URLSearchParams(location.search).has("dailyBars")
      ? DOCUMENTS.map((document) => ({
        ...document,
        status: new URLSearchParams(location.search).has("statusClip") && document.doc_type === "OUTBOUND" ? "SCANNING" : document.status,
        posted_at: new Date().toISOString(),
        document_date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }),
      })) : DOCUMENTS } as never;
  if (url === OPERATIONS_REPORT_ENDPOINTS.OUTBOUND_BY_RECIPIENT)
    return {
      rows: RECIPIENT_ROWS,
      pagination: { current_page: 1, last_page: 1, total: RECIPIENT_ROWS.length },
    } as never;
  return { rows: [] } as never;
};

http.getPage = async (url: string) => {
  if (url === "/inbound-documents/in-0/scan-entries")
    return page(INBOUND_SCAN_ENTRIES);
  if (url === API_ENDPOINTS.WAREHOUSES)
    return page([
      {
        id: "warehouse-1",
        code: "KHO-HN",
        name: "Kho tổng Hoa Nam",
      },
    ]);
  if (url === API_ENDPOINTS.REVERSAL_DOCUMENTS) return page([]);
  if (url === API_ENDPOINTS.USERS)
    return page([
      {
        user_id: "user-1",
        display_name: "Nguyễn Kho",
        department: { department_id: "dep-1", department_name: "Kho vận" },
      },
    ]);
  if (url === "/skus/import-reports") return page(IMPORT_ROWS);
  if (url === API_ENDPOINTS.PRODUCTS) return page(SKUS);
  return page([]);
};

const report = new URLSearchParams(window.location.search).get("report");
const padded = report === "recipient" || report === "import-quality";
const isInboundDetail = report === "inbound-detail";

export function ReportFixture() {
  return (
    <div className="hn-system-shell" style={{ minHeight: "100vh" }}>
      <AppTopbar showMenuButton onOpenMenu={() => undefined} />
      <main
        className="hn-mvp-screen"
        style={{
          width: "100%",
          minHeight: "100vh",
          padding: padded ? 24 : 0,
          background: "var(--ops-canvas)",
        }}
      >
        {report === "inbound" || isInboundDetail ? <InboundFlowReport /> : null}
        {report === "outbound" ? <OutboundFlowReport /> : null}
        {report === "recipient" ? <RecipientAgencyReport /> : null}
        {report === "import-quality" ? <ImportQualityBaseline /> : null}
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
      <MemoryRouter
        initialEntries={[
          isInboundDetail
            ? "/reports/inventory-flow?document=in-0"
            : "/reports/recipient",
        ]}
      >
        <ReportFixture />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
