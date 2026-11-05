import { expect, test } from "@playwright/test";

for (const mode of ["light", "dark"]) {
  test(`reconciliation drawer ${mode}: right anchor, responsive content and return`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("hoa-nam-theme", theme),
      mode,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/e2e/fixtures/reconcile-drawer.html", {
      waitUntil: "domcontentloaded",
    });
    const opener = page.getByRole("button", {
      name: "Xem bằng chứng HN-DRV-001",
      exact: true,
    });
    await opener.click();
    const drawer = page.getByRole("dialog", {
      name: /Chi tiết chênh lệch tồn/,
    });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS("transform", "none");
    const back = drawer.getByRole("button", { name: /Quay lại báo cáo/ });
    const body = drawer.locator("[data-ui-drawer-body]");
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await drawer.evaluate((el) => ({
        right: el.getBoundingClientRect().right,
        width: el.getBoundingClientRect().width,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(Math.abs(layout.right - width)).toBeLessThanOrEqual(1);
      expect(layout.width).toBeLessThanOrEqual(820);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
      const headerY = await drawer
        .locator(".rpt02-drill-heading")
        .evaluate((el) => el.getBoundingClientRect().top);
      const actionY = await back.evaluate(
        (el) => el.getBoundingClientRect().top,
      );
      await body.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      expect(
        await drawer
          .locator(".rpt02-drill-heading")
          .evaluate((el) => el.getBoundingClientRect().top),
      ).toBe(headerY);
      expect(await back.evaluate((el) => el.getBoundingClientRect().top)).toBe(
        actionY,
      );
      await expect(back).toBeVisible();
      await body.evaluate((el) => {
        el.scrollTop = 0;
      });
      if (width === 1440 || width === 390)
        await drawer.screenshot({
          path: `test-results/reconcile-drawer/${mode}-${width}.png`,
        });
    }
    await drawer
      .getByRole("button", { name: /Xem phát sinh theo SKU/ })
      .click();
    const flow = page.getByRole("dialog", { name: /Phát sinh theo SKU/ });
    await expect(
      flow.getByText("PN-20261006-001", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(flow).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await back.click();
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
  });
}
