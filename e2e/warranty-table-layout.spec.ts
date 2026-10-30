import { expect, test } from "@playwright/test";

for (const width of [360, 1024, 1920]) {
  test(`long warranty identifiers stay within their cells at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("/e2e/fixtures/warranty-report.html", {
      waitUntil: "domcontentloaded",
    });
    const row = page.locator("#warranty-row-long-identifiers");
    await expect(row).toBeVisible();
    // DOM text remains complete; both identifier lines must clip inside their own cell.
    const caseCell = row.locator("td").nth(1);
    for (const line of await caseCell.locator(":scope > *").all()) {
      await expect(line).toHaveAttribute("title", await line.innerText());
      await expect(line).toHaveCSS("overflow", "hidden");
      await expect(line).toHaveCSS("text-overflow", "ellipsis");
      const bounds = await line.boundingBox();
      const cell = await caseCell.boundingBox();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
        cell!.x + cell!.width + 1,
      );
    }
    for (const index of [2, 3]) {
      const cell = row.locator("td").nth(index);
      await expect(cell).toHaveCSS("overflow", "hidden");
    }
    if (width === 1920)
      await page.screenshot({
        path: "test-results/warranty-table/fixed-desktop.png",
        fullPage: true,
      });
  });
}
