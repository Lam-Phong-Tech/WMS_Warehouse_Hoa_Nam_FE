import TabPackingLabel from "@/modules/reports/operations/TabPackingLabel";

/** RPT-05 — route /reports/packing-label (trang riêng, không còn tab). */
export default function PackingLabelReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-05"
      data-testid="wwhn-258-report-screen"
    >
      <TabPackingLabel />
    </div>
  );
}
