import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src/modules/pv/pages/pv-product-catalog.css"),
  "utf8",
);

describe("PV catalog filter menu presentation", () => {
  it("bolds the selected row and fades unselected rows in both dropdown types", () => {
    expect(css).toContain(
      `.pv-catalog-menu .MuiMenuItem-root.Mui-selected,
.pv-catalog-menu .MuiAutocomplete-option[aria-selected="true"] {
  color: var(--pv-heading);
  font-weight: 600;
}`,
    );
    expect(css).toContain(
      `.pv-catalog-menu .MuiMenuItem-root:not(.Mui-selected),
.pv-catalog-menu .MuiAutocomplete-option:not([aria-selected="true"]) {
  color: var(--pv-muted);
  font-weight: 400;
}`,
    );
  });
});
