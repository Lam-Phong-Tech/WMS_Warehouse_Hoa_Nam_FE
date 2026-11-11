import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("topbar tablet responsive guard", () => {
  const shellCss = read("src/app/layouts/system-shell.css");

  it("hides the breadcrumb at tablet widths so the search field cannot clip it", () => {
    expect(shellCss).toContain(
      ".hn-system-shell:not(.hn-map-shell) .hn-topbar .topbar-breadcrumb {\n    display: none;",
    );
    expect(shellCss).toContain(
      ".hn-system-shell:not(.hn-map-shell) .hn-topbar .topbar-search-wrap {\n    flex: 1 1 auto;",
    );
  });

  it("keeps the desktop breadcrumb and narrow search width unchanged", () => {
    expect(shellCss).toContain(
      ".hn-system-shell:not(.hn-map-shell) .hn-topbar .topbar-breadcrumb {\n  display: flex;",
    );
    expect(shellCss).toContain(
      ".hn-system-shell:not(.hn-map-shell) .hn-topbar .topbar-search-wrap {\n  flex: 0 1 365px;",
    );
  });
});
