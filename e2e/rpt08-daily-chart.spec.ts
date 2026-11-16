import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
  for (const days of [7, 47, 366]) {
    test(`daily chart contains ${days} days without overlapping the table at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/e2e/fixtures/rpt08-daily-chart.html?days=${days}`);
      const groups = page.locator(".rpt08-bar-group");
      await expect(groups.first()).toBeVisible();
      const geometry = await page
        .locator(".rpt08-chart-card")
        .evaluate((card) => {
          const bounds = card.getBoundingClientRect();
          const days = Array.from(
            card.querySelectorAll(".rpt08-bar-group"),
          ).map((el) => el.getBoundingClientRect());
          return {
            bottom: bounds.bottom,
            lastBottom: Math.max(...days.map((el) => el.bottom)),
            tops: days.map((el) => el.top),
            pageWidth: document.documentElement.scrollWidth,
            viewport: innerWidth,
          };
        });
      expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.bottom);
      expect(
        Math.max(...geometry.tops) - Math.min(...geometry.tops),
      ).toBeLessThan(1);
      expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport);
      await expect(groups).toHaveCount(days);
      const plot = page.locator(".rpt08-plot");
      await plot.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      await expect(groups.last().locator(".is-inbound b")).toHaveText("1");
      const last = await groups.last().boundingBox();
      const scroll = await plot.boundingBox();
      expect(last!.x + last!.width).toBeLessThanOrEqual(
        scroll!.x + scroll!.width + 1,
      );
      const table = await page.getByTestId("following-table").boundingBox();
      expect(last!.y + last!.height).toBeLessThan(table!.y);
      if (days === 47 && width === 1440)
        await page.screenshot({
          path: "outputs/rpt08-long-range.png",
          fullPage: true,
        });
    });
  }
}
