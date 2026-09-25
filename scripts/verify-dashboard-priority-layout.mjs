/** CSS-only MAP-01 regression harness; no API calls or production fixtures.
 * Run from the repository: node scripts/verify-dashboard-priority-layout.mjs
 * Optional: --chromium /path/to/chromium --base-css /path/to/source-excerpt.css
 * The latter is explicitly reported and is NOT a full-stylesheet verification.
 */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const basePath = option("--base-css") ?? resolve(root, "src/modules/dashboard/dashboard-overview.css");
const baseCss = await readFile(basePath, "utf8");
const gridCss = await readFile(resolve(root, "src/modules/dashboard/overview/snapshot-main-grid.css"), "utf8");
const chartCss = await readFile(resolve(root, "src/modules/dashboard/overview/snapshot-stock-flow.css"), "utf8");
assert.ok(chartCss.startsWith('@import "./snapshot-main-grid.css";'), "layout must be imported by the eagerly loaded chart stylesheet");
assert.ok(!/setTimeout|requestAnimationFrame|ResizeObserver/.test(gridCss), "no layout timers");
const output = resolve(root, "test-results/dashboard-priority-layout");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: option("--chromium"), headless: true });
const page = await browser.newPage();
const results = [];
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 1, `${message}: ${actual} vs ${expected}`);

