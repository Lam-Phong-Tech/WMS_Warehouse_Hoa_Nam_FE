import TabTraceability from "@/modules/reports/operations/TabTraceability";

/** RPT-03 — route /reports/traceability (trang riêng, không còn tab). */
export default function TraceabilityReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-03"
      data-testid="wwhn-258-report-screen"
    >
      <TabTraceability />
    </div>
  );
}
