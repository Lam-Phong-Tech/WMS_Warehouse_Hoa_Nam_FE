import { expect, test, type Locator } from "@playwright/test";

// Measure the browser's resolved colors, including CSS variables and ancestors.
async function contrast(node: Locator, property = "color") {
  return node.evaluate((element, prop) => {
    // Canvas normalizes rgb(), color-mix() and color(srgb ...) alike.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const rgba = (value: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const over = (front: number[], back: number[]) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [
        ...[0, 1, 2].map((i) =>
          alpha
            ? (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha
            : 0,
        ),
        alpha,
      ];
    };
    const luminance = (color: number[]) =>
      color
        .slice(0, 3)
        .map((c) => {
          const v = c / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    let parent: Element | null = element;
    let background = [0, 0, 0, 0];
    let foreground = rgba(getComputedStyle(element).getPropertyValue(prop));
    while (parent) {
      const style = getComputedStyle(parent);
      const candidate = rgba(style.backgroundColor);
      foreground = over(foreground, candidate);
      background = over(background, candidate);
      foreground[3] *= Number(style.opacity);
      background[3] *= Number(style.opacity);
      parent = parent.parentElement;
    }
    foreground = over(foreground, [255, 255, 255, 1]);
    background = over(background, [255, 255, 255, 1]);
    const a = luminance(foreground),
      b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, property);
}

for (const theme of ["light", "dark"]) {
  for (const width of [1440, 1024, 768, 390, 320]) {
    test(`${theme} ${width}px: table and hover arrows remain readable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (value) => localStorage.setItem("hoa-nam-theme", value),
        theme,
      );
      await page.goto("/e2e/fixtures/ui-contrast.html", {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator(".sku-table tbody tr")).toHaveCount(1);
      const header = page.locator(".sku-table th").nth(1);
      expect(await contrast(header)).toBeGreaterThanOrEqual(4.5);
      for (const arrow of [
        page.locator(".hn-sku-detail-link"),
        page.getByRole("button", { name: "Mũi tên dùng chung" }),
      ]) {
        await arrow.scrollIntoViewIfNeeded();
        expect(await contrast(arrow)).toBeGreaterThanOrEqual(3);
        await arrow.hover();
        await page.waitForTimeout(200); // Color transitions must finish before measuring.
        expect(await contrast(arrow)).toBeGreaterThanOrEqual(3);
        await arrow.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(arrow).toBeFocused();
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
        expect(await contrast(arrow)).toBeGreaterThanOrEqual(3);
      }
      await page.screenshot({
        path: `test-results/ui-contrast/table-${theme}-${width}.png`,
      });
    });

    test(`${theme} ${width}px: drawer headings, boundaries and surface stay clear`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (value) => localStorage.setItem("hoa-nam-theme", value),
        theme,
      );
      await page.goto("/e2e/fixtures/ui-contrast.html", {
        waitUntil: "domcontentloaded",
      });
      await page.locator(".hn-sku-detail-link").click();
      const drawer = page.getByRole("dialog", { name: "Chi tiết SKU" });
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveCSS("background-image", "none");
      expect(
        await contrast(drawer.locator(".hn-sku-detail-top strong")),
      ).toBeGreaterThanOrEqual(7);
      expect(
        await contrast(drawer.locator("h3").first()),
      ).toBeGreaterThanOrEqual(7);
      for (const [selector, side] of [
        [".hn-sku-detail-top", "bottom"],
        [".hn-sku-detail-section", "top"],
        [".hn-sku-detail-footer", "top"],
      ]) {
        const boundary = drawer.locator(selector).first();
        await expect(boundary).toHaveCSS(`border-${side}-width`, "1px");
        expect(
          await contrast(boundary, `border-${side}-color`),
        ).toBeGreaterThanOrEqual(3);
      }
      expect(
        await drawer.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/ui-contrast/drawer-${theme}-${width}.png`,
      });
      await drawer.getByRole("button", { name: "Đóng chi tiết" }).click();
      await page.getByRole("button", { name: "Mở drawer dùng chung" }).click();
      const shared = page.getByRole("dialog", { name: "Drawer dùng chung" });
      await expect(shared).toBeVisible();
      await expect(shared).toHaveCSS("background-image", "none");
      const heading = shared.getByRole("heading", {
        name: "Drawer dùng chung",
      });
      expect(await contrast(heading)).toBeGreaterThanOrEqual(7);
      for (const [boundary, side] of [
        [heading.locator(".."), "bottom"],
        [shared.locator("[data-ui-drawer-actions]"), "top"],
      ] as const) {
        await expect(boundary).toHaveCSS(`border-${side}-width`, "1px");
        expect(
          await contrast(boundary, `border-${side}-color`),
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }
}
