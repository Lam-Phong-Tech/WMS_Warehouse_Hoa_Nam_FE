import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppThemeProvider } from "@/shared/ui/theme/AppThemeProvider";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { DashboardSnapshot } from "@/modules/dashboard/overview/DashboardSnapshot";
import "@/modules/dashboard/dashboard-overview.css";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";
import "@/styles/hn-wms-page-normalize.css";
import "@/shared/ui/operations-ui.css";

initializeTheme();
useAuthStore.setState({
  isSuperAdmin: true,
  isProfileLoaded: true,
  permissionCodes: ["report.view"],
});

// Chỉ mock transport đọc; màn hình và CSS là production.
const RECENT_DOCUMENTS = [
  {
    id: "recent-1",
    document_no: "PN-20261109-0004",
    doc_type: "INBOUND",
    status: "POSTED",
    document_date: "2026-11-09T14:40:00+07:00",
    posted_at: "2026-11-09T14:41:00+07:00",
    counterpart: "NCC-003 - Kubota Việt Nam",
    created_by_name: "Quản trị viên 02",
    lines: [{ id: "line-1", posted_qty: 1 }],
  },
  {
    id: "recent-2",
    document_no: "PN-20261108-0014",
    doc_type: "INBOUND",
    status: "POSTED",
    document_date: "2026-11-08T17:04:00+07:00",
    posted_at: "2026-11-08T17:05:00+07:00",
    counterpart: "—",
    created_by_name: "Quản trị viên 02",
    lines: [{ id: "line-2", posted_qty: 20 }],
  },
  {
    id: "recent-3",
    document_no: "PX-20261108-0010",
    doc_type: "OUTBOUND",
    status: "POSTED",
    document_date: "2026-11-08T16:50:00+07:00",
    posted_at: "2026-11-08T16:51:00+07:00",
    counterpart: "Đại lý Minh Anh",
    created_by_name: "Quản trị viên 02",
    lines: [{ id: "line-3", posted_qty: 10 }],
  },
  {
    id: "recent-4",
    document_no: "PN-20261108-0007",
    doc_type: "INBOUND",
    status: "POSTED",
    document_date: "2026-11-08T16:25:00+07:00",
    posted_at: "2026-11-08T16:26:00+07:00",
    counterpart: "NCC-003 - Kubota Việt Nam",
    created_by_name: "Quản trị viên 02",
    lines: [{ id: "line-4", posted_qty: 10 }],
  },
  {
    id: "recent-5",
    document_no: "PN-20261108-0008",
    doc_type: "INBOUND",
    status: "POSTED",
    document_date: "2026-11-08T16:21:00+07:00",
    posted_at: "2026-11-08T16:22:00+07:00",
    counterpart: "NCC-006 - Yanmar Việt Nam",
    created_by_name: "Quản trị viên 02",
    lines: [{ id: "line-5", posted_qty: 5 }],
  },
];

http.get = (async () => ({ rows: [] })) as typeof http.get;
http.getPage = (async (url: string) => {
  if (url === API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY) {
    return {
      data: { rows: RECENT_DOCUMENTS },
      meta: {
        current_page: 1,
        last_page: 1,
        total: RECENT_DOCUMENTS.length,
        per_page: 100,
        timestamp: "2026-11-11T12:00:00+07:00",
      },
    } as never;
  }
  if (url === API_ENDPOINTS.USERS) {
    return {
      data: [{ user_id: "user-1", display_name: "Quản trị viên 02" }],
      meta: { current_page: 1, last_page: 1, total: 1, per_page: 100 },
    } as never;
  }
  if (url === API_ENDPOINTS.REVERSAL_DOCUMENTS) {
    return {
      data: [],
      meta: { current_page: 1, last_page: 1, total: 0, per_page: 100 },
    } as never;
  }
  return {
    data: [],
    meta: { current_page: 1, last_page: 1, total: 0, per_page: 100 },
  } as never;
}) as typeof http.getPage;

const today = "2026-11-11";
const from7 = "2026-11-05";

