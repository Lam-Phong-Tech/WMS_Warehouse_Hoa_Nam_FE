import { expect, test, type Locator } from "@playwright/test";

const longSerial =
  "SERIAL-20261104-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const longPhysicalCode =
  "QR-PHYSICAL-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const longNfc = "NFC-04A2B3C4D5E6F701-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789";

async function expectNoHorizontalOverflow(dialog: Locator) {
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true);
  const records = dialog.locator(".hn-balance-record-list > li");
  for (const record of await records.all()) {
    expect(
      await record.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    ).toBe(true);
  }
}

const cases = [
  { mode: "light", width: 1440 },
  { mode: "light", width: 1024 },
  { mode: "light", width: 768 },
  { mode: "light", width: 390 },
  { mode: "light", width: 320 },
  { mode: "dark", width: 390 },
];

for (const { mode, width } of cases) {
  test(`Inventory drawer ${mode} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(
      (theme) => localStorage.setItem("hoa-nam-theme", theme),
      mode,
    );
    await page.goto("/e2e/fixtures/inventory-detail.html", {
      waitUntil: "domcontentloaded",
    });
    const opener = page.getByRole("button", { name: "Mở chi tiết tồn kho" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: /Chi tiết tồn kho/ });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(Math.round(bounds!.x + bounds!.width)).toBe(width);
    expect(bounds!.width).toBeLessThanOrEqual(801);
    await expectNoHorizontalOverflow(dialog);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/inventory-detail/overview-${mode}-${width}.png`,
      fullPage: true,
    });

    await dialog.getByRole("tab", { name: /^Sản phẩm/ }).click();
    const firstProduct = dialog.locator(".hn-balance-record-list > li").first();
    await expect(firstProduct).toBeVisible();
    await expect(dialog.locator("table")).toHaveCount(0);
    await firstProduct.locator("summary").click();
    await expect(firstProduct.locator("details")).toHaveAttribute("open", "");
    await expect(
      firstProduct.getByText(longSerial, { exact: true }),
    ).toBeVisible();
    await expect(
      firstProduct.getByText(longPhysicalCode, { exact: true }),
    ).toBeVisible();
    await expect(
      firstProduct.getByText(longNfc, { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(dialog);
    await page.screenshot({
      path: `test-results/inventory-detail/products-${mode}-${width}.png`,
      fullPage: true,
    });

    await dialog.getByRole("tab", { name: /^Vật chứa/ }).click();
    await expect(
      dialog.getByText("BOX-001-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789", {
        exact: true,
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(dialog);
    await dialog.getByRole("tab", { name: /^Biến động/ }).click();
    await expect(
      dialog.getByText("MV-20261104-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789", {
        exact: true,
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(dialog);
    await dialog.getByRole("button", { name: /Truy vết/ }).click();
    await expect(page.getByLabel("Biến động đã chọn")).toHaveText("movement-1");
    await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
}
