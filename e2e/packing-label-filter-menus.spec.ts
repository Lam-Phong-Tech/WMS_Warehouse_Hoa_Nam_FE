import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  for (const width of [1440, 768, 390]) {
    test(`packing label filters use application menus at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (value) => localStorage.setItem("hoa-nam-theme", value),
        theme,
      );
      await page.goto("/e2e/fixtures/packing-label-report.html?audit=mixed");
      await expect(page.getByRole("tab", { name: /Lượt in/ })).toBeVisible();
      await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
      await expect(
        page.locator(
          ".hn-pkg-label__filters select, .hn-pkg-label__extra-filters select",
        ),
      ).toHaveCount(0);
      for (const [name, allLabel] of [
        ["Trạng thái", "Kết quả: Tất cả"],
        ["Máy in", "Máy in: Tất cả"],
        ["Người thực hiện", "Người in: Tất cả"],
        ["Loại lượt in", "Loại lượt: Tất cả"],
      ]) {
        const trigger = page.getByRole("combobox", { name, exact: true });
        const triggerBox = (await trigger.boundingBox())!;
        await trigger.click();
        const menu = page.getByRole("listbox");
        await expect(menu).toBeVisible();
        await expect(
          menu.getByRole("option", { name: allLabel, exact: true }),
        ).toHaveCount(1);
        const paper = menu.locator("..");
        await expect
          .poll(async () =>
            Math.abs((await paper.boundingBox())!.width - triggerBox.width),
          )
          .toBeLessThanOrEqual(2);
        const paperBox = (await paper.boundingBox())!;
        expect(paperBox.x).toBeGreaterThanOrEqual(0);
        expect(paperBox.x + paperBox.width).toBeLessThanOrEqual(width + 1);
        const option = menu.getByRole("option").nth(1);
        const selected = await option.innerText();
        await option.click();
        await expect(trigger).toHaveText(selected);
        await trigger.click();
        await menu.getByRole("option", { name: allLabel, exact: true }).click();
        await expect(trigger).toHaveText(allLabel);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.getByRole("combobox", { name: "Máy in", exact: true }).click();
      await page.screenshot({
        path: `outputs/packing-label-menu-${theme}-${width}.png`,
        fullPage: true,
      });
    });
  }
}
