import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src/modules/master-data/pages/defect-list.css"),
  "utf8",
);

describe("DEF-01 table text colors", () => {
  it("keeps row numbers and descriptions on the same ink as the other columns", () => {
    expect(css).toContain(
      ".hn-defect-screen table.defect-table td.stt-col {\n  color: var(--defect-ink);",
    );
    expect(css).toContain(
      ".hn-defect-screen table.defect-table td.description-col {\n  color: var(--defect-ink);",
    );
  });
});