const fixtureCss = `
  body { margin:0; font-family:Arial,sans-serif; }
  .fixture { container: hn-dash / inline-size; margin-inline:auto; }
  .fixture .hn-dashboard-snapshot { --snapshot-line:#d6e4eb; --hnd-surface-bg:#fff;
    --primary-dark:#004e74; --blue:#004e74; --muted:#5e7889; --line:#d6e4eb;
    --red:#c93838; --red-soft:#f7e3e3; --blue-soft:#edf6fa;
    --primary-soft:#edf6fa; --green:#268558; --amber:#b87905; }
  .fixture h2 { margin:0; } .fixture button { font:inherit; }
  .fixture-legend { height:32px; }
  .fixture-svg { display:block; width:100%; height:320px; }
  .fixture svg rect { fill:#e3edf2; }
`;
function markup(count, state, containerWidth) {
  const tasks = count ? `<div>${Array.from({ length: count }, (_, index) => `
    <button type="button" class="snapshot-priority-row" data-task="${index}">
      <span class="snapshot-priority-icon">!</span>
      <span><strong>Priority item ${index + 1}</strong><small>Long item description remains inside the same row.</small></span>
      <b>1</b><i>View</i>
    </button>`).join("")}</div>` : `<div class="snapshot-chart-state"><strong>No pending work</strong></div>`;
  return `<main class="fixture" style="width:${containerWidth}px;max-width:100%"><div class="hn-dashboard-snapshot">
    <section class="snapshot-main-grid">
      <article class="snapshot-card snapshot-chart-card">
        <header><h2>Stock flow chart</h2><button data-control="chart">Range</button></header>
        ${state === "loading" ? `<div class="snapshot-chart-state">Loading</div>` : `<div class="hn-stock-flow"><div class="fixture-legend">Inbound / Outbound / Stock</div><svg class="fixture-svg" width="760" height="320" viewBox="0 0 760 320"><rect x="30" y="30" width="700" height="250" /></svg></div>`}
      </article>
      <article class="snapshot-card snapshot-priority"><header><h2>Priority work</h2><button data-control="priority">View all</button></header>
        ${state === "loading" ? `<div class="snapshot-list-loading"></div>` : tasks}
      </article>
      <article class="snapshot-card snapshot-recent"><header><h2>Recent documents</h2><button data-control="recent">View all</button></header><div class="snapshot-empty-table">Document area</div></article>
      <article class="snapshot-card snapshot-stock"><header><h2>Stock composition</h2><button data-control="stock">Details</button></header><div class="snapshot-empty-table">Composition area</div></article>
    </section>
  </div></main>`;
}
async function mount({ width, containerWidth = width, count = 3, state = "ready", patched = true, lateBase = false }) {
  await page.setViewportSize({ width, height: 1300 });
  // The old main stylesheet may be loaded AFTER the chart module in Vite.
  const sources = patched ? (lateBase ? gridCss + baseCss : baseCss + gridCss) : baseCss;
  await page.setContent(`<style>${fixtureCss}${chartCss.replace(/@import[^;]+;/g, "")}${sources}</style>${markup(count, state, containerWidth)}`);
  await page.evaluate(() => document.fonts.ready);
}
async function bounds() {
  return page.locator(".snapshot-main-grid").evaluate((grid) => {
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return { x:box.x, y:box.y, width:box.width, height:box.height, bottom:box.bottom, right:box.right };
    };
    const cards = [...grid.children].map(rect);
    const priority = grid.querySelector(".snapshot-priority");
    const last = priority.lastElementChild;
    return { cards, gap:parseFloat(getComputedStyle(grid).rowGap),
      priorityTail:rect(priority).bottom - rect(last).bottom,
      scrollWidth:document.documentElement.scrollWidth, viewport:innerWidth,
      controls:[...grid.querySelectorAll("[data-control]")].map((el) => el.dataset.control),
      shimmer:priority.querySelector(".snapshot-list-loading") ? rect(priority.querySelector(".snapshot-list-loading")) : null,
      header:rect(priority.firstElementChild) };
  });
}
function check(data, stacked, state) {
  const [chart, priority, recent, stock] = data.cards;
  assert.ok(data.scrollWidth <= data.viewport + 1, "no document-wide horizontal overflow");
  assert.deepEqual(data.controls, ["chart", "priority", "recent", "stock"], "DOM and keyboard order unchanged");
  assert.ok(data.priorityTail <= 10, `priority white tail must be padding only, got ${data.priorityTail}`);
  if (stacked) {
    for (let index = 1; index < data.cards.length; index++) {
      close(data.cards[index].y - data.cards[index-1].bottom, data.gap, "stacked gap");
      close(data.cards[index].x, chart.x, "single-column alignment");
      close(data.cards[index].width, chart.width, "no implicit second column");
    }
  } else {
    close(priority.y, chart.y, "top alignment");
    close(stock.y - priority.bottom, data.gap, "composition follows priority immediately");
    close(recent.y - chart.bottom, data.gap, "documents follow chart");
    assert.ok(priority.height < chart.height, "short card must not stretch with chart");
    assert.ok(priority.x >= chart.right + data.gap - 1, "columns do not overlap");
  }
  if (state === "loading") {
    assert.ok(data.shimmer?.height >= 160, "loading retains a measurable slot");
    assert.ok(data.shimmer.y >= data.header.bottom - 1, "shimmer does not cover heading");
    assert.ok(data.shimmer.bottom <= priority.bottom, "shimmer remains inside priority");
  }
}
try {
  await mount({ width:1625, count:3, patched:false });
  const before = await bounds();
  assert.ok(before.priorityTail > 150, "must reproduce the reported stretched white card first");
  for (const width of [1920, 1625, 1280, 1024, 900, 800, 375, 320]) {
    for (const count of [0, 1, 3, 5]) {
      for (const lateBase of [false, true]) {
        await mount({ width, count, lateBase });
        const data = await bounds(); check(data, width <= 900, "ready");
        results.push({ width, count, lateBase, state:"ready", priorityHeight:data.cards[1].height, priorityTail:data.priorityTail });
      }
    }
    await mount({ width, state:"loading" });
    check(await bounds(), width <= 900, "loading");
    results.push({ width, state:"loading" });
  }
  // Desktop viewport with a narrow main panel must follow the named container.
  await mount({ width:1625, containerWidth:850 });
  check(await bounds(), true, "ready");
  results.push({ width:1625, containerWidth:850 });
  // Actual viewport resize, without reparenting/remounting/rebuilding markup.
  await mount({ width:1625 });
  await page.setViewportSize({ width:800, height:1300 });
  check(await bounds(), true, "ready");
  await page.setViewportSize({ width:1625, height:1300 });
  check(await bounds(), false, "ready");
  results.push({ resize:"1625 -> 800 -> 1625" });
  // Changes in live task count reflow directly through CSS, not a stale height.
  await page.locator('[data-task="2"]').evaluate((element) => element.remove());
  check(await bounds(), false, "ready");
  results.push({ mutation:"remove one task" });
  await page.emulateMedia({ reducedMotion:"reduce" });
  check(await bounds(), false, "ready");
  results.push({ reducedMotion:true });
  await mount({ width:1625 });
  const after = await bounds();
  close(after.cards[0].height, before.cards[0].height, "chart height must remain unchanged");
  close(after.cards[0].width, before.cards[0].width, "chart width must remain unchanged");
  await page.screenshot({ path:resolve(output, "layout-1625.png"), fullPage:true });
  await mount({ width:800 });
  await page.screenshot({ path:resolve(output, "layout-800.png"), fullPage:true });
  const report = { status:"passed", checks:results.length,
    scope:option("--base-css") ? "isolated Chromium with reviewed legacy CSS excerpt" : "isolated Chromium with full repository dashboard CSS",
    before:{ priorityHeight:before.cards[1].height, priorityTail:before.priorityTail },
    after:{ priorityHeight:after.cards[1].height, priorityTail:after.priorityTail }, results };
  await writeFile(resolve(output, "results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, results:undefined }, null, 2));
} finally { await browser.close(); }
