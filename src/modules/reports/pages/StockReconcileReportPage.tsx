import TabStockReconcile from "@/modules/reports/operations/TabStockReconcile";

/** RPT-02 — route /reports/stock-reconcile (trang riêng, không còn tab). */
export default function StockReconcileReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-02"
      data-testid="wwhn-258-report-screen"
    >
      <TabStockReconcile />
    </div>
  );
}
