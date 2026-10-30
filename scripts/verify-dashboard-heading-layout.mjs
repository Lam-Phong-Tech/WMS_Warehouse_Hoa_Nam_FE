/** MAP-01 header regression: node scripts/verify-dashboard-heading-layout.mjs */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const css = await readFile(resolve(root, "src/modules/dashboard/dashboard-overview.css"), "utf8");
const previous = css.replace(/  \.snapshot-warehouse \{\s*grid-column: 3;\s*grid-row: 1 \/ 3;\s*align-self: start;\s*max-width: 310px;\s*\}/, "")
  .replace(/  \.snapshot-time \{\s*grid-column: 2;\s*grid-row: 2;\s*\}/, "  .snapshot-time { grid-column: 2 / 4; }");
assert.notEqual(previous, css, "must reproduce the previous auto-placement");
const output = resolve(root, "test-results/dashboard-heading-layout");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];
// Same four direct children and order as DashboardSnapshot's header.
const markup = (width, longName = false) => `
  <main class="hn-dash" style="width:${width}px;max-width:100%;margin-inline:auto">
    <div class="hn-dashboard-snapshot">
      <header class="snapshot-heading">
        <span class="snapshot-heading-icon" aria-hidden="true">▦</span>
        <div><h1>Chào buổi sáng, Quản trị viên!</h1><p>Cùng quản lý kho hiệu quả hơn mỗi ngày.</p></div>
        <div class="snapshot-time"><span>Thứ Sáu, 30 tháng 10, 2026</span><i></i><span>11:38</span></div>
        <button type="button" class="snapshot-warehouse" aria-label="Mở danh mục kho">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 10 12 4 21 10V21H3Z M9 21V14H15V21"/></svg>
          <span><strong>${longName ? "Kho thành phẩm và linh kiện bảo hành khu vực miền Nam" : "Toàn bộ kho Hoa Nam"}</strong><small><i></i>Đang hoạt động</small></span>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </header>
      <section class="snapshot-kpis"><article class="snapshot-kpi">Tổng tồn khả dụng</article></section>
    </div>
  </main>`;
async function mount(viewport, width, styles = css, longName = false) {
  await page.setViewportSize({ width: viewport, height: 700 });
  await page.setContent(`<style>body{margin:0;font-family:Arial,sans-serif;background:#f4f9fb}${styles}</style>${markup(width, longName)}`);
}
async function bounds() {
  return page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      const r = el.getBoundingClientRect();
      return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, visible:getComputedStyle(el).display !== "none" };
    };
    return { header:rect(".snapshot-heading"), title:rect(".snapshot-heading > div"), time:rect(".snapshot-time"), warehouse:rect(".snapshot-warehouse"), kpis:rect(".snapshot-kpis"), overflow:document.documentElement.scrollWidth > innerWidth };
  });
}
try {
  await mount(1250, 1250, previous);
  const before = await bounds();
  assert.ok(before.warehouse.y >= before.time.bottom, "reproduce warehouse falling below date/time");
  await page.screenshot({ path:resolve(output, "before-1250.png") });
  for (const [viewport, width] of [[1913,1250],[1920,1800],[1440,1320],[1280,1200],[1024,1000],[960,901],[1440,850],[900,900],[768,740],[375,375],[320,320]]) {
    for (const longName of [false, true]) {
      await mount(viewport, width, css, longName);
      const data = await bounds();
      assert.equal(data.overflow, false, "no horizontal page overflow");
      if (width > 900) {
        assert.equal(data.warehouse.visible, true);
        assert.ok(Math.abs(data.warehouse.right - data.header.right) <= 1, "warehouse aligns with right edge");
        assert.ok(data.warehouse.x >= data.title.right, "warehouse stays right of greeting");
        assert.ok(data.warehouse.bottom <= data.kpis.y, "warehouse cannot overlap KPI cards");
        if (width <= 1250) {
          assert.ok(Math.abs(data.warehouse.y - data.header.y) <= 1, "warehouse anchors to top of header");
          assert.ok(data.time.y >= data.title.bottom, "date remains under greeting");
          assert.ok(data.time.right <= data.warehouse.x, "date cannot occupy warehouse column");
        }
        await page.keyboard.press("Tab");
        assert.equal(await page.locator(".snapshot-warehouse").evaluate(el => el === document.activeElement), true, "warehouse remains keyboard reachable");
        await page.locator(".snapshot-warehouse").click();
      } else {
        assert.equal(data.warehouse.visible, false, "existing compact layout is preserved");
        assert.equal(data.time.visible, false);
      }
      results.push({ viewport, width, longName, ...data });
    }
  }
  await mount(1913, 1250);
  await page.screenshot({ path:resolve(output, "after-1913.png") });
  await mount(375, 375);
  await page.screenshot({ path:resolve(output, "after-375.png") });
  await writeFile(resolve(output, "results.json"), JSON.stringify({ status:"passed", scope:"Chromium header fixture with full repository dashboard CSS; component behavior covered by Vitest", checks:results.length, results }, null, 2));
  console.log("PASS: " + results.length + " header layout cases; previous auto-placement reproduced.");
} finally {
  await browser.close();
}
