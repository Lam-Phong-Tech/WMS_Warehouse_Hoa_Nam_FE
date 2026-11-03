import { expect, test } from "@playwright/test";

for (const mode of ["light", "dark"])
  for (const width of [1440, 1024, 768, 390]) {
    test(`NFC ${mode} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (theme) => localStorage.setItem("hoa-nam-theme", theme),
        mode,
      );
      await page.goto("/e2e/fixtures/nfc.html", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByText("DCPL02-8-000006", { exact: true }).first(),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await expect(page.getByRole("button", { name: "Tất cả sản phẩm 6" })).toBeVisible();
      await expect(page.getByText("04A1B2C3D4E5F6")).toBeVisible();
      await expect(page.getByRole("button", { name: "Gán chip" })).toHaveCount(0);
      await page.screenshot({
        path: `test-results/nfc/items-${mode}-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Xem chi tiết" }).first().click();
      await expect(
        page.getByRole("listitem").filter({ hasText: "Nguyễn Văn Nam" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Thay chip mới" })).toHaveCount(0);
      await page.screenshot({
        path: `test-results/nfc/detail-${mode}-${width}.png`,
        fullPage: true,
      });
    });
  }
