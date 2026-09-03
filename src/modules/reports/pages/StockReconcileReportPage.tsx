import StockReconcileReport from "@/modules/reports/stock-reconcile/StockReconcileReport";

/**
 * RPT-02 — route /reports/stock-reconcile.
 *
 * Trang dựng nguyên khối theo demo UI/UX đã chốt (breadcrumb + page-header +
 * padding riêng của demo), nên KHÔNG bọc trong `hn-mvp-source-screen`: lớp đó
 * áp style riêng cho `.card` / `table` / `.chip` và sẽ đè lên bản port.
 * `data-testid` giữ nguyên làm mốc cho bộ E2E báo cáo.
 */
export default function StockReconcileReportPage() {
  return (
    <div data-testid="wwhn-258-report-screen">
      <StockReconcileReport />
    </div>
  );
}
