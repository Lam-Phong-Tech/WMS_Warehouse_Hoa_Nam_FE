import { expect, test, type Locator } from "@playwright/test";

const cases = [
  { mode: "light", width: 1440, sidebar: 300 },
  { mode: "light", width: 1280, sidebar: 300 },
  { mode: "light", width: 1440, sidebar: 76 },
  { mode: "light", width: 1024, sidebar: 300 },
  { mode: "light", width: 390, sidebar: 0 },
  { mode: "light", width: 320, sidebar: 0 },
  { mode: "dark", width: 390, sidebar: 0 },
];

async function expectFilterLayout(screen: Locator) {
  const filters = screen.locator(".hn-inbound-filters");
  const controls = filters.locator(
    ":scope > .hn-inbound-filter, :scope > .hn-inbound-more-filters, :scope > .hn-inbound-clear-filters",
  );
  const boxes = await controls.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  const width = (await screen.boundingBox())!.width;
  for (const box of boxes)
    expect(Math.abs(box.height - 48)).toBeLessThanOrEqual(1);
  if (width > 900) {
    expect(
      Math.max(...boxes.map((box) => box.y)) -
        Math.min(...boxes.map((box) => box.y)),
    ).toBeLessThanOrEqual(1);
  } else if (width > 560) {
    expect(boxes[0].width).toBeGreaterThan(width - 2);
    expect(Math.abs(boxes[1].y - boxes[2].y)).toBeLessThanOrEqual(1);
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
  } else {
    expect(boxes[1].width).toBeGreaterThan(width - 2);
    expect(boxes[2].width).toBeGreaterThan(width - 2);
    expect(boxes[2].y).toBeGreaterThan(boxes[1].y);
  }
  for (let index = 0; index < boxes.length; index++) {
    for (let next = index + 1; next < boxes.length; next++) {
      const a = boxes[index],
        b = boxes[next];
      const overlaps =
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
      expect(overlaps).toBe(false);
    }
  }
  const selectMetrics = await filters
    .getByRole("combobox")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        label: node.getAttribute("aria-label"),
        text: node.textContent,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        width: node.getBoundingClientRect().width,
      })),
    );
  for (const metrics of selectMetrics) {
    expect(
      metrics.scrollWidth,
      JSON.stringify(selectMetrics),
    ).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(
      metrics.scrollHeight,
      JSON.stringify(selectMetrics),
    ).toBeLessThanOrEqual(metrics.clientHeight + 1);
  }
  const filterBox = (await filters.boundingBox())!;
  const tableBox = (await screen
    .locator(".hn-inbound-list-card")
    .boundingBox())!;
  expect(Math.abs(filterBox.x - tableBox.x)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(filterBox.x + filterBox.width - tableBox.x - tableBox.width),
  ).toBeLessThanOrEqual(1);
}

for (const { mode, width, sidebar } of cases) {
  test(`Inbound filters ${mode} ${width}px sidebar${sidebar}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.addInitScript(
      (theme) => localStorage.setItem("hoa-nam-theme", theme),
      mode,
    );
    await page.goto(`/e2e/fixtures/inbound-filters.html?sidebar=${sidebar}`, {
      waitUntil: "domcontentloaded",
    });
    const screen = page.locator(".hn-inbound-list");
    await expect(screen.locator("tbody tr")).toHaveCount(10);
    const filters = screen.locator(".hn-inbound-filters");
    await expect(filters.locator(":scope > *")).toHaveCount(4);
    await expectFilterLayout(screen);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/inbound-filters/default-${mode}-${width}-sidebar${sidebar}.png`,
      fullPage: true,
    });

    const more = filters.getByRole("button", { name: "Bộ lọc", exact: true });
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const sort = screen.getByRole("combobox", {
      name: "Sắp xếp danh sách phiếu nhập",
      exact: true,
    });
    await expect(sort).toBeVisible();
    await sort.click();
    await page.getByRole("option", { name: "Cũ nhất", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.__inboundFilterRequests.at(-1)))
      .toMatchObject({ sort_order: "asc", page: 1 });
    await expectFilterLayout(screen);
    const search = filters.getByRole("textbox", {
      name: "Tìm phiếu nhập",
      exact: true,
    });
    const status = filters.getByRole("combobox", {
      name: "Lọc trạng thái phiếu nhập",
      exact: true,
    });
    const info = filters.getByRole("combobox", {
      name: "Lọc phiếu theo tình trạng thông tin SKU",
      exact: true,
    });
    await status.click();
    await page
      .getByRole("option", { name: "Trạng thái: Đã nhập kho", exact: true })
      .click();
    await info.click();
    await page.getByRole("option", { name: /Chờ bổ sung thông tin/ }).click();
    await expect
      .poll(() => page.evaluate(() => window.__inboundFilterRequests.at(-1)))
      .toMatchObject({ status: "POSTED", pending_product_info: true });
    await expectFilterLayout(screen);
    await info.click();
    await page.getByRole("option", { name: /Đã đủ thông tin/ }).click();
    await search.fill("PN-003");
    await expect
      .poll(() => page.evaluate(() => window.__inboundFilterRequests.at(-1)))
      .toMatchObject({
        keyword: "PN-003",
        status: "POSTED",
        pending_product_info: false,
        sort_order: "asc",
        page: 1,
      });
    await expect(screen.locator("tbody tr")).toHaveCount(1);
    await expectFilterLayout(screen);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/inbound-filters/active-${mode}-${width}-sidebar${sidebar}.png`,
      fullPage: true,
    });

    await filters.getByRole("button", { name: "Xóa lọc", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(status).toContainText("Trạng thái: Tất cả");
    await expect(info).toContainText("Thông tin SKU: Tất cả");
    await expect(
      filters.getByRole("button", { name: "Xóa lọc", exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const params = window.__inboundFilterRequests.at(-1)!;
          return {
            keyword: params.keyword ?? null,
            status: params.status ?? null,
            pending: params.pending_product_info ?? null,
            sort: params.sort_order,
          };
        }),
      )
      .toEqual({ keyword: null, status: null, pending: null, sort: "desc" });
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(sort).toBeHidden();
    if (width === 1440 && sidebar === 300) {
      await page
        .getByRole("button", { name: "Thu gọn thanh bên", exact: true })
        .click();
      await expect(
        page.getByRole("complementary", { name: "Thanh bên mẫu 76px" }),
      ).toBeVisible();
      await expectFilterLayout(screen);
    }
  });
}
