import { expect, test, type Locator } from "@playwright/test";

const typography = (locator: Locator) =>
  locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      family: style.fontFamily,
      size: style.fontSize,
      weight: style.fontWeight,
      lineHeight: style.lineHeight,
    };
  });

const textContrast = (locator: Locator) =>
  locator.evaluate((node) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const over = (front: number[], back: number[]) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [
        ...[0, 1, 2].map((index) =>
          alpha
            ? (front[index] * front[3] +
                back[index] * back[3] * (1 - front[3])) /
              alpha
            : 0,
        ),
        alpha,
      ];
    };
    const luminance = (color: number[]) =>
      color.slice(0, 3).reduce((sum, channel, index) => {
        const v = channel / 255;
        const linear = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        return sum + linear * [0.2126, 0.7152, 0.0722][index];
      }, 0);
    let element: Element | null = node;
    let background = [0, 0, 0, 0];
    let foreground = rgba(getComputedStyle(node).color);
    while (element) {
      const style = getComputedStyle(element);
      const candidate = rgba(style.backgroundColor);
      foreground = over(foreground, candidate);
      background = over(background, candidate);
      foreground[3] *= Number(style.opacity);
      background[3] *= Number(style.opacity);
      element = element.parentElement;
    }
    const a = luminance(over(foreground, [255, 255, 255, 1]));
    const b = luminance(over(background, [255, 255, 255, 1]));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });

for (const mode of ["light", "dark"] as const) {
  for (const width of [1440, 390]) {
    test(`warranty codes match rendered SKU typography without hover underline at ${width}px ${mode}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 960 });
      await page.addInitScript((theme) => {
        localStorage.setItem("hoa-nam-theme", theme);
      }, mode);
      await page.goto("/e2e/fixtures/warranty-typography.html?reference");
      const sku = page.locator('.sku-table [data-testid="sku-code"]').first();
      await expect(sku).toBeVisible();
      const reference = await typography(sku);
      expect(reference.family).toContain("Inter");
      expect(reference).toMatchObject({
        size: "15px",
        weight: "600",
        lineHeight: "22px",
      });

      await page.goto("/e2e/fixtures/warranty-typography.html");
      const warranty = page.getByRole("button", { name: "WC-20261104-003" });
      await expect(warranty).toBeVisible();
      expect(await typography(warranty)).toEqual(reference);
      // A nested strong/b must not silently promote the visible text to 900.
      for (const child of await warranty.locator("*").all()) {
        expect(await typography(child)).toEqual(reference);
      }

      await warranty.hover();
      await expect(warranty).toHaveCSS("text-decoration-line", "none");
      expect(await typography(warranty)).toEqual(reference);
      expect(await textContrast(warranty)).toBeGreaterThanOrEqual(4.5);
      await warranty.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(warranty).toBeFocused();
      expect(
        await warranty.evaluate((node) => node.matches(":focus-visible")),
      ).toBe(true);
      await expect(warranty).toHaveCSS("outline-style", "solid");
      await expect(warranty).toHaveCSS("outline-width", "2px");
      await expect(warranty).toHaveCSS("text-decoration-line", "none");
      await page.screenshot({
        path: `test-results/warranty-typography/${mode}-${width}.png`,
        fullPage: true,
      });
    });
  }
}
