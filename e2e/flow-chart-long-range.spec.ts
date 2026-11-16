import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
  for (const report of ["inbound", "outbound"]) {
    test(`${report} long date range stays inside its chart at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1080 });
      await page.clock.setFixedTime(new Date("2026-11-16T03:00:00Z"));
      await page.goto(
        `/e2e/fixtures/report-tablet.html?report=${report}&dailyBars=1`,
      );
      const bars = page.locator(`.${report}-chart-bar`);
      await expect(bars).toHaveCount(7);
      await page.getByRole("button", { name: "Từ ngày", exact: true }).click();
      await page.getByRole("button", { name: "Năm nay", exact: true }).click();
      await expect(bars).not.toHaveCount(7);
      const geometry = await page
        .locator(`.${report}-chart-plot`)
        .evaluate((plot) => {
          const bounds = plot.getBoundingClientRect();
          const bars = Array.from(
            plot.querySelectorAll('[class$="-chart-bar"]'),
          ).map((el) => el.getBoundingClientRect());
          return {
            bottom: bounds.bottom,
            lastBottom: Math.max(...bars.map((el) => el.bottom)),
            tops: bars.map((el) => el.top),
          };
        });
      expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.bottom + 1);
      expect(
        Math.max(...geometry.tops) - Math.min(...geometry.tops),
      ).toBeLessThan(1);
      await expect(bars).toHaveCount(320);
      const scroll = page.locator(`.${report}-chart-scroll`);
      await scroll.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      await expect(bars.last().locator("small")).toHaveText("16/11");
      const last = await bars.last().boundingBox();
      const viewport = await scroll.boundingBox();
      expect(last!.x + last!.width).toBeLessThanOrEqual(
        viewport!.x + viewport!.width + 1,
      );
      await page.screenshot({
        path: `outputs/${report}-long-range-${width}.png`,
        fullPage: true,
      });
    });
  }
}
