import { expect, test, type Locator } from "@playwright/test";

const longName =
  "Máy khoan với tên sản phẩm dài để kiểm tra đầy đủ dữ liệu truy vết, thông tin nhận diện và trạng thái đối chiếu trong thanh bên";
const longSuffix =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const cases = [
  { mode: "light", width: 1440 },
  { mode: "light", width: 1024 },
  { mode: "light", width: 768 },
  { mode: "light", width: 390 },
  { mode: "light", width: 320 },
  { mode: "dark", width: 390 },
];

async function expectNoHorizontalOverflow(drawer: Locator) {
  expect(
    await drawer.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true);
  for (const record of await drawer
    .locator(".hn-balance-record-list > li")
    .all()) {
    expect(
      await record.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    ).toBe(true);
  }
}

for (const { mode, width } of cases) {
  test(`Trace drawer ${mode} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.addInitScript(
      (theme) => localStorage.setItem("hoa-nam-theme", theme),
      mode,
    );
    await page.goto("/e2e/fixtures/trace-drawer.html", {
      waitUntil: "domcontentloaded",
    });
    const opener = page.getByRole("button", {
      name: "Truy vết phiếu xuất",
      exact: true,
    });
    await opener.click();
    const drawer = page.getByRole("dialog", {
      name: /^Truy vết chứng từ nguồn/,
    });
    await expect(
      drawer.getByText("Đã xuất kho", { exact: true }),
    ).toBeVisible();
    await expect(drawer.getByText("Phiếu xuất", { exact: true })).toBeVisible();
    await expect(
      drawer.getByRole("tab", { name: "Tổng quan", exact: true }),
    ).toBeVisible();
    const bounds = await drawer.boundingBox();
    expect(Math.round(bounds!.x + bounds!.width)).toBe(width);
    expect(bounds!.width).toBeLessThanOrEqual(721);
    await expect(drawer.locator("table")).toHaveCount(0);
    await expect(
      drawer.getByText("technical-request-id-must-not-appear"),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(drawer);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/trace-drawer/overview-${mode}-${width}.png`,
      fullPage: true,
    });

    await drawer
      .getByRole("tab", { name: "Dữ liệu liên quan", exact: true })
      .click();
    const relatedRecords = drawer.locator(".hn-balance-record-list > li");
    await expect(relatedRecords).toHaveCount(10);
    const firstRecord = relatedRecords.first();
    await expect(firstRecord).toContainText("Số lượng: Chưa có");
    await expect(
      drawer.getByText("UNKNOWN_STATE", { exact: true }),
    ).toHaveCount(0);
    await firstRecord.locator("summary").click();
    await expect(
      firstRecord.getByText(longName, { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(drawer);
    await page.screenshot({
      path: `test-results/trace-drawer/related-${mode}-${width}.png`,
      fullPage: true,
    });
    await drawer
      .getByRole("button", { name: "Go to page 2", exact: true })
      .click();
    await expect(relatedRecords).toHaveCount(2);
    await expect(
      drawer.getByText(`SKU-TRACE-011-${longSuffix}`, { exact: true }),
    ).toBeVisible();

    await drawer
      .getByRole("tab", { name: "Lịch sử & điều chỉnh", exact: true })
      .click();
    const chainRecords = drawer.locator(".hn-balance-record-list > li");
    await expect(chainRecords).toHaveCount(10);
    await chainRecords.first().locator("summary").click();
    await expect(
      drawer.getByText(`CHAIN-001-${longSuffix}`, { exact: true }),
    ).toBeVisible();
    await expect(
      drawer.getByText("Nháp → Đã xuất kho", { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(drawer);
    await page.screenshot({
      path: `test-results/trace-drawer/history-${mode}-${width}.png`,
      fullPage: true,
    });
    await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
}

test("Trace source variants, retry, Enter/button physical lookup and warranty", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.goto("/e2e/fixtures/trace-drawer.html", {
    waitUntil: "domcontentloaded",
  });
  const drawer = page.getByRole("dialog", { name: /^Truy vết chứng từ nguồn/ });
  await page
    .getByRole("button", { name: "Truy vết phiếu nhập", exact: true })
    .click();
  await expect(drawer.getByText("Đã nhập kho", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Phiếu nhập", { exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(drawer).toHaveCount(0);

  await page
    .getByRole("button", { name: "Thử lỗi nguồn", exact: true })
    .click();
  const sourceError = drawer.getByText("Không thể truy vết chứng từ nguồn", {
    exact: true,
  });
  await expect(sourceError).toBeVisible();
  const errorBounds = await sourceError.boundingBox();
  const tabsBounds = await drawer.getByRole("tablist").boundingBox();
  expect(errorBounds!.y).toBeLessThan(tabsBounds!.y);
  await drawer.getByRole("button", { name: /Thử lại/ }).click();
  await expect(sourceError).toHaveCount(0);
  await expect(
    drawer.getByText(`PN-TRACE-${longSuffix}`, { exact: true }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(drawer).toHaveCount(0);

  const opener = page.getByRole("button", {
    name: "Mở tra cứu mã vật lý",
    exact: true,
  });
  await opener.click();
  const lookup = drawer.getByRole("textbox", {
    name: "Tra cứu mã vật lý",
    exact: true,
  });
  await lookup.fill("PHYS-ITEM-LONG");
  await lookup.press("Enter");
  await expect(
    drawer.getByText("Máy khoan được nhận diện chính xác bằng mã vật lý"),
  ).toBeVisible();
  await drawer
    .getByRole("tab", { name: "Dữ liệu liên quan", exact: true })
    .click();
  await expect(
    drawer.getByText(`BOX-PHYSICAL-001-${longSuffix}`, { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(drawer);
  await drawer
    .getByRole("tab", { name: "Lịch sử & điều chỉnh", exact: true })
    .click();
  await expect(
    drawer.getByText(`WC-PHYSICAL-${longSuffix}`, { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByText(/Đã tiếp nhận kiểm tra sản phẩm/),
  ).toBeVisible();

  await lookup.fill("BOX-CODE");
  await drawer.getByRole("button", { name: "Tra cứu", exact: true }).click();
  await drawer.getByRole("tab", { name: "Tổng quan", exact: true }).click();
  await expect(
    drawer.getByText(`BOX-RESOLVED-${longSuffix}`, { exact: true }),
  ).toBeVisible();
  await lookup.fill("ERR-RETRY");
  await lookup.press("Enter");
  const lookupError = drawer.getByText("Không tìm thấy mã vật lý", {
    exact: true,
  });
  await expect(lookupError).toBeVisible();
  await drawer.getByRole("button", { name: /Thử lại/ }).click();
  await expect(lookupError).toHaveCount(0);
  await expect(drawer.getByText("ERR-RETRY", { exact: true })).toBeVisible();
  await expect(drawer.locator("table")).toHaveCount(0);
  await expectNoHorizontalOverflow(drawer);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/trace-drawer/physical-lookup-light-390.png",
    fullPage: true,
  });
  await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
});
