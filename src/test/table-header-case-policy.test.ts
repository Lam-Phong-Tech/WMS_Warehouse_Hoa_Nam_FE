import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
const guide = readFileSync(
  join(process.cwd(), "docs/ui/DESIGN_FOUNDATIONS.md"),
  "utf8",
);

describe("table header casing policy", () => {
  it("keeps every table header in sentence case instead of all caps", () => {
    expect(css).toContain("table th,\ntable th *,\n[role=\"columnheader\"],");
    expect(css).toContain("text-transform: none !important;");
    expect(guide).toContain("chỉ viết hoa chữ cái đầu");
  });
});
