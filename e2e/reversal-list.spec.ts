import { expect, test } from "@playwright/test";

const cases = [
  { mode: "light", width: 1440 },
  { mode: "light", width: 1024 },
  { mode: "light", width: 768 },
  { mode: "light", width: 390 },
  { mode: "light", width: 320 },
  { mode: "dark", width: 390 },
];

for (const { mode, width } of cases) {
  test(`Reversal list ${mode} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.addInitScript(
      (theme) => localStorage.setItem("hoa-nam-theme", theme),
      mode,
    );
    await page.goto("/e2e/fixtures/reversal-list.html", {
      waitUntil: "domcontentloaded",
    });
    const screen = page.locator(".hn-reversal-screen");
    const title = screen.getByRole("heading", {
      level: 1,
      name: "Danh sách phiếu đảo",
    });
    await expect(title).toHaveCount(1);
    const create = screen.getByRole("button", { name: "Tạo phiếu điều chỉnh" });
    await expect(create).toBeVisible();
    await expect(screen.locator(".hn-reversal-code")).toHaveCount(10);
    if (width >= 768) {
      const titleBox = await title.boundingBox();
      const createBox = await create.boundingBox();
      expect(
        Math.abs(
          titleBox!.y +
            titleBox!.height / 2 -
            createBox!.y -
            createBox!.height / 2,
        ),
      ).toBeLessThanOrEqual(10);
    }

    const filters = screen.locator(".hn-reversal-filters");
    const card = screen.locator(".hn-reversal-list-card");
    const footer = screen.locator(".hn-reversal-pagination");
    const search = filters.getByRole("textbox", { name: "Tìm phiếu đảo" });
    const status = filters.getByRole("combobox", {
      name: "Lọc trạng thái phiếu điều chỉnh",
    });
    await expect(status).toContainText("Trạng thái: Tất cả");
    await expect(filters.getByRole("combobox")).toHaveCount(1);
    const fieldHeights = await filters
      .locator(".MuiOutlinedInput-root")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().height),
      );
    for (const height of fieldHeights)
      expect(Math.abs(height - 48)).toBeLessThanOrEqual(1);
    expect(
      await filters
        .locator("label")
        .evaluateAll((nodes) =>
          nodes.every((node) => node.getBoundingClientRect().height <= 1),
        ),
    ).toBe(true);
    await expect(filters).toHaveCSS("border-top-width", "0px");
    await expect(filters).toHaveCSS("padding-left", "0px");
    await expect(card).toHaveCSS("padding-left", "0px");
    await expect(card).toHaveCSS("padding-right", "0px");
    const filterBox = await filters.boundingBox();
    const cardBox = await card.boundingBox();
    expect(Math.abs(filterBox!.x - cardBox!.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(filterBox!.x + filterBox!.width - cardBox!.x - cardBox!.width),
    ).toBeLessThanOrEqual(1);
    const table = card.locator("table");
    if (await table.count()) {
      await expect(table).toHaveCSS("min-width", "960px");
      const headers = table.locator("thead th");
      const firstHeader = headers.first();
      await expect(firstHeader).toHaveCSS("font-size", "16px");
      await expect(firstHeader).toHaveCSS("line-height", "24px");
      await expect(firstHeader).toHaveCSS("font-weight", "800");
      await expect(firstHeader).toHaveCSS("text-transform", "uppercase");
      await expect(table.locator("th .hn-sortable-th").first()).toHaveCSS(
        "text-transform",
        "uppercase",
      );
      if (mode === "light")
        await expect(firstHeader).toHaveCSS(
          "background-color",
          "rgb(210, 237, 247)",
        );
      await expect(headers.last()).toHaveText("");
      expect(
        await table
          .locator("th .hn-sortable-th > span:first-child")
          .evaluateAll((labels) =>
            labels.every((label) => {
              const cell = label.closest("th")!.getBoundingClientRect();
              const text = label.getBoundingClientRect();
              return text.left >= cell.left - 1 && text.right <= cell.right + 1;
            }),
          ),
      ).toBe(true);
      const firstCell = table.locator("tbody tr td").first();
      await expect(firstCell).toHaveCSS("font-size", "14px");
      await expect(firstCell).toHaveCSS("line-height", "22px");
      const firstRow = await table.locator("tbody tr").first().boundingBox();
      expect(firstRow!.height).toBeGreaterThanOrEqual(67);
      const tableBox = await table.boundingBox();
      expect(Math.abs(tableBox!.x - cardBox!.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(tableBox!.y - cardBox!.y)).toBeLessThanOrEqual(2);
    }
    const rowAction = card.locator('[data-row-action="view"]').first();
    await expect(rowAction).toHaveText("");
    await expect(rowAction).toHaveAttribute("aria-label", "Mở");
    const perPage = footer.getByRole("combobox", { name: "Số dòng mỗi trang" });
    await expect(perPage).toHaveCount(1);
    await expect(footer).toContainText(/Hiển thị.*1.*10.*42/);
    const footerBox = await footer.boundingBox();
    expect(footerBox!.y).toBeGreaterThan(cardBox!.y + 100);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/reversal-list/list-${mode}-${width}.png`,
      fullPage: true,
    });

    await footer
      .getByRole("button", { name: "Go to page 2", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.__reversalRequests.at(-1)))
      .toMatchObject({ page: 2, per_page: 10 });
    await perPage.click();
    await page.getByRole("option", { name: "20 / trang", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.__reversalRequests.at(-1)))
      .toMatchObject({ page: 1, per_page: 20 });
    await expect(screen.locator(".hn-reversal-code")).toHaveCount(20);

    await status.click();
    await page
      .getByRole("option", { name: "Đã ghi sổ phiếu đảo", exact: true })
      .click();
    await expect(status).toContainText("Trạng thái: Đã ghi sổ phiếu đảo");
    await expect
      .poll(() => page.evaluate(() => window.__reversalRequests.at(-1)))
      .toMatchObject({ page: 1, per_page: 20, status: "POSTED" });
    await search.fill("RV-003");
    await expect
      .poll(() => page.evaluate(() => window.__reversalRequests.at(-1)))
      .toMatchObject({
        page: 1,
        per_page: 20,
        status: "POSTED",
        keyword: "RV-003",
      });
    await expect(screen.locator(".hn-reversal-code")).toHaveCount(1);
    await expect(screen.locator(".hn-reversal-code")).toContainText("RV-003-");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
}
