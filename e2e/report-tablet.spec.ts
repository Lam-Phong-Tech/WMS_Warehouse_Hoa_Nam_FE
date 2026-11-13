import { expect, test, type Page } from "@playwright/test";

type ReportName = "inbound" | "outbound" | "recipient" | "import-quality";

for (const language of ["vi", "en", "zh"]) {
  for (const width of [1536, 768]) {
    test(`outbound status text remains inside padded badge ${language} ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1080 });
      await page.addInitScript((value) => localStorage.setItem("erp-language", JSON.stringify({state:{language:value}, version:0})), language);
      await page.goto("/e2e/fixtures/report-tablet.html?report=outbound&dailyBars=1&statusClip=1");
      const badge = page.locator('.outbound-table-wrap .outbound-status[data-tone="processing"]').first();
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(language === "vi" ? "Đang quét xuất hàng" : language === "en" ? "Issue scan in progress" : "正在扫描出库");
      const result = await badge.evaluate((el) => {
        const bounds = el.getBoundingClientRect();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const rects: DOMRect[] = [];
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          rects.push(...Array.from(range.getClientRects()));
        }
        return { left: Math.min(...rects.map(r=>r.left)) - bounds.left, right: bounds.right - Math.max(...rects.map(r=>r.right)), text: el.textContent };
      });
      expect(result.left).toBeGreaterThanOrEqual(7);
      expect(result.right).toBeGreaterThanOrEqual(7);
      await page.screenshot({ path: `test-results/report-tablet/status-${language}-${width}.png`, fullPage: true });
    });
  }
}

const REPORTS: ReportName[] = [
  "inbound",
  "outbound",
  "recipient",
  "import-quality",
];

for (const report of ["inbound", "outbound"] as const) {
  for (const width of [1920, 768]) {
    test(`${report} daily values follow bar tops at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1080 });
      if (width === 768) await page.addInitScript(() => localStorage.setItem("hoa-nam-theme", "dark"));
      await page.goto(`/e2e/fixtures/report-tablet.html?report=${report}&dailyBars=1`);
      await waitForReport(page, report);
      await expect(page.getByText("2 SKU · Phiếu đã ghi sổ")).toBeVisible();
      const bars = page.locator(`.${report}-chart-bar > i`);
      const high = bars.filter({ has: page.locator("span", { hasText: /^46$/ }) });
      const low = bars.filter({ has: page.locator("span", { hasText: /^4$/ }) });
      await expect(high).toHaveCount(1);
      await expect(low).toHaveCount(1);
      await high.scrollIntoViewIfNeeded();
      // Wait for the height transition to settle before checking geometry.
      await expect.poll(async () => (await high.boundingBox())!.height).toBeGreaterThan(40);
      for (const bar of [high, low]) {
        const box = (await bar.boundingBox())!;
        const label = (await bar.locator("span").boundingBox())!;
        expect(box.y - label.y - label.height).toBeGreaterThanOrEqual(3);
        expect(box.y - label.y - label.height).toBeLessThanOrEqual(5);
      }
      expect((await high.locator("span").boundingBox())!.y).toBeLessThan((await low.locator("span").boundingBox())!.y);
      await page.screenshot({ path: `test-results/report-tablet/${report}-bar-labels-${width}.png`, fullPage: true });
    });
  }
}

async function waitForReport(page: Page, report: ReportName) {
  if (report === "inbound") {
    await expect(page.locator(".inbound-table-wrap tbody tr")).toHaveCount(6);
    return;
  }
  if (report === "outbound") {
    await expect(page.locator(".outbound-table-wrap tbody tr")).toHaveCount(6);
    return;
  }
  if (report === "recipient") {
    await expect(page.locator(".rpt07-table tbody tr")).toHaveCount(6);
    return;
  }
  await expect(page.getByText("WWHN-172-SKU-import-1.xlsx").first()).toBeVisible();
}

async function layoutMetrics(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector<HTMLElement>(".hn-mvp-screen")!;
    const tableWrap = document.querySelector<HTMLElement>(
      ".inbound-table-wrap, .outbound-table-wrap, .rpt07-table-scroll, .rpt04-results-table",
    );
    const table = document.querySelector<HTMLTableElement>(
      ".inbound-table-wrap table, .outbound-table-wrap table, .rpt07-table, .rpt04-results-table table",
    );
    return {
      viewport: window.innerWidth,
      docClientWidth: doc.clientWidth,
      docScrollWidth: doc.scrollWidth,
      mainClientWidth: main.clientWidth,
      mainScrollWidth: main.scrollWidth,
      tableWrapClientWidth: tableWrap?.clientWidth ?? null,
      tableWrapScrollWidth: tableWrap?.scrollWidth ?? null,
      tableDisplay: table ? getComputedStyle(table).display : null,
      tableMinWidth: table ? getComputedStyle(table).minWidth : null,
    };
  });
}

