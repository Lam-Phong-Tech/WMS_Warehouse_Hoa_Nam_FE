// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function stylesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? stylesIn(path)
      : entry.name.endsWith(".css")
        ? [path]
        : [];
  });
}

const reportStyles = stylesIn(join(process.cwd(), "src/modules/reports"));

// Report pages can remain in the DOM while hidden by KeepAliveOutlet.
// A report :has() selector must never hide or restyle shared topbar controls:
// language, appearance and shortcuts belong to the shell, not to a report.
describe("report styles do not control global topbar actions", () => {
  it("audits the report stylesheet tree rather than an empty fixture", () => {
    expect(reportStyles.length).toBeGreaterThan(0);
  });

  it.each(reportStyles)("isolates %s from the shared controls", (path) => {
    const css = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css, relative(process.cwd(), path)).not.toMatch(
      /\.(?:header-control|header-menu-toggle|topbar-actions|language-toggle)\b|#(?:language|theme|shortcut)-menu\b/,
    );
  });
});
