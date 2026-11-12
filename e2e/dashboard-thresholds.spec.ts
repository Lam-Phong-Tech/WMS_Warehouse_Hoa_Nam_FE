import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  test(`${theme}: threshold list pagination, explicit selection and responsive layout`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("hoa-nam-theme", value),
      theme,
    );
    await page.goto("/e2e/fixtures/dashboard-thresholds.html");
    await expect(
      page.getByText("Hiển thị 1–10 / 120 SKU", { exact: true }),
    ).toBeVisible();
    const detail = page.getByRole("region", { name: "Chi tiết định mức" });
    const overflow = () =>
      page
        .locator(".dashboard-threshold-view")
        .evaluate((root) =>
          [root, ...root.querySelectorAll("*")]
            .filter(
              (node) =>
                !node.closest(".MuiTouchRipple-root") &&
                !node.matches(".fi, svg, svg *") &&
                node.tagName !== "INPUT" &&
                node.clientWidth > 0 &&
                node.scrollWidth > node.clientWidth + 1,
            )
            .map((node) => node.className),
        );
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(detail).toHaveCount(0);
      expect(await overflow()).toEqual([]);
      const opener = page.getByRole("button", { name: /^SKU-001-/ });
      if (width === 1440) {
        const header = page.getByRole("columnheader", {
          name: "#",
          exact: true,
        });
        await expect(header).toHaveCSS("font-size", "16px");
        await expect(header).toHaveCSS("line-height", "24px");
        await expect(header).toHaveCSS("font-weight", "800");
        await expect(opener).toHaveCSS("font-size", "14px");
        await expect(opener).toHaveCSS("line-height", "22px");
        await expect(opener).toHaveCSS("font-weight", "700");
        const colors = await header.evaluate((node) => ({
          text: getComputedStyle(node).color,
          background: getComputedStyle(node).backgroundColor,
        }));
        const luminance = (color: string) => {
          const [r, g, b] = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map((value) => {
              const c = Number(value) / 255;
              return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const a = luminance(colors.text),
          b = luminance(colors.background);
        expect(
          (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        ).toBeGreaterThanOrEqual(7);
      }
      await opener.click();
      await expect(detail).toBeVisible();
      await expect(detail.getByRole("heading")).toBeFocused();
      const textColor = await page
        .locator(".dashboard-threshold-view")
        .evaluate((node) => getComputedStyle(node).color);
      await expect(detail.locator("dd").first()).toHaveCSS("color", textColor);
      expect(await overflow()).toEqual([]);
      const list = await page.locator(".threshold-list").boundingBox();
      const pane = await detail.boundingBox();
      if (width === 1440)
        expect(pane!.x).toBeGreaterThan(list!.x + list!.width);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `test-results/dashboard-thresholds/${theme}-${width}.png`,
        });
      await detail
        .getByRole("button", { name: "Đóng chi tiết định mức" })
        .click();
      await expect(detail).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
    await page.getByRole("button", { name: /page 2|trang 2/i }).click();
    await expect(
      page.getByText("Hiển thị 11–20 / 120 SKU", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".system-view-metrics strong").first(),
    ).toHaveText("125");
    await page
      .getByRole("textbox", { name: "Tìm mã hoặc tên SKU" })
      .fill("SKU-125");
    await expect(
      page.getByText("Hiển thị 0–0 / 0 SKU", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Lọc trạng thái định mức").selectOption("all");
    await expect(
      page.getByText("Hiển thị 1–1 / 1 SKU", { exact: true }),
    ).toBeVisible();
    await expect(detail).toHaveCount(0);
    await page.getByRole("button", { name: "Xóa lọc", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Số dòng mỗi trang" })
      .click();
    await page.getByRole("option", { name: "50 / trang" }).click();
    await expect(
      page.getByText("Hiển thị 1–50 / 120 SKU", { exact: true }),
    ).toBeVisible();
    expect(await overflow()).toEqual([]);
  });
}

test("threshold empty and failed sources do not fabricate a detail selection", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/dashboard-thresholds.html?state=empty");
  await expect(
    page.getByText("Hiển thị 0–0 / 0 SKU", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chi tiết định mức" }),
  ).toHaveCount(0);
  await page.goto("/e2e/fixtures/dashboard-thresholds.html?state=error");
  await expect(page.getByRole("alert")).toContainText("Không tải được số liệu");
  await expect(
    page.getByRole("button", { name: "Thử lại", exact: true }),
  ).toBeVisible();
});
