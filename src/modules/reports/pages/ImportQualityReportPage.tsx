import TabImportQuality from "@/modules/reports/operations/TabImportQuality";

/** RPT-04 — route /reports/import-quality (trang riêng, không còn tab). */
export default function ImportQualityReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-04"
      data-testid="wwhn-258-report-screen"
    >
      <TabImportQuality />
    </div>
  );
}
