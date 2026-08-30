import TabPendingEvidence from "@/modules/reports/operations/TabPendingEvidence";

/** RPT-08 — route /reports/pending-evidence (trang riêng, không còn tab). */
export default function PendingEvidenceReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-08"
      data-testid="wwhn-258-report-screen"
    >
      <TabPendingEvidence />
    </div>
  );
}
