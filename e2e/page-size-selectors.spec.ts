import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectSingleLineOptions(page: Page) {
  for (const option of await page.getByRole("option").all()) {
    await expect(option).toHaveCSS("white-space", "nowrap");
    const geometry = await option.evaluate((node) => {
      // Ignore element rectangles from MUI's focus ripple; measure text only.
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const textTops = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        textTops.push(
          ...[...range.getClientRects()].map((rect) => Math.round(rect.top)),
        );
      }
      return {
        lines: new Set(textTops).size,
        fits: node.scrollWidth <= node.clientWidth + 1,
      };
    });
    expect(geometry.lines, (await option.textContent()) ?? "option").toBe(1);
    expect(geometry.fits, (await option.textContent()) ?? "option").toBe(true);
  }
}

async function inspectMenu(page: Page, control: Locator, unit: string) {
  await control.scrollIntoViewIfNeeded();
  await control.click();
  await expect(
    page.getByRole("option", { name: `50 / ${unit}`, exact: true }),
  ).toBeVisible();
  await expectSingleLineOptions(page);
  await page.keyboard.press("Escape");
}

for (const [language, unit] of [
  ["vi", "trang"],
  ["en", "page"],
  ["zh", "页"],
]) {
  test.describe(language, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((language) => {
        localStorage.setItem(
          "erp-language",
          JSON.stringify({ state: { language }, version: 0 }),
        );
      }, language);
    });
    for (const [width, theme] of [
      [1536, "light"],
      [390, "dark"],
      [320, "light"],
    ] as const) {
      test(`shared adapters ${language} ${theme} ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(
          (theme) => localStorage.setItem("hoa-nam-theme", theme),
          theme,
        );
        await page.goto("/e2e/fixtures/page-size-selectors.html");
        const controls = page.getByRole("combobox");
        await expect(controls).toHaveCount(4);
        for (const control of await controls.all())
          await inspectMenu(page, control, unit);
        const first = controls.first();
        await first.click();
        await page
          .getByRole("option", { name: `20 / ${unit}`, exact: true })
          .click();
        await expect(first).toHaveText(`20 / ${unit}`);
        await first.click();
        await expectSingleLineOptions(page);
        await page.screenshot({
          path: `test-results/page-size/shared-${language}-${theme}-${width}.png`,
        });
      });
    }

    for (const width of [390, 1536]) {
      test(`outbound page ${language} ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/e2e/fixtures/outbound-audit.html?sidebar=76");
        const control = page.locator(
          ".hn-outbound-page-info [role='combobox']",
        );
        await inspectMenu(page, control, unit);
        await control.click();
        await page.screenshot({
          path: `test-results/page-size/outbound-${language}-${width}.png`,
        });
      });
      test(`SKU page ${language} ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/e2e/fixtures/ui-contrast.html");
        const control = page.locator(".hn-sku-pagination [role='combobox']");
        await inspectMenu(page, control, unit);
      });
    }
  });
}
