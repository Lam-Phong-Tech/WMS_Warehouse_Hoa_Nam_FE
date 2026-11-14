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
    await expect(drawer.getByText("Nguyễn Văn An")).toBeVisible();
    await expect(drawer.getByText("2 KB")).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "Tải file gốc", exact: true }),
    ).toBeEnabled();
    await expect(
      drawer.getByText("Dòng hợp lệ", { exact: true }),
    ).toBeVisible();
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
      for (const version of await drawer
        .locator(".rpt04-batch-history > button")
        .all()) {
        const bounds = await version.evaluate((button) => ({
          bottom: button.getBoundingClientRect().bottom,
          textBottom: button
            .querySelector("span > span:last-child")!
            .getBoundingClientRect().bottom,
        }));
        expect(bounds.textBottom).toBeLessThanOrEqual(bounds.bottom);
      }
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
    await drawer
      .getByRole("region", { name: "Kết quả ghi dữ liệu" })
      .scrollIntoViewIfNeeded();
    await drawer.screenshot({
      path: `test-results/import-quality-drawer/${mode}-320-result.png`,
    });
    await drawer.getByRole("button", { name: /Dòng 45:/ }).click();
    await expect(
      drawer.getByText("Đổi mã SKU bị trùng trước khi nhập lại."),
    ).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: /Dòng 45:/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await drawer.getByRole("button", { name: "Trang dòng lỗi sau" }).click();
    await expect(drawer.getByText("Bổ sung tên SKU trong tệp.")).toBeVisible();
    await drawer.getByRole("button", { name: /Phiên bản 1/ }).click();
    await expect(
      drawer.getByRole("button", { name: /Phiên bản 1/ }),
    ).toHaveAttribute("aria-pressed", "true");
    const writes = drawer.getByRole("region", { name: "Kết quả ghi dữ liệu" });
    await expect(writes.locator("dd").first()).toHaveText("5");
    await expect(
      drawer.getByText("Không có dòng lỗi đã lưu cho phiên bản này."),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(drawer).toBeHidden();
  });
}

test("downloads the selected result and creates a new recheck version", async ({
  page,
}) => {
  await page.route(
    "**/api/v1/skus/import-reports/batch-v1/result-file",
    (route) =>
      route.fulfill({
        status: 200,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers: {
          "Content-Disposition": 'attachment; filename="sku-result-v1.xlsx"',
        },
        body: "workbook",
      }),
  );
  await page.route("**/api/v1/skus/import-reports/batch-v1/recheck", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          import_report_id: "batch-v3",
          source_file_id: "source-1",
          result_version: 3,
          file_name: "sku.xlsx",
          mode: "DRY_RUN",
          status: "VALID",
          total_rows: 5,
          valid_rows: 5,
          error_rows: 0,
          row_errors: [],
          source_file_available: true,
          update_existing: false,
          actor_name: "Người kiểm tra",
          created_at: "2026-11-14T04:00:00Z",
          actual_inserted_rows: 0,
          actual_updated_rows: 0,
          not_written_rows: 5,
        },
      },
    }),
  );
  await page.route("**/api/v1/skus/import-reports/batch-v3/rows**", (route) =>
    route.fulfill({
      json: { success: true, data: [], meta: { total: 0, last_page: 1 } },
    }),
  );
  await page.goto("/e2e/fixtures/import-quality-drawer.html");
  await page.getByRole("button", { name: "Mở đợt nhập" }).click();
  const drawer = page.getByRole("dialog", { name: /Chi tiết/ });
  await drawer.getByRole("button", { name: /Phiên bản 1/ }).click();
  const downloading = page.waitForEvent("download");
  await drawer
    .getByRole("button", { name: "Tải báo cáo kết quả", exact: true })
    .click();
  expect((await downloading).suggestedFilename()).toBe("sku-result-v1.xlsx");
  await drawer
    .getByRole("button", { name: "Kiểm tra lại", exact: true })
    .click();
  await expect(
    drawer.getByRole("button", { name: /Phiên bản 3/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    drawer.getByRole("button", { name: /Phiên bản 1/ }),
  ).toBeVisible();
  await expect(
    drawer
      .getByRole("region", { name: "Kết quả ghi dữ liệu" })
      .locator("dd")
      .last(),
  ).toHaveText("5");
});
