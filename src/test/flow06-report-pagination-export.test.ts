import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Flow 06 report pagination/export alignment", () => {
  it("uses the aligned report page", () => {
    expect(read("src/modules/reports/pages/ReportsPage.tsx")).toContain(
      "AlignedReportsPage",
    );
  });

  it("sends server pagination on every report query", () => {
    const source = read("src/modules/reports/pages/AlignedReportsPage.tsx");
    expect(source).toContain("{ page, per_page: perPage }");
    expect(source).toContain("pagination.current_page");
    expect(source).toContain("pagination.total");
    expect(source).toContain("pagination.per_page");
  });

  it("exposes both XLSX and PDF under report.export", () => {
    const source = read("src/modules/reports/pages/AlignedReportsPage.tsx");
    expect(source).toContain('exportReport("xlsx")');
    expect(source).toContain('exportReport("pdf")');
    expect(source).toContain("setExporting(format)");
    expect(
      source.match(/permissionCode="REPORT_EXPORT"/g)?.length,
    ).toBeGreaterThanOrEqual(2);
  });

  /** Annex D SCR-RPT-01: action export trỏ /reports/export, không gọi thẳng file. */
  it("creates the export job through Annex C createReportExport", () => {
    const source = read("src/modules/reports/pages/AlignedReportsPage.tsx");
    expect(source).toContain("API_ENDPOINTS.REPORTS_EXPORT");
    expect(source).toContain('"Idempotency-Key": createIdempotencyKey()');
    expect(source).toContain("report_code: config.reportCode");
    expect(read("src/shared/api/endpoints.ts")).toContain(
      'REPORTS_EXPORT: "/reports/export"',
    );
  });

  /** BR-EXP-03: tên file có timestamp do BE đặt, client không được tự dựng đè. */
  it("keeps the server-issued export file name", () => {
    const source = read("src/modules/reports/pages/AlignedReportsPage.tsx");
    expect(source).toContain("fileName ??");
    const httpSource = read("src/shared/api/http.ts");
    expect(httpSource).toContain("downloadFile");
    expect(httpSource).toContain("content-disposition");
  });

  /** §13.10: cột và filter bắt buộc của từng báo cáo phải có mặt trên màn hình. */
  it("renders the mandatory §13.10 columns and filters", () => {
    const source = read("src/modules/reports/pages/AlignedReportsPage.tsx");
    // RPT-INV-01: as_of + updated_at
    expect(source).toContain("result.as_of = asOf.format");
    expect(source).toContain('dataIndex: "updated_at"');
    // RPT-OUT-MATCH-01: tầng dòng
    for (const field of [
      "source_request_no",
      "source_version",
      "sku_code",
      "required_qty",
      "matched_qty",
      "scanned_qty",
      "validation_status",
    ]) {
      expect(source).toContain(field);
    }
    // RPT-LABEL-01: printer + actor
    expect(source).toContain("printer_name");
    expect(source).toContain("printed_by_name");
    expect(source).toContain("result.actor_id = actorId");
    // RPT-MOV-01: movement_id là cột đầu (i18n: "Mã biến động", ghim trái)
    expect(source.replace(/\s+/gu, " ")).toContain(
      'title: "Mã biến động", dataIndex: "id", width: 190, fixed: "left"',
    );
    // RPT-IO-01: tầng dòng expected/scanned/posted + filter nơi nhận
    expect(source).toContain("DocumentLines");
    expect(source).toContain("posted_qty");
    expect(source).toContain("result.agency_id = agencyId");
    // RPT-WAR-01: cột khách hàng đã mask + lý do xuất PII
    expect(source).toContain('dataIndex: "customer_name"');
    // WWHN-258 · FE258-P1-04: `reason` chỉ được đính khi actor có
    // `warranty.pii.export` VÀ lý do đủ dài. Assertion cũ chỉ pin
    // `filters.reason = piiReason.trim()`, tức là chấp nhận cả trường hợp gửi
    // reason khi thiếu quyền — thứ mà BE trả 403.
    expect(source).toContain("filters.reason = piiReasonTrimmed");
    // Khớp bằng regex bỏ qua khoảng trắng: điều kiện trải nhiều dòng và Prettier
    // có quyền xuống dòng lại bất cứ lúc nào.
    expect(source.replace(/\s+/gu, " ")).toContain(
      'report === "warranty" && canExportPii && piiReasonTrimmed.length >= PII_REASON_MIN_LENGTH',
    );
  });

  it("keeps all eight baseline report groups", () => {
    const source = read("src/modules/reports/pages/AlignedReportsPage.tsx");
    for (const key of [
      "inventory-balance",
      "xnt",
      "document-history",
      "movement-trace",
      "import-match",
      "label-log",
      "warranty",
      "outbound-by-agency",
    ]) {
      expect(source).toContain(key);
    }
  });
});
