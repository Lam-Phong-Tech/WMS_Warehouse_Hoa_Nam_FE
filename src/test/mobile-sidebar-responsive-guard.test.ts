import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("mobile sidebar responsive guard", () => {
  const shellCss = read("src/app/layouts/system-shell.css");
  const layoutSource = read("src/app/layouts/MainLayout.tsx");

  it("keeps the MUI Drawer paper on the dark SystemHN surface", () => {
    expect(shellCss).toContain(".MuiDrawer-paper.hn-system-drawer");
    expect(shellCss).toContain("background-color: var(--map-navy)");
    expect(shellCss).toContain(
      'url("/assets/systemhn/sidebar-warehouse-generated-fixed.webp")',
    );

    // Independent MUI sx fallback: a future CSS injection-order change must not
    // be able to turn white sidebar text/icons into invisible content again.
    expect(layoutSource).toContain('backgroundColor: "var(--map-navy)"');
    expect(layoutSource).toContain(
      'url("/assets/systemhn/sidebar-warehouse-generated-fixed.webp")',
    );
  });

  it("keeps navigation scrollable inside the viewport instead of clipping it", () => {
    expect(shellCss).toContain(".hn-system-drawer .hn-sidebar-content");
    expect(shellCss).toContain("height: 100dvh");
    expect(shellCss).toContain(
      '.hn-system-drawer nav[data-testid="primary-navigation"]',
    );
    expect(shellCss).toContain("flex: 1 1 auto");
    expect(shellCss).toContain("overflow-y: auto");
    expect(shellCss).toContain("overscroll-behavior: contain");
  });

  it("caps drawer width for narrow phones", () => {
    expect(layoutSource).toContain(
      'width: `min(${SYSTEM_SIDEBAR_WIDTH}px, calc(100vw - 40px))`',
    );
    expect(layoutSource).toContain('maxWidth: "88vw"');
  });
});
