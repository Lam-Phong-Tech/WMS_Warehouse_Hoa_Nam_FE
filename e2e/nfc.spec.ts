import { expect, test } from "@playwright/test";

for (const mode of ["light", "dark"])
  for (const width of [1440, 1024, 768, 390]) {
    test(`NFC ${mode} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (theme) => localStorage.setItem("hoa-nam-theme", theme),
        mode,
      );
      await page.goto("/e2e/fixtures/nfc.html", {
        waitUntil: "domcontentloaded",
      });
      await expect(
        page.getByText("DCPL02-8-000006", { exact: true }).first(),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("combobox", { name: "Trạng thái chip" }),
      ).toBeVisible();
      await expect(page.getByText("04A1B2C3D4E5F6")).toBeVisible();
      await expect(page.getByRole("button", { name: "Gán chip" })).toHaveCount(
        0,
      );
      if (width < 980) {
        const firstRow = await page.locator("tbody tr").nth(0).boundingBox();
        const secondRow = await page.locator("tbody tr").nth(1).boundingBox();
        expect(firstRow!.height).toBeGreaterThan(120);
        expect(secondRow!.y).toBeGreaterThanOrEqual(firstRow!.y + firstRow!.height - 1);
      }
      await page.screenshot({
        path: `test-results/nfc/items-${mode}-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Xem chi tiết" }).first().click();
      await page.getByRole("tab", { name: "Lịch sử liên kết NFC" }).click();
      await expect(
        page.getByRole("listitem").filter({ hasText: "Nguyễn Văn Nam" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Thay chip mới" }),
      ).toHaveCount(0);
      const bounds = await page.getByRole("dialog").boundingBox();
      expect(bounds).not.toBeNull();
      expect(Math.round(bounds!.x + bounds!.width)).toBe(width);
      expect(
        await page
          .getByRole("dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/nfc/detail-${mode}-${width}.png`,
        fullPage: true,
      });
    });
  }
