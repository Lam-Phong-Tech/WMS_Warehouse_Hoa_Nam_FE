import { test, expect, type Page } from "@playwright/test";

async function open(page: Page, width = 1440, theme = "light") {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(
    (mode) => localStorage.setItem("hoa-nam-theme", mode),
    theme,
  );
  await page.clock.install();
  await page.goto("/e2e/fixtures/notification-toast.html");
  await expect(page.getByTestId("ready")).toBeVisible();
  const pauseAt = await page.evaluate(() => Date.now() + 1000);
  await page.clock.pauseAt(new Date(pauseAt));
}

for (const width of [1440, 390])
  for (const theme of ["light", "dark"]) {
    test(`keeps all history and badge with a bounded real Toaster at ${width}px ${theme}`, async ({
      page,
    }) => {
      await open(page, width, theme);
      await expect
        .poll(() =>
          page.evaluate(() => window.__notificationFixture.isLeader()),
        )
        .toBe(true);
      await page.evaluate(() => window.__notificationFixture.emit(1201));
      await page.clock.runFor(1400);
      await expect(page.getByTestId("badge")).toHaveText("1201");
      await expect(page.getByTestId("history")).toHaveText("1201");
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(4);
      await expect(
        page.getByText("1198 thông báo mới", { exact: true }),
      ).toBeVisible();
      await page.evaluate(() => window.__notificationFixture.replay());
      await page.clock.runFor(400);
      await expect(page.getByTestId("badge")).toHaveText("1201");
      await page.screenshot({
        path: `test-results/notification-toast/${width}-${theme}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Xem lịch sử" }).click();
      await page.clock.runFor(500);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await page.getByRole("button", { name: "Về tổng quan" }).click();
      await page.clock.runFor(2000);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await expect(page.getByTestId("history")).toHaveText("1201");
    });
  }

test("relays complete batches to a second tab without duplicating either badge", async ({
  page,
  context,
}) => {
  await open(page);
  await expect
    .poll(() => page.evaluate(() => window.__notificationFixture.isLeader()))
    .toBe(true);
  const other = await context.newPage();
  await open(other);
  expect(
    await other.evaluate(() => window.__notificationFixture.isLeader()),
  ).toBe(false);
  await page.evaluate(() => window.__notificationFixture.emit(1201));
  await page.clock.runFor(1400);
  await other.clock.runFor(500);
  for (const tab of [page, other]) {
    await expect(tab.getByTestId("badge")).toHaveText("1201");
    await expect(tab.getByTestId("history")).toHaveText("1201");
  }
  await page.evaluate(() => window.__notificationFixture.replay());
  await page.clock.runFor(400);
  for (const tab of [page, other])
    await expect(tab.getByTestId("badge")).toHaveText("1201");
  await other.close();
});

test("keeps admission across navigation and never replays a manually closed summary", async ({
  page,
}) => {
  await open(page);
  await expect
    .poll(() => page.evaluate(() => window.__notificationFixture.isLeader()))
    .toBe(true);
  await page.evaluate(() => window.__notificationFixture.emit(3));
  await page.clock.runFor(500);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(3);
  await page.getByRole("button", { name: "Xem lịch sử" }).click();
  await page.clock.runFor(500);
  await page.getByRole("button", { name: "Về tổng quan" }).click();
  await page.evaluate(() => window.__notificationFixture.emit(3));
  await page.clock.runFor(500);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
  await expect(
    page.getByText("3 thông báo mới", { exact: true }),
  ).toBeVisible();
  await page.locator("[data-sonner-toast] [data-close-button]").click();
  await page.clock.runFor(8500);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await expect(page.getByTestId("badge")).toHaveText("6");
  await expect(page.getByTestId("history")).toHaveText("6");
});
