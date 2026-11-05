import { expect, test } from "@playwright/test";

test("report, detail, preview and confirmation fit desktop, tablet and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/e2e/fixtures/packing-label-report.html");
  await expect(page.getByRole("tab", { name: /Lượt in/ })).toBeVisible();
  for (const control of await page
    .locator(
      ".hn-pkg-label__filters .MuiInputBase-root, .hn-pkg-label__filters .hn-vuexy-date-field, .hn-pkg-label__filters > select",
    )
    .all()) {
    expect(Math.round((await control.boundingBox())!.height)).toBe(48);
  }
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const tableRegion = page.getByRole("region", {
      name: "Bảng báo cáo nhãn, cuộn ngang để xem đầy đủ",
    });
    expect(
      await tableRegion.evaluate(
        (node) => node.clientWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/packing-label/report-" + width + ".png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Xem chi tiết nhãn PL-20261105-0001" })
      .first()
      .click();
    const drawer = page.getByRole("dialog", {
      name: /^Chi tiết nhãn đóng gói/,
    });
    await expect(
      drawer.getByText("Lịch sử in nhãn", { exact: true }),
    ).toBeVisible();
    expect(
      await drawer.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    ).toBe(true);
    await expect(
      drawer.getByText("PL-20261105-0001", { exact: true }),
    ).toHaveCount(1);
    const history = drawer.locator(".hn-label-detail__history");
    expect(
      await history.evaluate((root) =>
        [root, ...root.querySelectorAll("*")]
          .filter(
            (node) =>
              node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1,
          )
          .map((node) => node.className),
      ),
    ).toEqual([]);
    await expect(
      history.getByText("Nhãn cũ bị rách, cần thay thế", { exact: true }),
    ).toHaveCount(1);
    await page.screenshot({
      path: "test-results/packing-label/detail-" + width + ".png",
      fullPage: false,
    });
    await drawer
      .getByRole("button", { name: "Xem trước nhãn", exact: true })
      .click();
    const preview = page.getByRole("dialog", { name: /^Xem trước nhãn/ });
    await expect(preview.getByText("100 mm", { exact: true })).toBeVisible();
    await expect(
      preview.getByText("PL-20261105-0001", { exact: true }),
    ).toHaveCount(1);
    await expect(
      preview.getByText("Lịch sử in nhãn", { exact: true }),
    ).toHaveCount(0);
    await expect(
      preview.getByText("Máy khoan dùng pin 20V").first(),
    ).toBeVisible();
    expect(
      await preview.evaluate(
        (node) => node.scrollWidth <= node.clientWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/packing-label/preview-" + width + ".png",
      fullPage: false,
    });
    await preview.getByRole("button", { name: "In lại nhãn", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "In lại nhãn" });
    await expect(
      confirm.getByRole("textbox", { name: /Lý do in lại nhãn/ }),
    ).toBeVisible();
    expect(
      await confirm.evaluate(
        (node) => node.scrollWidth <= node.clientWidth + 1,
      ),
    ).toBe(true);
    await confirm.getByRole("button", { name: "Hủy", exact: true }).click();
    await preview.getByRole("button", { name: "Đóng chi tiết nhãn" }).click();
    await page
      .getByRole("button", { name: "Xuất báo cáo", exact: true })
      .click();
    const exportDrawer = page.getByRole("dialog", {
      name: /^Xuất báo cáo nhãn đóng gói/,
    });
    await expect(
      exportDrawer.getByRole("radio", { name: /Tất cả kết quả/ }),
    ).toBeChecked();
    expect(
      await exportDrawer.evaluate(
        (node) => node.scrollWidth <= node.clientWidth + 1,
      ),
    ).toBe(true);
    await exportDrawer
      .getByRole("button", { name: "Hủy", exact: true })
      .click();
  }
  expect(errors).toEqual([]);
});

test("unknown and missing snapshots are explained and blocked", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/packing-label-report.html");
  await page
    .getByRole("button", { name: "Xem chi tiết nhãn PL-20261105-0006" })
    .click();
  const drawer = page.getByRole("dialog", { name: /^Chi tiết nhãn đóng gói/ });
  await expect(drawer.getByText(/Chưa có phản hồi cuối cùng/)).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "In nhãn", exact: true }),
  ).toBeDisabled();
  await drawer.getByRole("button", { name: "Đóng chi tiết nhãn" }).click();
  await page.getByRole("tab", { name: /Nhãn/ }).click();
  await page
    .getByRole("button", { name: "Xem chi tiết nhãn PL-20261105-0008" })
    .click();
  await expect(
    drawer.getByText("Các lỗi kiểm tra dữ liệu", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Xem trước nhãn", exact: true }),
  ).toBeDisabled();
});

test("empty and error states preserve filters and disable export", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/packing-label-report.html?state=empty");
  await expect(
    page.getByText("Chưa có lượt in trong kỳ", { exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xuất báo cáo", exact: true }),
  ).toBeDisabled();
  await page.goto("/e2e/fixtures/packing-label-report.html?state=error");
  await expect(
    page.getByText("Chưa thể tải lịch sử in", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thử lại", exact: true }),
  ).toBeEnabled();
});

for (const theme of ["light", "dark"]) {
  test(`${theme}: varied print audits fit without horizontal scrolling or repeated fields`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("hoa-nam-theme", value),
      theme,
    );
    for (const audit of ["mixed", "partial"]) {
      await page.goto(`/e2e/fixtures/packing-label-report.html?audit=${audit}`);
      await page
        .getByRole("button", { name: "Xem chi tiết nhãn PL-20261105-0001" })
        .first()
        .click();
      const drawer = page.getByRole("dialog", {
        name: /^Chi tiết nhãn đóng gói/,
      });
      const history = drawer.getByRole("region", { name: "Lịch sử in nhãn" });
      await expect(
        history.getByText("Nguyễn Thanh Quang", { exact: true }),
      ).toHaveCount(1);
      await expect(
        history.getByText(
          "Phạm Quốc Bảo — Quản trị hệ thống chi nhánh Hoa Nam",
          { exact: true },
        ),
      ).toHaveCount(1);
      for (const width of [1440, 1024, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(drawer).toHaveCSS("transform", "none");
        const bounds = await drawer.boundingBox();
        expect(Math.abs(bounds!.x + bounds!.width - width)).toBeLessThanOrEqual(
          1,
        );
        expect(
          await history.evaluate((root) =>
            [root, ...root.querySelectorAll("*")]
              .filter(
                (node) =>
                  node.clientWidth > 0 &&
                  node.scrollWidth > node.clientWidth + 1,
              )
              .map((node) => node.className),
          ),
        ).toEqual([]);
        await expect(history.locator('[aria-current="true"]')).toHaveCount(1);
        const close = drawer.getByRole("button", {
          name: "Đóng chi tiết nhãn",
        });
        const top = await close.evaluate(
          (node) => node.getBoundingClientRect().top,
        );
        await history.scrollIntoViewIfNeeded();
        expect(
          await close.evaluate((node) => node.getBoundingClientRect().top),
        ).toBe(top);
        if (width === 1440 || width === 390)
          await history.screenshot({
            path: `test-results/packing-label/${theme}-${audit}-history-${width}.png`,
          });
      }
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
    }
  });
}
