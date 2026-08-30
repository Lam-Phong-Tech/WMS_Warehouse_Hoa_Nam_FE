import TabWarranty from "@/modules/reports/operations/TabWarranty";

/** RPT-06 — route /reports/warranty (trang riêng, không còn tab). */
export default function WarrantyReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-06"
      data-testid="wwhn-258-report-screen"
    >
      <TabWarranty />
    </div>
  );
}
