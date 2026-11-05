import GoodsTraceReport from "@/modules/reports/movement-trace/GoodsTraceReport";

/** RPT-03 — route /reports/traceability (goods trace — events, entity profiles and packing relationships). */
export default function TraceabilityReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-03"
      data-testid="wwhn-258-report-screen"
    >
      <GoodsTraceReport />
    </div>
  );
}
