import { expect, test, type Locator } from "@playwright/test";

const qtySku = "SKU-QTY-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789";
const itemSku = "SKU-SERIAL-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789";
const serialOne = "SERIAL-CANDIDATE-001-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789";
const infoBody =
  "Hệ thống tạo một giao dịch điều chỉnh đối ứng thay vì sửa hoặc xóa giao dịch gốc. Các giới hạn số lượng và điều kiện phụ thuộc được kiểm tra tự động trước khi ghi nhận.";

async function expectNoHorizontalOverflow(drawer: Locator) {
  expect(
    await drawer.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true);
  for (const row of await drawer
    .locator(".hn-reversal-movement-list > li, .hn-reversal-line-list > li")
    .all()) {
    expect(
      await row.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
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
  test(`Create reversal ${mode} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.addInitScript(
      (theme) => localStorage.setItem("hoa-nam-theme", theme),
      mode,
    );
    await page.goto("/e2e/fixtures/reversal-create.html", {
      waitUntil: "domcontentloaded",
    });
    const opener = page.getByRole("button", { name: "Mở tạo phiếu đảo" });
    await opener.click();
    const drawer = page.getByRole("dialog", {
      name: /^Tạo phiếu đảo(?:$|\s)/,
    });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".hn-reversal-movement-list > li")).toHaveCount(
      5,
    );
    await expect(drawer.locator("table")).toHaveCount(0);
    const bounds = await drawer.boundingBox();
    expect(Math.round(bounds!.x + bounds!.width)).toBe(width);
    expect(bounds!.width).toBeLessThanOrEqual(801);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await expectNoHorizontalOverflow(drawer);

    const info = drawer.getByRole("button", {
      name: "Thông tin tạo phiếu đảo",
      exact: true,
    });
    await expect(drawer.getByText(infoBody, { exact: true })).toHaveCount(0);
    await info.hover();
    await expect(page.getByRole("tooltip")).toContainText(infoBody);
    await page.mouse.move(0, 0);
    await expect(page.getByRole("tooltip")).toBeHidden();
    await info.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("tooltip")).toContainText(infoBody);
    await drawer
      .getByRole("textbox", { name: "Tìm giao dịch có thể điều chỉnh" })
      .click();
    await expect(page.getByRole("tooltip")).toBeHidden();
    await page.screenshot({
      path: `test-results/reversal-create/movements-${mode}-${width}.png`,
      fullPage: true,
    });
    if (width === 1440) {
      await drawer
        .getByRole("button", { name: "Go to page 2", exact: true })
        .click();
      await expect(
        drawer.locator(".hn-reversal-movement-list > li"),
      ).toHaveCount(3);
      await drawer
        .getByRole("button", { name: "Go to page 1", exact: true })
        .click();
      await expect(
        drawer.locator(".hn-reversal-movement-list > li"),
      ).toHaveCount(5);
    }

    const blocked = drawer
      .locator(".hn-reversal-movement-list > li")
      .filter({ hasText: "BLOCKED-003-" });
    await expect(blocked).toContainText(/bị chặn|phụ thuộc/i);
    if (!(await blocked.getByRole("button").isDisabled())) {
      await blocked.getByRole("button").click();
      await expect(
        drawer.getByRole("button", {
          name: "Tạo phiếu điều chỉnh",
          exact: true,
        }),
      ).toBeDisabled();
      await drawer.getByRole("button", { name: /Chọn giao dịch$/ }).click();
    }
    const receipt = drawer
      .locator(".hn-reversal-movement-list > li")
      .filter({ hasText: "RCPT-001-" });
    await receipt.getByRole("button").click();
    await expect(drawer.locator(".hn-reversal-line-list > li")).toHaveCount(3);
    await expect(drawer.locator("table")).toHaveCount(0);
    const qty = drawer.getByRole("textbox", {
      name: `Số lượng điều chỉnh ${qtySku}`,
      exact: true,
    });
    await qty.fill("3");
    const reason = drawer.getByRole("textbox", { name: /Lý do điều chỉnh/ });
    await reason.fill("  Đối chiếu lại chứng từ nhập kho  ");
    const serial = drawer.getByRole("button", {
      name: `Chọn hiện vật / máy cần đảo cho ${itemSku}`,
      exact: true,
    });
    await serial.click();
    const itemOption = page
      .getByRole("menuitem")
      .filter({ hasText: serialOne });
    await itemOption.click();
    await page.keyboard.press("Escape");
    await expect(
      drawer.getByRole("button", { name: "Tạo phiếu điều chỉnh", exact: true }),
    ).toBeDisabled();
    await serial.click();
    await page.getByRole("menuitem").filter({ hasText: serialOne }).click();
    await page.keyboard.press("Escape");
    await expect(
      drawer.getByRole("button", { name: "Tạo phiếu điều chỉnh", exact: true }),
    ).toBeEnabled();
    await expectNoHorizontalOverflow(drawer);
    await page.screenshot({
      path: `test-results/reversal-create/lines-${mode}-${width}.png`,
      fullPage: true,
    });

    await drawer.getByRole("button", { name: /Chọn giao dịch$/ }).click();
    await drawer.getByRole("button", { name: /Nhập điều chỉnh$/ }).click();
    await expect(qty).toHaveValue("3");
    await expect(reason).toHaveValue("  Đối chiếu lại chứng từ nhập kho  ");

    if (width === 1440 || width === 320) {
      await drawer.getByRole("button", { name: /Chọn giao dịch$/ }).click();
      const issue = drawer
        .locator(".hn-reversal-movement-list > li")
        .filter({ hasText: "ISSUE-002-" });
      await issue.getByRole("button").click();
      await expect(
        drawer.getByRole("combobox", { name: "Tình trạng hàng trả về" }),
      ).toBeVisible();
      const physical = drawer.getByRole("checkbox", {
        name: "Xác nhận hàng vật lý đã quay lại kho",
      });
      await expect(physical).not.toBeChecked();
      const submit = drawer.getByRole("button", {
        name: "Tạo phiếu điều chỉnh",
        exact: true,
      });
      await expect(submit).toBeDisabled();
      await drawer
        .getByRole("combobox", { name: "Tình trạng hàng trả về" })
        .click();
      await page.getByRole("option", { name: "Hàng lỗi", exact: true }).click();
      await physical.check();
      await expect(submit).toBeEnabled();
      await expectNoHorizontalOverflow(drawer);
      await submit.click();
      const confirmation = page.getByRole("dialog", {
        name: "Tạo phiếu đảo?",
        exact: true,
      });
      await expect(confirmation).toBeVisible();
      await expect(confirmation).toContainText("Hàng lỗi");
      await confirmation
        .getByRole("button", { name: "Tạo phiếu điều chỉnh", exact: true })
        .click();
      await expect(page.getByLabel("Phiếu vừa tạo")).toHaveText(
        "RV-FIXTURE-CREATED",
      );
      const posts = await page.evaluate(() => window.__reversalCreatePosts);
      expect(posts).toHaveLength(1);
      expect(posts[0].body).toMatchObject({
        reference_document_id: "outbound-1",
        reference_document_type: "OUTBOUND",
        reason: "Đối chiếu lại chứng từ nhập kho",
        return_condition: "DEFECTIVE",
        physical_return_confirmed: true,
      });
      expect(posts[0].headers).toMatchObject({
        "If-Match": "7",
        "Idempotency-Key": expect.any(String),
      });
      expect(posts[0].body).toMatchObject({
        lines: expect.arrayContaining([
          { sku: qtySku, reversal_qty: 8 },
          { sku: itemSku, reversal_qty: 1, item_id: "item-1" },
          { sku: itemSku, reversal_qty: 1, item_id: "item-2" },
        ]),
      });
    } else {
      await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
    }
    await expect(drawer).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
}
