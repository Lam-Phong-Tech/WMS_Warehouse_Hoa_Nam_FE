import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src/modules/pv/pages/pv-product-catalog.css"),
  "utf8",
);

describe("PV product card layout", () => {
  it("clamps long names and keeps the edit action inside the card", () => {
    expect(css).toContain(
      ".pv-catalog-card-name {\n  min-width: 0;\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n  overflow: hidden;\n  overflow-wrap: anywhere;\n  word-break: break-word;",
    );
    expect(css).toContain(
      ".pv-catalog-card-action {\n  flex: 0 0 auto;\n  margin-left: auto;",
    );
  });
});
