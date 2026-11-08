import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  for (const width of [1440, 1024, 768, 390, 320]) {
    test(`detail drawer ${theme} ${width}px shows all line fields without horizontal scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (value) => localStorage.setItem("hoa-nam-theme", value),
        theme,
      );
      await page.goto("/e2e/fixtures/reversal-detail.html", {
        waitUntil: "domcontentloaded",
      });
      const opener = page.getByRole("button", { name: "Mở chi tiết" });
      await opener.click();
      const drawer = page.getByRole("dialog", {
        name: /Chi tiết phiếu điều chỉnh/,
      });
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveCSS("transform", "none");
      await expect(drawer.getByRole("article")).toHaveCount(10);
      const box = await drawer.boundingBox();
      expect(Math.abs(box!.x + box!.width - width)).toBeLessThanOrEqual(1);
      expect(box!.width).toBeLessThanOrEqual(820);
      const overflows = await drawer.evaluate((root) =>
        [root, ...root.querySelectorAll<HTMLElement>("*")]
          .filter(
            (el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1,
          )
          .map((el) => `${el.tagName}.${el.className}`),
      );
      expect(overflows).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const line = drawer.getByRole("article").first();
      await expect(line.locator("dd")).toHaveCount(7);
      await expect(line.getByText("Có thể bán/xuất lại")).toBeVisible();
      if (theme === "light" && (width === 1440 || width === 390)) {
        await line.scrollIntoViewIfNeeded();
        await page.screenshot({ path: test.info().outputPath("drawer.png") });
      }
      const heading = drawer.getByRole("heading", {
        name: /Chi tiết phiếu điều chỉnh/,
      });
      const headingY = (await heading.boundingBox())!.y;
      await drawer.locator("[data-ui-drawer-body]").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      expect((await heading.boundingBox())!.y).toBe(headingY);
      await drawer
        .locator(".MuiPagination-ul button")
        .filter({ hasText: /^2$/ })
        .click();
      await expect(drawer.getByRole("article")).toHaveCount(2);
      await expect(drawer.getByRole("article").last()).toHaveAttribute(
        "aria-label",
        /^12 ·/,
      );
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(opener).toBeFocused();
      await opener.click();
      await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
      await expect(drawer).toBeHidden();
    });
  }
}
