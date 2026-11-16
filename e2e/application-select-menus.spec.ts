import { expect, test } from "@playwright/test";
test.setTimeout(120000);
for (const theme of ["light", "dark"])
  for (const width of [1440, 390]) {
    test(`application selectors use shared menus in ${theme} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (value) => localStorage.setItem("hoa-nam-theme", value),
        theme,
      );
      for (const view of ["trace", "threshold", "export"]) {
        await page.goto(
          `/e2e/fixtures/application-select-menus.html?view=${view}`,
        );
        if (view === "export")
          await page
            .getByRole("button", { name: "Xuất báo cáo", exact: true })
            .click();
        const region =
          view === "trace"
            ? page.locator(".goods-trace-filters")
            : view === "threshold"
              ? page.locator(".threshold-filters")
              : page.getByRole("dialog");
        await expect(region.getByRole("combobox").first()).toBeVisible();
        await expect(region.locator("select")).toHaveCount(0);
        const controls = region.getByRole("combobox");
        for (let i = 0; i < (await controls.count()); i++) {
          const trigger = controls.nth(i);
          const box = (await trigger.boundingBox())!;
          await trigger.click();
          const menu = page.getByRole("listbox");
          await expect(menu).toBeVisible();
          await expect
            .poll(async () =>
              Math.abs(
                (await menu.locator("..").boundingBox())!.width - box.width,
              ),
            )
            .toBeLessThanOrEqual(2);
          const bounds = (await menu.locator("..").boundingBox())!;
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
          if (view === "export") {
            await menu.getByRole("option", { name: /PDF/ }).click();
            await expect(
              page.getByRole("textbox", { name: "Tên tệp xuất" }),
            ).toHaveValue(/\.pdf$/);
          } else await page.keyboard.press("Escape");
        }
        await page.screenshot({
          path: `outputs/app-menu-${view}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    });
  }
for (const width of [1440, 390])
  test(`label preview zoom and printer command use app menus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/e2e/fixtures/packing-label-report.html");
    await page
      .getByRole("button", { name: "Xem chi tiết nhãn PL-20261105-0001" })
      .first()
      .click();
    const detail = page.getByRole("dialog", {
      name: /^Chi tiết nhãn đóng gói/,
    });
    await detail
      .getByRole("button", { name: "Xem trước nhãn", exact: true })
      .click();
    const preview = page.getByRole("dialog", { name: /^Xem trước nhãn/ });
    await expect(preview.locator("select")).toHaveCount(0);
    await preview
      .getByRole("combobox", { name: "Phóng to bản xem trước" })
      .click();
    await page.getByRole("option", { name: "80%", exact: true }).click();
    await expect(preview.locator(".zoom-80")).toBeVisible();
    await preview
      .getByRole("button", { name: "In lại nhãn", exact: true })
      .click();
    const confirm = page.getByRole("dialog", {
      name: "In lại nhãn",
      exact: true,
    });
    await expect(confirm.locator("select")).toHaveCount(0);
    await confirm.getByRole("combobox", { name: "Máy in nhận lệnh" }).click();
    await page.getByRole("listbox").getByRole("option").last().click();
    await expect(
      confirm.getByRole("combobox", { name: "Máy in nhận lệnh" }),
    ).toContainText("TSC");
    expect(
      await confirm.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `outputs/app-menu-print-command-${width}.png`,
      fullPage: false,
    });
  });
