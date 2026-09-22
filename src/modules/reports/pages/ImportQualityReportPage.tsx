import ImportQualityBaseline from "@/modules/reports/import-match/ImportQualityBaseline";

/** RPT-04 — Báo cáo Nhập liệu, đối chiếu & lỗi. */
export default function ImportQualityReportPage() {
  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-04"
      data-testid="wwhn-258-report-screen"
    >
      <ImportQualityBaseline />
    </div>
  );
}
