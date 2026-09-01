import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/**
 * Báo cáo vận hành là module `src/modules/reports/**` (8 trang riêng trong
 * sidebar — trước đây 1 shell tab bar bọc 8 tab component — phản hồi người
 * dùng 2026-08-30; xem các trang `*ReportPage.tsx`). Các hợp đồng dưới đây là
 * hợp đồng của MÀN HÌNH chứ không của một file, nên quét toàn bộ module thay
 * vì đọc đúng một đường dẫn — nếu không, chỉ cần đổi chỗ đặt code là guard im
 * lặng mất hiệu lực.
 */
function readReportsModule(): string {
  const root = join(process.cwd(), "src/modules/reports");
  const parts: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/u.test(entry)) parts.push(readFileSync(full, "utf8"));
    }
  };
  walk(root);
  return parts.join("\n");
}

describe("Flow 06 report pagination/export alignment", () => {
  it("wires each report route directly to its own page component", () => {
    const router = read("src/app/router/index.tsx");
    for (const page of [
      "InventoryFlowReportPage",
      "StockReconcileReportPage",
      "TraceabilityReportPage",
      "ImportQualityReportPage",
      "PackingLabelReportPage",
      "WarrantyReportPage",
      "RecipientReportPage",
      "PendingEvidenceReportPage",
    ]) {
      expect(router).toContain(page);
    }
  });

  /**
   * Biểu đồ và bảng của cùng một mục phải mô tả CÙNG một tập dòng, nên báo cáo
   * được gọi KHÔNG kèm `per_page` (BE trả trọn tập đã lọc) và việc cắt trang
   * chuyển hẳn về client.
   */
  it("keeps chart and table on the same filtered row set", () => {
    const source = readReportsModule();
    expect(source).toContain("export function useClientPagination");
    expect(source).toContain("const pageRows = rows.slice(");
    expect(source).toContain("ReportPaginationBar");
    // Trần cuốn trang cho các endpoint BE cắt trang ngay ở tầng SQL.
    expect(source).toContain("WARRANTY_MAX_PAGES");
  });

  it("exposes both XLSX and PDF under report.export", () => {
    const source = readReportsModule();
    expect(source).toContain('onExport("xlsx")');
    expect(source).toContain('onExport("pdf")');
    expect(source).toContain("setExporting(format)");
    expect(
      source.match(/permissionCode="REPORT_EXPORT"/g)?.length,
    ).toBeGreaterThanOrEqual(2);
  });

  /** Annex D SCR-RPT-01: action export trỏ /reports/export, không gọi thẳng file. */
  it("creates the export job through Annex C createReportExport", () => {
    const source = readReportsModule();
    expect(source).toContain("API_ENDPOINTS.REPORTS_EXPORT");
    expect(source).toContain('"Idempotency-Key": createIdempotencyKey()');
    expect(source).toContain("report_code: request.reportCode");
    expect(read("src/shared/api/endpoints.ts")).toContain(
      'REPORTS_EXPORT: "/reports/export"',
    );
  });

  /** BR-EXP-03: tên file có timestamp do BE đặt, client không được tự dựng đè. */
  it("keeps the server-issued export file name", () => {
    const source = readReportsModule();
    expect(source).toContain("fileName ??");
    const httpSource = read("src/shared/api/http.ts");
    expect(httpSource).toContain("downloadFile");
    expect(httpSource).toContain("content-disposition");
  });

  /** §13.10: cột và filter bắt buộc của từng báo cáo phải có mặt trên màn hình. */
  it("renders the mandatory §13.10 columns and filters", () => {
    const source = readReportsModule();
    // RPT-INV-01: tồn kho + đối soát + cập nhật cuối
    expect(source).toContain('dataIndex: "updated_at"');
    expect(source).toContain('dataIndex: "ledger_qty"');
    expect(source).toContain('dataIndex: "variance"');
    // RPT-XNT-01 (WWHN-240): mỗi chiều tách gross · đã đảo · thuần
    for (const field of [
      "receipt_gross",
      "receipt_reversal",
      "receipt_net",
      "issue_gross",
      "issue_reversal",
      "issue_net",
      "component_issue_gross",
      "component_issue_reversal",
      "component_issue_net",
      "reversal_net",
    ]) {
      expect(source).toContain(field);
    }
    // RPT-OUT-MATCH-01: tầng dòng đối soát toa
    for (const field of [
      "source_request_no",
      "sku_code",
      "required_qty",
      "scanned_qty",
      "validation_status",
      "error_code",
    ]) {
      expect(source).toContain(field);
    }
    // RPT-LABEL-01: printer + actor + kết quả in
    expect(source).toContain("printer_name");
    expect(source).toContain("printed_by_name");
    expect(source).toContain("reprint_count");
    // RPT-MOV-01: sổ biến động là nguồn của mọi drill-down
    expect(source).toContain("MovementTable");
    expect(source).toContain("movement_type");
    // RPT-IO-01: tầng dòng expected/scanned/posted + chiều tăng/giảm
    expect(source).toContain("DocumentLinesTable");
    expect(source).toContain("posted_qty");
    // Đổi tên khi chuyển sang i18n: bảng nhãn chiều tăng/giảm nay giữ KHOÁ
    // message thay vì câu tiếng Việt. Guard vẫn pin đúng thứ nó quan tâm — cột
    // "Tăng/Giảm" có mặt — nên chỉ đổi tên ký hiệu.
    expect(source).toContain("DIRECTION_LABEL_KEYS");
    // RPT-WAR-01: cột khách hàng đã mask + lý do xuất PII
    expect(source).toContain("warrantyPiiText");
    expect(source).toContain("piiReasonTrimmed");
    // Khớp bằng regex bỏ qua khoảng trắng: điều kiện trải nhiều dòng và Prettier
    // có quyền xuống dòng lại bất cứ lúc nào.
    expect(source.replace(/\s+/gu, " ")).toContain(
      "canExportPii && piiReasonTrimmed.length >= PII_REASON_MIN_LENGTH",
    );
  });

  it("keeps the eight operations report routes", () => {
    const routes = read("src/shared/constants/routes.ts");
    for (const path of [
      "/reports/inventory-flow",
      "/reports/stock-reconcile",
      "/reports/traceability",
      "/reports/import-quality",
      "/reports/packing-label",
      "/reports/warranty",
      "/reports/recipient",
      "/reports/pending-evidence",
    ]) {
      expect(routes).toContain(path);
    }
  });

  /** Mọi report_code gửi lên /reports/export phải là code BE thật đang phục vụ. */
  it("only exports report codes the backend serves", () => {
    const source = readReportsModule();
    const codes = [
      ...new Set(
        (source.match(/reportCode:\s*"([a-z-]+)"/gu) ?? []).map(
          (match) => match.split('"')[1],
        ),
      ),
    ];
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect([
        "inventory-balance",
        "inventory-xnt",
        "document-history",
        "movement-trace",
        "import-match",
        "label-log",
        "warranty-defects",
        "outbound-by-agency",
      ]).toContain(code);
    }
  });
});
