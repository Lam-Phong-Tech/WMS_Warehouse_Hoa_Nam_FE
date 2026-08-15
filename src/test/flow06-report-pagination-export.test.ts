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
    expect(source).toContain('format: "pdf"');
    expect(source.match(/permissionCode="REPORT_EXPORT"/g)?.length).toBeGreaterThanOrEqual(2);
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
