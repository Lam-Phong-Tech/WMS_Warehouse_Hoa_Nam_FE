import { expect, test } from "@playwright/test";

test("receipt goods and scanned codes fit the compact drawer without horizontal scrolling", async ({
  page,
}) => {
  for (const status of ["POSTED", "SCANNING"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      `/e2e/fixtures/inbound-receipt.html?status=${status}&longCodes=1`,
    );
    await page
      .getByRole("tab", {
        name: status === "POSTED" ? "Hàng hóa" : "Quét hàng",
        exact: true,
      })
      .click();
    const tables = page.locator(".hn-inbound-scan-table table");
    await expect(tables).toHaveCount(2);
    for (const table of await tables.all()) {
      const sizes = await table.evaluate((el) => ({
        table: el.getBoundingClientRect().width,
        available: el.parentElement!.clientWidth,
        scroll: el.parentElement!.scrollWidth,
      }));
      expect(sizes.table).toBeLessThanOrEqual(sizes.available + 1);
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.available + 1);
    }
    await page.screenshot({
      path: `test-results/inbound-receipt/compact-no-scroll-${status}.png`,
    });
  }
});

test("receipt progress remains fully visible alongside inbound list styles", async ({
  page,
}) => {
  for (const width of [1440, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/e2e/fixtures/inbound-receipt.html?status=POSTED");
    const progress = page.getByRole("list", { name: "Tiến trình nhập kho" });
    await expect(progress).toBeVisible();
    const layout = await progress.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        height: rect.height,
        overflow: getComputedStyle(el).overflow,
        contained: [...el.querySelectorAll("li>span")].every((child) => {
          const bounds = child.getBoundingClientRect();
          return bounds.top >= rect.top - 1 && bounds.bottom <= rect.bottom + 1;
        }),
      };
    });
    expect(layout.height).toBeGreaterThanOrEqual(50);
    expect(layout.contained).toBe(true);
    expect(layout.overflow).not.toBe("hidden");
  }
});

test("dark selected receipt tab keeps readable contrast", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("hoa-nam-theme", "dark"));
  await page.goto("/e2e/fixtures/inbound-receipt.html?status=POSTED");
  await page.getByRole("tab", { name: "Tổng quan", exact: true }).waitFor();
  const ratio = await page
    .locator(".hn-inbound-receipt-navigation .Mui-selected")
    .evaluate((el) => {
      const luminance = (color: string) => {
        const channels = (color.match(/[\d.]+/g) || [])
          .slice(0, 3)
          .map(Number)
          .map((v) => v / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const a = luminance(getComputedStyle(el).color),
        b = luminance(
          getComputedStyle(document.querySelector(".MuiDrawer-paper")!)
            .backgroundColor,
        );
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

for (const mode of ["light", "dark"] as const) {
  for (const width of [1440, 1024, 768, 390, 320]) {
    for (const status of ["DRAFT", "SCANNING", "POSTED", "CANCELLED"]) {
      test(`${status} ${mode} ${width}px: approved receipt layout`, async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize({ width, height: 1000 });
        await page.addInitScript(
          (theme) => localStorage.setItem("hoa-nam-theme", theme),
          mode,
        );
        await page.goto(`/e2e/fixtures/inbound-receipt.html?status=${status}`);
        await expect(
          page.getByRole("tab", { name: "Tổng quan", exact: true }),
        ).toBeVisible();
        const mutable = status === "DRAFT" || status === "SCANNING";
        const itemsTab = page.getByRole("tab", {
          name: mutable ? "Quét hàng" : "Hàng hóa",
          exact: true,
        });
        await expect(
          mutable
            ? itemsTab
            : page.getByRole("tab", { name: "Tổng quan", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        await page.getByRole("tab", { name: "Tổng quan", exact: true }).click();
        await expect(
          page.getByText("Ngày giờ cập nhật", { exact: true }),
        ).toHaveCount(0);
        const note = page.locator(".hn-inbound-note__text");
        const collapsed = await note.evaluate((el) => el.clientHeight);
        await page
          .getByRole("button", { name: "Xem thêm", exact: true })
          .click();
        expect(await note.evaluate((el) => el.clientHeight)).toBeGreaterThan(
          collapsed,
        );
        await page
          .getByRole("button", { name: "Thu gọn", exact: true })
          .click();
        await page.screenshot({
          path: `test-results/inbound-receipt/${status}-${mode}-${width}-overview.png`,
        });
        await itemsTab.click();
        if (mutable) {
          await expect(
            page.getByRole("textbox", { name: "Quét mã" }),
          ).toBeFocused();
          if (status === "DRAFT")
            await expect(
              page.getByRole("button", { name: "Ghi nhận nhập", exact: true }),
            ).toBeDisabled();
          else
            await expect(
              page.getByRole("button", { name: "Ghi nhận nhập", exact: true }),
            ).toBeEnabled();
        } else
          await expect(page.locator(".hn-inbound-scan-footer")).toHaveCount(0);
        if (status === "POSTED" || status === "SCANNING") {
          if (width >= 1024) {
            const tables = page.locator(".hn-inbound-scan-table table");
            await expect(tables).toHaveCount(2);
            await expect(tables.nth(0).locator("thead th")).toHaveText([
              "#",
              "SKU",
              "Tên hàng",
              "Loại",
              "ĐVT",
              "SL",
              "Thông tin SKU",
            ]);
            const radius = await tables
              .nth(0)
              .evaluate(
                (el) => getComputedStyle(el.parentElement!).borderRadius,
              );
            expect(radius).toBe("8px");
            const sizes = await tables
              .nth(0)
              .locator("thead th")
              .evaluateAll((cells) =>
                cells.map((cell) => cell.getBoundingClientRect().width),
              );
            expect(sizes[2]).toBeGreaterThan(sizes[6]);
          }
          await expect(
            page.getByText("Camera / mã", { exact: true }),
          ).toBeVisible();
        }
        if (status === "CANCELLED") {
          await expect(
            page.getByText("Phiếu nhập kho đã bị hủy", { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText("Chưa có hàng thực nhận trong phiếu đã hủy."),
          ).toBeVisible();
          await expect(
            page.getByText("Quét mã sản phẩm đầu tiên", { exact: false }),
          ).toHaveCount(0);
        }
        await page.screenshot({
          path: `test-results/inbound-receipt/${status}-${mode}-${width}-goods.png`,
        });
        await page
          .getByRole("tab", { name: "Lịch sử (2)", exact: true })
          .click();
        await expect(page.locator(".hn-inbound-history>li")).toHaveCount(2);
        await expect(
          page.locator(".hn-inbound-history__actor").first(),
        ).toHaveText("nguyễn duy khánh a");
        await expect(
          page.locator(".hn-inbound-history time").last(),
        ).toHaveText("15/11/2026 17:20");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/inbound-receipt/${status}-${mode}-${width}-history.png`,
        });
        expect(errors).toEqual([]);
      });
    }
  }
}
