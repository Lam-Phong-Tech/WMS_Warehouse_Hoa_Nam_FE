import TabRecipient from "@/modules/reports/operations/TabRecipient";

/** RPT-07 — route /reports/recipient (trang riêng, không còn tab). */
export default function RecipientReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-07"
      data-testid="wwhn-258-report-screen"
    >
      <TabRecipient />
    </div>
  );
}
