import { expect, test } from "@playwright/test";

for (const scenario of [
  "oversize",
  "format",
  "missing-code",
  "corrupt",
  "server-size",
  "timeout",
]) {
  test(`SKU import ${scenario}: one Vietnamese message and safe recovery`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/e2e/fixtures/sku-import-errors.html?case=${scenario}`, {
      waitUntil: "domcontentloaded",
    });
    const check = page.getByRole("button", {
      name: "Kiểm tra trước",
      exact: true,
    });
    await expect(check).toBeVisible();
    await page.getByLabel("Chọn tệp Excel chứa SKU").setInputFiles({
      name: scenario === "format" ? "sku.txt" : "sku.xlsx",
      mimeType:
        scenario === "format"
          ? "text/plain"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer:
        scenario === "oversize"
          ? Buffer.alloc(1024 * 1024 + 1)
          : Buffer.from("read-only fixture"),
    });
    const local = scenario === "oversize" || scenario === "format";
    if (!local) {
      await expect(check).toBeEnabled();
      await check.click();
    }
    const expected = {
      oversize: "File quá lớn. Tối đa 1 MB",
      format: "Chỉ nhận tệp định dạng .xlsx, .xls. Hãy chọn lại tệp.",
      "missing-code":
        "Tệp thiếu cột Mã SKU. Hãy tải tệp mẫu và bổ sung cột này.",
      corrupt:
        "Tệp Excel không hợp lệ hoặc đã bị hỏng. Hãy dùng tệp mẫu và chọn lại.",
      "server-size": "File quá lớn. Tối đa 10 MB",
      timeout: "Yêu cầu quá thời gian, vui lòng thử lại.",
    }[scenario]!;
    await expect(page.getByRole("alert")).toHaveCount(1);
    await expect(page.getByRole("alert")).toHaveText(expected);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    expect(await page.evaluate(() => window.__skuImportUploads)).toBe(
      local ? 0 : 1,
    );
    if (local) await expect(check).toBeDisabled();
    else {
      await expect(check).toBeEnabled();
      await expect(
        page.getByRole("button", { name: "Nhập dữ liệu", exact: true }),
      ).toBeDisabled();
    }
    await expect(
      page.getByRole("button", { name: "Làm lại", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: `test-results/sku-import-errors/${scenario}.png`,
    });
    if (scenario === "timeout") {
      await check.click();
      await expect
        .poll(() => page.evaluate(() => window.__skuImportUploads))
        .toBe(2);
      await expect(check).toBeEnabled();
      await expect(page.getByRole("alert")).toHaveCount(1);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    }
  });
}
