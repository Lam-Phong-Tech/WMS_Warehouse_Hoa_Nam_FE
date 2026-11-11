import { expect, test } from "@playwright/test";

const TEXT_TARGETS = [
  [".snapshot-heading h1", "heading"],
  [".snapshot-heading p", "subtitle"],
  [".snapshot-card h2", "card heading"],
  [".hn-stock-flow__legend > span", "chart legend"],
  [".hn-stock-flow__tick", "chart axis tick"],
  [".hn-stock-flow__axis-title", "chart axis title"],
  [".snapshot-filter > button", "period filter"],
  [".snapshot-priority-row strong", "task title"],
  [".snapshot-priority-row small", "task detail"],
  [".snapshot-priority-row > i", "task action"],
  [".snapshot-card header > button", "card action"],
  [".snapshot-link-cards strong", "link card title"],
  [".snapshot-link-cards small", "link card detail"],
];

test("dark dashboard text is light and readable", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("hoa-nam-theme", "dark"),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/e2e/fixtures/dashboard-dark.html", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".hn-stock-flow__legend")).toBeVisible();

  const rows = await page.evaluate((targets) => {
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
    const contrast = (foreground: string, background: string) => {
      const [light, dark] = [
        luminance(foreground),
        luminance(background),
      ].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };
    const backgroundOf = (node: Element) => {
      let current: Element | null = node;
      while (current) {
        const color = getComputedStyle(current).backgroundColor;
        if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent")
          return color;
        current = current.parentElement;
      }
      return getComputedStyle(document.documentElement).backgroundColor;
    };
    return targets.map(([selector, label]) => {
      const node = document.querySelector(selector);
      if (!node) return { label, missing: true, contrast: null };
      const style = getComputedStyle(node);
      const color =
        style.color && style.color !== "rgb(0, 0, 0)"
          ? style.color
          : style.fill;
      const background = backgroundOf(node);
      return {
        label,
        text: node.textContent?.trim().slice(0, 50),
        color,
        background,
        contrast: Number(contrast(color, background).toFixed(2)),
      };
    });
  }, TEXT_TARGETS);

  for (const row of rows) {
    expect(row.missing, `${row.label} missing`).not.toBe(true);
    expect(
      row.contrast === null ? -1 : row.contrast,
      `${row.label}: ${row.color} on ${row.background}`,
    ).toBeGreaterThanOrEqual(4.5);
  }

  await page.screenshot({
    path: "test-results/dashboard-dark/dashboard-dark-1440.png",
    fullPage: true,
  });
});

test("tablet dashboard keeps link cards above recent transactions", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("hoa-nam-theme", "light"),
  );
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto("/e2e/fixtures/dashboard-dark.html", {
    waitUntil: "domcontentloaded",
  });

  const linkCards = page.locator(".snapshot-link-cards");
  const recent = page.locator(".snapshot-recent");
  await expect(linkCards).toBeVisible();
  await expect(recent).toBeVisible();
  const linkBox = await linkCards.boundingBox();
  const recentBox = await recent.boundingBox();
  expect(linkBox!.y).toBeLessThan(recentBox!.y);
});

test("light dashboard recent table shows the status column", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("hoa-nam-theme", "light"),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/e2e/fixtures/dashboard-dark.html", {
    waitUntil: "domcontentloaded",
  });

  const table = page.locator(".snapshot-recent-table");
  await expect(table).toBeVisible();
  const linkCards = page.locator(".snapshot-link-cards");
  const recent = page.locator(".snapshot-recent");
  await expect(linkCards).toBeVisible();
  await expect(recent).toBeVisible();
  const linkBox = await linkCards.boundingBox();
  const recentBox = await recent.boundingBox();
  expect(linkBox!.y).toBeLessThan(recentBox!.y);
  await expect(
    table.getByRole("columnheader", { name: "Trạng thái" }),
  ).toBeVisible();
  await expect(table.getByText("Đã nhập kho").first()).toBeVisible();
  await expect(table.getByText("Đã xuất kho").first()).toBeVisible();

  await page.screenshot({
    path: "test-results/dashboard-dark/dashboard-light-1440.png",
    fullPage: true,
  });
});