const cards = [
  {
    id: "DASH-KPI-01",
    label: "Tổng tồn khả dụng",
    value: 10163,
    delta: "+1",
    trend: "up" as const,
    note: "822 SKU có tồn · 3.457 SP · 6.706 LK",
    icon: "package-search" as const,
    spark: [],
    source: "fixture",
  },
  {
    id: "DASH-KPI-03",
    label: "Nhập đã ghi sổ",
    value: 1,
    delta: "+1",
    trend: "up" as const,
    note: "1 SP · 0 LK",
    icon: "package-plus" as const,
    spark: [],
    source: "fixture",
  },
  {
    id: "DASH-KPI-04",
    label: "Xuất sản phẩm đã ghi sổ",
    value: 0,
    delta: "0",
    trend: "flat" as const,
    note: "So với kỳ trước",
    icon: "package-minus" as const,
    spark: [],
    source: "fixture",
  },
  {
    id: "DASH-KPI-05",
    label: "Xuất linh kiện bảo hành",
    value: 0,
    delta: "0",
    trend: "flat" as const,
    note: "So với kỳ trước",
    icon: "briefcase-medical" as const,
    spark: [],
    source: "fixture",
  },
];

const rows = Array.from({ length: 7 }, (_, index) => ({
  date: `2026-11-${String(index + 5).padStart(2, "0")}`,
  label: `0${index + 5}/11`,
  inbound: index === 3 ? 40 : index % 2 === 0 ? 13 : 0,
  receiptProduct: index === 3 ? 40 : index % 2 === 0 ? 13 : 0,
  receiptComponent: 0,
  product: index % 2 === 0 ? 8 : 0,
  component: 0,
  reversal: 0,
}));

const trend = rows.map((row, index) => ({
  date: row.date,
  label: row.label,
  closing: 8120 + index * 29,
}));

const composition = [
  { status: "AVAILABLE", label: "Có thể xuất", value: 10163, pct: 100 },
];

const issues = [
  {
    id: "ISSUE-1",
    severity: "P1" as const,
    title: "Sự cố đối soát tồn",
    detail: "Sự cố đã được đối soát · Chênh lệch chưa đóng",
    technical: "STOCK_MISMATCH",
    count: 7,
    route: "/reports/stock-reconcile",
  },
  {
    id: "ISSUE-2",
    severity: "P1" as const,
    title: "Hồ sơ bảo hành cần xử lý",
    detail: "Đang xử lý · Có 49 hồ sơ quá hạn",
    technical: "WARRANTY_OVERDUE",
    count: 49,
    route: "/reports/warranty",
  },
  {
    id: "ISSUE-3",
    severity: "P1" as const,
    title: "Lỗi nhập liệu hoặc đối chiếu",
    detail: "Dữ liệu nhập vào chưa khớp · Cần kiểm tra lại",
    technical: "IMPORT_MISMATCH",
    count: 9,
    route: "/reports/import-quality",
  },
  {
    id: "ISSUE-4",
    severity: "P2" as const,
    title: "Sản phẩm chờ bổ sung thông tin",
    detail: "Chưa đủ thông tin sản phẩm · Không chứa dữ liệu cá nhân",
    technical: "SKU_PENDING_INFO",
    count: 10,
    route: "/master-data",
  },
];

export function DashboardFixture() {
  return (
    <div className="hn-dash" data-mvp-screen="MAP-01">
      <DashboardSnapshot
        name="Nguyễn Duy Khánh"
        cards={cards}
        rows={rows}
        trend={trend}
        composition={composition}
        issues={issues}
        range={{ from: from7, to: today }}
        period="last7"
        custom={{ from: from7, to: today }}
        onPeriodChange={() => undefined}
        onCustomChange={() => undefined}
        loading={false}
        failed={false}
        forbidden={false}
        liveRecent
        liveThreshold
        onRetry={() => undefined}
        onNavigate={() => undefined}
        onLogout={() => undefined}
      />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardFixture />
      </MemoryRouter>
    </QueryClientProvider>
  </AppThemeProvider>,
);
