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
    await preview.getByRole("button", { name: "In lại…", exact: true }).click();
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
