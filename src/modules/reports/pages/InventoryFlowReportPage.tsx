import TabInventoryFlow from "@/modules/reports/operations/TabInventoryFlow";

/** RPT-01 — route /reports/inventory-flow (trang riêng, không còn tab). */
export default function InventoryFlowReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-01"
      data-testid="wwhn-258-report-screen"
    >
      <TabInventoryFlow />
    </div>
  );
}
