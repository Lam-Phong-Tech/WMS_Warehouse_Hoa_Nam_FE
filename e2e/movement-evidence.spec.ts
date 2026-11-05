import { expect, test } from "@playwright/test";

for (const mode of ["light", "dark"]) {
  test(`movement evidence ${mode}: responsive summary, fixed action and focus`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("hoa-nam-theme", theme),
      mode,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/e2e/fixtures/movement-evidence.html", {
      waitUntil: "domcontentloaded",
    });
    const opener = page.getByRole("button", { name: "Mở bằng chứng" });
    await opener.click();
    const drawer = page.getByRole("dialog", { name: /Bằng chứng biến động/ });
    const trace = drawer.getByRole("button", { name: "Truy vết mã vật lý" });
    await expect(trace).toBeVisible();
    await expect(drawer).toHaveCSS("transform", "none");
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
      expect(layout.width).toBeLessThanOrEqual(640);
      expect(layout.overflow).toEqual([]);
      await expect(trace).toBeVisible();
      const actionY = await trace.evaluate(
        (el) => el.getBoundingClientRect().top,
      );
      await drawer.locator("[data-ui-drawer-body]").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      expect(await trace.evaluate((el) => el.getBoundingClientRect().top)).toBe(
        actionY,
      );
      await drawer.locator("[data-ui-drawer-body]").evaluate((el) => {
        el.scrollTop = 0;
      });
      if (width === 1440 || width === 390)
        await drawer.screenshot({
          path: `test-results/movement-evidence/${mode}-${width}.png`,
        });
    }
    await trace.click();
    await expect(page.locator("body")).toHaveAttribute("data-traced", "true");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
  });
}
