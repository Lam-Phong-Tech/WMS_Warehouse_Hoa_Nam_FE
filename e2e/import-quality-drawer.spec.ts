import { expect, test } from "@playwright/test";

for (const mode of ["light", "dark"]) {
  test(`import quality ${mode}: right drawer, full issue details, paging and focus`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("hoa-nam-theme", theme),
      mode,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/e2e/fixtures/import-quality-drawer.html", {
      waitUntil: "domcontentloaded",
    });
    const opener = page.getByRole("button", { name: "Mở đợt nhập" });
    await opener.click();
    const drawer = page.getByRole("dialog", { name: /Chi tiết/ });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS("transform", "none");
    await expect(
      drawer.getByText("Kiểm tra lại định dạng mã SKU trong tệp nguồn."),
    ).toBeVisible();
    const body = drawer.locator("[data-ui-drawer-body]");
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await drawer.evaluate((root) => ({
        right: root.getBoundingClientRect().right,
        width: root.getBoundingClientRect().width,
        overflow: [root, ...root.querySelectorAll<HTMLElement>("*")]
          .filter(
            (el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1,
          )
          .map((el) => el.className),
      }));
      expect(Math.abs(layout.right - width)).toBeLessThanOrEqual(1);
      expect(layout.width).toBeLessThanOrEqual(820);
      expect(layout.overflow).toEqual([]);
      const close = drawer.getByRole("button", { name: "Đóng", exact: true });
      const y = await close.evaluate((el) => el.getBoundingClientRect().top);
      await body.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      expect(await close.evaluate((el) => el.getBoundingClientRect().top)).toBe(
        y,
      );
      await body.evaluate((el) => {
        el.scrollTop = 0;
      });
      if (width === 1440 || width === 390)
        await drawer.screenshot({
          path: `test-results/import-quality-drawer/${mode}-${width}.png`,
        });
    }
    await drawer.getByRole("button", { name: /Dòng 45:/ }).click();
    await expect(
      drawer.getByText("Đổi mã SKU bị trùng trước khi nhập lại."),
    ).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: /Dòng 45:/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await drawer.getByRole("button", { name: "Trang dòng lỗi sau" }).click();
    await expect(drawer.getByText("Bổ sung tên SKU trong tệp.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(drawer).toBeHidden();
  });
}
