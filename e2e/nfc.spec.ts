import { expect, test } from "@playwright/test";

for (const mode of ["light", "dark"])
  for (const width of [1440, 1024, 768, 390]) {
    test(`NFC ${mode} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (theme) => localStorage.setItem("hoa-nam-theme", theme),
        mode,
      );
      await page.goto("/e2e/fixtures/nfc.html");
      await expect(
        page.getByText("DCPL02-8-000006", { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await expect(page.getByText(/Web dùng để xem/)).toHaveCount(0);
      const info = page.getByRole("button", {
        name: "Thông tin NFC",
        exact: true,
      });
      await info.hover();
      await expect(page.getByRole("tooltip")).toContainText("Web dùng để xem");
      await info.press("Escape");
      await page.mouse.move(0, 0);
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await info.click();
      await expect(page.getByRole("tooltip")).toContainText("Web dùng để xem");
      await info.press("Escape");
      await page.mouse.move(0, 0);
      await page
        .getByRole("button", { name: "Gán chip", exact: true })
        .first()
        .click();
      await expect(
        page.getByText("Vui lòng thao tác qua app", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Đã hiểu" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.screenshot({
        path: `test-results/nfc/items-${mode}-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("tab", { name: "Chip đã đăng ký" }).click();
      await page.getByRole("button", { name: "Xem chi tiết" }).first().click();
      await expect(
        page.getByRole("listitem").filter({ hasText: "Nguyễn Văn Nam" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Thay chip mới" }).click();
      await expect(
        page.getByText("Vui lòng thao tác qua app", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Đã hiểu" }).click();
      await expect(
        page.getByText("Vui lòng thao tác qua app", { exact: true }),
      ).toHaveCount(0);
      await page.screenshot({
        path: `test-results/nfc/detail-${mode}-${width}.png`,
        fullPage: true,
      });
    });
  }
