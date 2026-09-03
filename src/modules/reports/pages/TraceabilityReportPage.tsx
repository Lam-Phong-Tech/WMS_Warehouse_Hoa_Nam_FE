import MovementTraceReport from "@/modules/reports/movement-trace/MovementTraceReport";

/** RPT-03 — route /reports/traceability (RPT-MOV-01, port 1:1 mockup 8.4). */
export default function TraceabilityReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-03"
      data-testid="wwhn-258-report-screen"
    >
      <MovementTraceReport />
    </div>
  );
}