for (const report of REPORTS) {
  test(`${report} — tablet 768px không tràn ngang`, async ({ page }) => {    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/e2e/fixtures/report-tablet.html?report=${report}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForReport(page, report);
    const metrics = await layoutMetrics(page);

    const breadcrumb = page.locator(".topbar-breadcrumb");
    await expect(breadcrumb).toHaveCount(1);
    await expect(breadcrumb).toBeHidden();

    expect(metrics.docScrollWidth).toBeLessThanOrEqual(
      metrics.docClientWidth + 1,
    );
    expect(metrics.mainScrollWidth).toBeLessThanOrEqual(
      metrics.mainClientWidth + 1,
    );

    if (report === "import-quality") {
      // Tablet dùng card của ResponsiveDataTable, không còn bảng 1000px.
      expect(metrics.tableDisplay).toBeNull();
    } else {
      expect(metrics.tableDisplay).toBe("table");
      expect(metrics.tableMinWidth).not.toBe("1000px");
      expect(metrics.tableWrapScrollWidth).toBeLessThanOrEqual(
        (metrics.tableWrapClientWidth ?? 0) + 1,
      );
    }

    await page.screenshot({
      path: `test-results/report-tablet/${report}-768.png`,
      fullPage: true,
    });
  });

  test(`${report} — desktop 1024px không tràn trang`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1024 });
    await page.goto(`/e2e/fixtures/report-tablet.html?report=${report}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForReport(page, report);
    const metrics = await layoutMetrics(page);

    await expect(page.locator(".topbar-breadcrumb")).toBeVisible();
    expect(metrics.docScrollWidth).toBeLessThanOrEqual(
      metrics.docClientWidth + 1,
    );
    expect(metrics.mainScrollWidth).toBeLessThanOrEqual(
      metrics.mainClientWidth + 1,
    );
    expect(metrics.tableDisplay).toBe("table");
  });

  test(`${report} — desktop 1440px giữ bảng hiện hành`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto(`/e2e/fixtures/report-tablet.html?report=${report}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForReport(page, report);
    const metrics = await layoutMetrics(page);

    await expect(page.locator(".topbar-breadcrumb")).toBeVisible();

    expect(metrics.docScrollWidth).toBeLessThanOrEqual(
      metrics.docClientWidth + 1,
    );
    expect(metrics.mainScrollWidth).toBeLessThanOrEqual(
      metrics.mainClientWidth + 1,
    );
    expect(metrics.tableDisplay).toBe("table");

    await page.screenshot({
      path: `test-results/report-tablet/${report}-1440.png`,
      fullPage: true,
    });
  });
}

test("inbound detail — dark theme dùng surface tối và chữ sáng", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("hoa-nam-theme", "dark"),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/e2e/fixtures/report-tablet.html?report=inbound-detail", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".inbound-report-detail")).toBeVisible();
  await expect(page.getByText("Chi tiết báo cáo nhập kho")).toBeVisible();

  const metrics = await page.evaluate(() => {
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
    const read = (selector: string) => {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const style = getComputedStyle(node);
      return {
        color: style.color,
        background: style.backgroundColor,
        luminance: luminance(style.backgroundColor),
      };
    };
    const header = read(".inbound-report-detail__header")!;
    const info = read(".inbound-report-detail__info")!;
    const panel = read(".inbound-report-detail__panel")!;
    const title = read(".inbound-report-detail h1")!;
    const body = read(".inbound-report-detail dd")!;
    const muted = read(".inbound-report-detail__info dt")!;
    const th = read(".inbound-report-detail th")!;
    const tab = read(
      '.inbound-report-detail__tabs button[aria-selected="true"]',
    )!;
    return {
      headerLuminance: header.luminance,
      infoLuminance: info.luminance,
      panelLuminance: panel.luminance,
      titleContrast: contrast(title.color, header.background),
      bodyContrast: contrast(body.color, info.background),
      mutedContrast: contrast(muted.color, info.background),
      tableHeaderContrast: contrast(th.color, th.background),
      selectedTabContrast: contrast(tab.color, tab.background),
    };
  });

  expect(metrics.headerLuminance).toBeLessThan(0.2);
  expect(metrics.infoLuminance).toBeLessThan(0.2);
  expect(metrics.panelLuminance).toBeLessThan(0.2);
  expect(metrics.titleContrast).toBeGreaterThanOrEqual(4.5);
  expect(metrics.bodyContrast).toBeGreaterThanOrEqual(4.5);
  expect(metrics.mutedContrast).toBeGreaterThanOrEqual(4.5);
  expect(metrics.tableHeaderContrast).toBeGreaterThanOrEqual(4.5);
  expect(metrics.selectedTabContrast).toBeGreaterThanOrEqual(4.5);

  await page.screenshot({
    path: "test-results/report-tablet/inbound-detail-dark-1440.png",
    fullPage: true,
  });
});
