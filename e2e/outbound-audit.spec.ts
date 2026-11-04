import { expect, test, type Page } from "@playwright/test";

async function openFixture(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/e2e/fixtures/outbound-audit.html", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByText("PX-AUDIT-0001", { exact: true })).toBeVisible();
}

async function showToast(page: Page) {
  await page.getByRole("button", { name: "Hiện thông báo thử" }).click();
  const toast = page
    .locator('[data-sonner-toast][data-type="success"]')
    .first();
  await expect(toast).toHaveAttribute("data-mounted", "true");
  await expect(toast).toContainText("Đã cập nhật phiếu");
  await expect(toast).toHaveCSS("opacity", "1");
  return toast;
}

for (const width of [1440, 390]) {
  test(`outbound overview placement, toggle and aligned filters at ${width}px`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await openFixture(page, width);
    const toggle = page.locator(".hn-outbound-overview-toggle");
    const intake = page.getByRole("button", {
      name: "Tiếp nhận yêu cầu xuất",
      exact: true,
    });
    const toggleBox = await toggle.boundingBox();
    const intakeBox = await intake.boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(intakeBox).not.toBeNull();
    expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(
      intakeBox!.x + 1,
    );
    expect(Math.abs(toggleBox!.y - intakeBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.round(toggleBox!.height)).toBe(40);
    expect(Math.round(intakeBox!.height)).toBe(40);
    await expect(intake).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(toggle.locator(".fi-rr-chart-histogram")).toBeVisible();
    await expect(toggle.locator(".fi-rr-angle-small-down")).toHaveCount(0);
    const overview = page.locator("#hn-outbound-overview");
    await expect(overview).toBeVisible();
    await toggle.click();
    await expect(overview).not.toBeVisible();
    await toggle.click();
    await expect(overview).toBeVisible();
    const filters = await page.locator(".hn-outbound-filters").boundingBox();
    const table = await page.locator(".hn-outbound-table-region").boundingBox();
    expect(Math.abs(filters!.x - table!.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(filters!.x + filters!.width - table!.x - table!.width),
    ).toBeLessThanOrEqual(1);
    const search = await page
      .locator(".hn-outbound-search-field")
      .boundingBox();
    const sort = await page.locator(".hn-outbound-sort").boundingBox();
    expect(Math.abs(search!.x - table!.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(sort!.x + sort!.width - table!.x - table!.width),
    ).toBeLessThanOrEqual(1);
    const controls = page.locator(
      ".hn-outbound-filters .MuiOutlinedInput-root",
    );
    await expect(controls).toHaveCount(4);
    for (const control of await controls.all()) {
      const dimensions = await control.evaluate((node) => {
        const outer = node.getBoundingClientRect();
        const input = node
          .querySelector(".MuiInputBase-input")
          ?.getBoundingClientRect();
        return {
          height: outer.height,
          top: outer.top,
          bottom: outer.bottom,
          inputTop: input?.top,
          inputBottom: input?.bottom,
        };
      });
      expect(Math.round(dimensions.height)).toBe(48);
      expect(dimensions.inputTop).toBeDefined();
      expect(dimensions.inputTop!).toBeGreaterThanOrEqual(dimensions.top - 1);
      expect(dimensions.inputBottom!).toBeLessThanOrEqual(
        dimensions.bottom + 1,
      );
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/outbound-audit/overview-${width}.png`,
      fullPage: true,
    });
    await showToast(page);
    await page.screenshot({
      path: `test-results/outbound-audit/overview-toast-${width}.png`,
      fullPage: true,
    });
    expect(pageErrors).toEqual([]);
  });
}

for (const width of [500, 620]) {
  test(`toast keeps reference width and mobile offset at ${width}px`, async ({
    page,
  }) => {
    await openFixture(page, width);
    const toast = await showToast(page);
    const region = page.locator(".app-toaster");
    await expect
      .poll(async () => Math.round((await region.boundingBox())!.width))
      .toBe(390);
    expect(await region.evaluate((node) => getComputedStyle(node).top)).toBe(
      "74px",
    );
    await expect(toast.locator("[data-description]")).toHaveCSS(
      "font-size",
      "12px",
    );
    await page.screenshot({
      path: `test-results/outbound-audit/toast-${width}.png`,
      fullPage: true,
    });
  });
}

test("reduced motion removes sliding but keeps the three-second countdown", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page, 620);
  const toast = await showToast(page);
  const first = await toast.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      transition: style.transitionDuration,
      animation: style.animationName,
      duration: style.animationDuration,
      size: style.backgroundSize,
    };
  });
  expect(
    first.transition.split(",").every((duration) => parseFloat(duration) === 0),
  ).toBe(true);
  expect(first.animation).toBe("hn-toast-count");
  expect(first.duration).toBe("3s");
  expect(first.size).toContain("3px");
  await page.waitForTimeout(250);
  const nextSize = await toast.evaluate(
    (node) => getComputedStyle(node).backgroundSize,
  );
  expect(parseFloat(nextSize)).toBeLessThan(parseFloat(first.size));
});
