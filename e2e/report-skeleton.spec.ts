import { expect, test, type Page } from "@playwright/test";
import type { SkeletonGeometry } from "../src/shared/ui/loading/content-skeleton-geometry";

declare global {
  interface Window {
    measureSkeletonGeometry: (root: HTMLElement) => SkeletonGeometry | null;
  }
}

async function openFixture(page: Page, name: string) {
  await page.goto(`/e2e/fixtures/report-skeleton.html?report=${name}`);
  await expect(page.getByTestId("content-matched-skeleton")).toBeVisible();
  // Font completion legitimately changes text rectangles. Compare settled
  // geometry rather than treating a fallback-font measurement as a baseline.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function projectedShapes(page: Page) {
  return page
    .locator(".hn-content-skeleton__shape")
    .evaluateAll((elements) => elements.map((el) => el.getAttribute("style")));
}

test("closed report dropdown adds no menu shapes; projection follows opening and closing", async ({
  page,
}) => {
  await openFixture(page, "visibility");
  const before = await projectedShapes(page);
  const source = page.getByTestId("visibility-source");
  // Compare a closed menu with the same menu physically absent from measurement.
  const comparison = await source.evaluate((root) => {
    const before = window.measureSkeletonGeometry(root);
    const menu = root.querySelector(".inbound-filter-combobox__menu")!;
    menu.setAttribute("data-skeleton-ignore", "true");
    const withoutMenu = window.measureSkeletonGeometry(root);
    menu.removeAttribute("data-skeleton-ignore");
    return { before, withoutMenu };
  });
  expect(comparison.before).toEqual(comparison.withoutMenu);
  const trigger = source.locator(".inbound-filter-combobox__trigger");
  await trigger.evaluate((element: HTMLButtonElement) => element.click());
  await expect
    .poll(async () => (await projectedShapes(page)).length)
    .toBeGreaterThan(before.length);
  await trigger.evaluate((element: HTMLButtonElement) => element.click());
  await expect.poll(() => projectedShapes(page)).toEqual(before);
});

test("collapsed advanced filters keep their summary and update without a page resize", async ({
  page,
}) => {
  await openFixture(page, "visibility");
  const before = await projectedShapes(page);
  const details = page.getByTestId("advanced");
  const comparison = await details.evaluate((details) => {
    const root = document.querySelector<HTMLElement>(
      '[data-testid="visibility-source"]',
    )!;
    const before = window.measureSkeletonGeometry(root);
    const body = details.querySelector("div")!;
    body.setAttribute("data-skeleton-ignore", "true");
    const withoutBody = window.measureSkeletonGeometry(root);
    body.removeAttribute("data-skeleton-ignore");
    return { before, withoutBody };
  });
  expect(comparison.before).toEqual(comparison.withoutBody);
  await details.evaluate((element: HTMLDetailsElement) => {
    element.open = true;
  });
  await expect
    .poll(async () => (await projectedShapes(page)).length)
    .toBe(before.length + 2);
  await details.evaluate((element: HTMLDetailsElement) => {
    element.open = false;
  });
  await expect.poll(() => projectedShapes(page)).toEqual(before);
});

const screens = [
  "inventory",
  "outbound",
  "stock",
  "trace",
  "quality",
  "packing",
  "warranty",
  "recipient",
  "history",
  "history-legacy",
];

for (const width of [1920, 1024, 768]) {
  for (const report of ["inventory", "outbound"]) {
    test(`${report} native placeholders stay inside their cards and retain KPI lines ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1080 });
      await openFixture(page, report);
      const prefix = report === "inventory" ? "inbound" : "outbound";
      const metrics = await page.evaluate((prefix) => {
        const panels = Array.from(
          document.querySelectorAll<HTMLElement>(
            `.${prefix}-chart-panel,.${prefix}-progress-panel`,
          ),
        );
        const overflow = panels.flatMap((panel) => {
          const edge =
            panel.getBoundingClientRect().bottom -
            parseFloat(getComputedStyle(panel).paddingBottom);
          return Array.from(
            panel.querySelectorAll(
              `.${prefix}-chart-skeleton,.${prefix}-progress-skeleton,.${prefix}-pending-callout`,
            ),
          ).map((el) => ({
            className: el.className,
            overflow: el.getBoundingClientRect().bottom - edge,
          }));
        });
        const lines = Array.from(
          document.querySelectorAll(
            `.${prefix}-skeleton-card .${prefix}-skeleton--label,.${prefix}-skeleton-card .${prefix}-skeleton--value,.${prefix}-skeleton-card .${prefix}-skeleton--note`,
          ),
        ).map((el) => el.getBoundingClientRect().width);
        return { overflow, lines };
      }, prefix);
      expect(metrics.lines).toHaveLength(12);
      for (const line of metrics.lines) expect(line).toBeGreaterThan(10);
      for (const slot of metrics.overflow)
        expect(slot.overflow, slot.className).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: `test-results/report-skeleton/${report}-native-${width}.png`,
        fullPage: true,
      });
    });
  }
}
for (const width of [1920, 1024, 768]) {
  for (const theme of ["light", "dark"]) {
    for (const screen of screens) {
      test(`${screen} pending layout ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1080 });
        await page.addInitScript(
          (theme) => localStorage.setItem("hoa-nam-theme", theme),
          theme,
        );
        await openFixture(page, screen);
        const source = page.locator(".hn-loading-boundary__content");
        const result = await source.evaluate((root: HTMLElement) => {
          const before = window.measureSkeletonGeometry(root)!;
          // Removing genuinely hidden DOM must not change the projected report.
          const hidden = Array.from(
            root.querySelectorAll<HTMLElement>("*"),
          ).filter((el) => getComputedStyle(el).opacity === "0");
          const collapsed = Array.from(
            root.querySelectorAll("details:not([open])"),
          ).flatMap((el) =>
            Array.from(el.children).filter(
              (child) => child.tagName !== "SUMMARY",
            ),
          );
          for (const el of [...hidden, ...collapsed])
            el.setAttribute("data-skeleton-ignore", "true");
          const withoutHidden = window.measureSkeletonGeometry(root)!;
          for (const el of [...hidden, ...collapsed])
            el.removeAttribute("data-skeleton-ignore");
          return {
            before,
            withoutHidden,
            docWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            visibility: getComputedStyle(root).visibility,
          };
        });
        expect(result.before).toEqual(result.withoutHidden);
        expect(result.before.shapes.length).toBeGreaterThan(4);
        expect(result.visibility).toBe("hidden");
        expect(result.scrollWidth).toBeLessThanOrEqual(result.docWidth + 1);
        for (const shape of result.before.shapes) {
          expect(shape.x).toBeGreaterThanOrEqual(0);
          expect(shape.y).toBeGreaterThanOrEqual(0);
          expect(shape.x + shape.width).toBeLessThanOrEqual(
            result.before.width + 1,
          );
          expect(shape.y + shape.height).toBeLessThanOrEqual(
            result.before.height + 1,
          );
        }
        await expect(
          page
            .getByTestId("content-matched-skeleton")
            .locator("input,button,select,a"),
        ).toHaveCount(0);
        await page.screenshot({
          path: `test-results/report-skeleton/${screen}-${width}-${theme}.png`,
          fullPage: true,
        });
      });
    }
  }
}
