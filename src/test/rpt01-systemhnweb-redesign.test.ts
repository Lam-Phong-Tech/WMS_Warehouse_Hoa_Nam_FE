import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("RPT-01 SystemHNWeb redesign", () => {
  it("keeps document drill-down bound to the selected document", () => {
    const source = read(
      "src/modules/reports/inventory-flow/InventoryFlowXntReport.tsx",
    );
    expect(source).toContain("const [documentDrill, setDocumentDrill]");
    expect(source).toContain("openDocumentDrill(document, event.currentTarget)");
    expect(source).toContain("documentDrill.document.document_no");
    expect(source).toContain("rpt01-document-detail-title");
    expect(source).not.toContain(
      "openDrill(document.drillKey, event.currentTarget)",
    );
  });

  it("uses the approved blue primary and touch-safe controls", () => {
    const css = read(
      "src/modules/reports/inventory-flow/inventory-flow-report.css",
    );
    expect(css).toContain("--primary: #0b63ce");
    expect(css).toContain(".report-clear-button");
    expect(css).toContain("@media (pointer: coarse)");
    expect(css).toContain("min-height: 48px");
    expect(css).toContain(".formula-labeled");
    expect(css).toContain(".document-modal-grid");
  });
});
