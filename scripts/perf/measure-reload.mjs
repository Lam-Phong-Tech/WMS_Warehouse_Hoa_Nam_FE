/**
 * Đo F5 (tải lại trang khi ĐÃ đăng nhập) — phân rã theo chặng, bằng trình duyệt thật.
 *
 *   node scripts/perf/measure-reload.mjs
 *   BASE_URL=http://localhost:5199 PAGES=/dashboard,/inventory RELOADS=5 CPU=1 node scripts/perf/measure-reload.mjs
 *
 * Với mỗi trang: đăng nhập một lần, vào trang, rồi F5 N lần. Mỗi lần F5 ghi:
 *   nav.ttfb / domContentLoaded / load   — Navigation Timing
 *   fcp / lcp                            — Paint
 *   content                              — lúc <main> có nội dung thật (hết skeleton/"Đang tải",
 *                                          > 300 node, chữ > 300 ký tự, DOM đứng yên 2 nhịp) — ĐÂY là
 *                                          con số "F5 mất bao lâu" theo cảm nhận người dùng.
 *   api[]                                — từng request /api/v1/* : start→end (ms kể từ navigationStart)
 *   js/css/font                          — số file + KB tải (transferSize=0 nghĩa là lấy từ SW/HTTP cache)
 *   longTasks / tbt                      — long task ≥ 50 ms trong lần tải
 * Lượt 1 sau đăng nhập là "cold-ish" (SW vừa cài), các lượt sau là warm (SW + HTTP cache + IndexedDB).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5199";
const EMAIL = process.env.BENCH_EMAIL ?? "admin-01@gmail.com";
const PASSWORD = process.env.BENCH_PASSWORD ?? "Cntt@1234";
const PAGES = (
  process.env.PAGES ?? "/dashboard,/inventory,/inbound,/reports/inventory-flow"
).split(",");
const RELOADS = Number(process.env.RELOADS ?? 4);
const CPU = Number(process.env.CPU ?? 1);
/** Thời gian đứng yên sau mỗi lần tải, trước khi tải lại lượt kế tiếp. */
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 2600);
const TAG = process.env.TAG ?? "run";
const OUT = process.env.OUT_DIR ?? "build/perf";

const INIT = () => {
  window.__v = { lcp: 0, fcp: 0, longTasks: [], marks: {} };
  try {
    // Mốc DOM: lúc shell (nav) xuất hiện, lúc skeleton trang xuất hiện/biến mất,
    // và mọi performance.mark("wms:*") mà app tự đặt.
    const mark = (k) => {
      if (!(k in window.__v.marks)) window.__v.marks[k] = Math.round(performance.now());
    };
    const mo = new MutationObserver(() => {
      if (document.querySelector("nav, aside")) mark("shell");
      if (document.querySelector("main")) mark("main");
      const sk = document.querySelector('.MuiSkeleton-root, [data-ui-state="loading"], [role="progressbar"]');
      if (sk) { mark("skeletonFirst"); window.__v.marks.skeletonLast = Math.round(performance.now()); }
    });
    // Init script chạy TRƯỚC khi có <html> — phải observe `document`, không phải
    // documentElement (null lúc này; ném lỗi là mất luôn các observer phía dưới).
    mo.observe(document, { childList: true, subtree: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name.startsWith("wms:")) window.__v.marks[e.name] = Math.round(e.startTime);
    }).observe({ type: "mark", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__v.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (e.name === "first-contentful-paint") window.__v.fcp = e.startTime;
    }).observe({ type: "paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        window.__v.longTasks.push({
          t: Math.round(e.startTime),
          d: Math.round(e.duration),
        });
    }).observe({ type: "longtask", buffered: true });
  } catch (err) {
    window.__v.error = String(err);
  }
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await context.addInitScript(INIT);
const page = await context.newPage();
if (CPU > 1) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
}

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("your@gmail.com").fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

/** Chờ nội dung thật rồi trả về performance.now() của thời điểm đó. */
async function waitForRealContent(timeoutMs = 30_000) {
  await page.waitForFunction(
    () => {
      const main = document.querySelector("main") ?? document.body;
      const text = main.innerText || "";
      const loading = /Đang tải|Loading/.test(text);
      const skeletons = main.querySelectorAll(
        '[data-ui-state="loading"], .MuiSkeleton-root',
      ).length;
      const nodes = main.querySelectorAll("*").length;
      const stable = window.__lastNodes === nodes;
      window.__lastNodes = nodes;
      const ok =
        !loading &&
        skeletons === 0 &&
        nodes > 300 &&
        stable &&
        text.replace(/\s+/g, "").length > 300;
      if (ok && !window.__contentAt) window.__contentAt = performance.now();
      return ok;
    },
    null,
    { timeout: timeoutMs, polling: 16 },
  );
  return page.evaluate(() => window.__contentAt);
}

async function measureReload(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "commit", timeout: 60_000 });
  const contentAt = await waitForRealContent();
  // Chờ thêm để LCP/longtask ổn định, VÀ để lớp persisted cache kịp ghi xuống
  // IndexedDB (debounce 2 s trong query-persister.ts). Không chờ đủ thì mỗi lượt
  // đo là một lần "máy sạch" và số request bị thổi lên so với người dùng thật —
  // đo được: /master-data/skus 8 request khi đo dồn, chỉ 2 request khi F5 bình
  // thường. Đặt SETTLE_MS=800 nếu cố ý muốn đo trường hợp chưa kịp ghi cache.
  await page.waitForTimeout(SETTLE_MS);
  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    const api = res
      .filter((r) => r.name.includes("/api/v1/"))
      .map((r) => ({
        url: r.name.replace(/^https?:\/\/[^/]+\/api\/v1/, ""),
        start: Math.round(r.startTime),
        end: Math.round(r.responseEnd),
        ms: Math.round(r.responseEnd - r.startTime),
        ttfb: Math.round(r.responseStart - r.requestStart),
        kb: Math.round((r.encodedBodySize || 0) / 1024),
      }))
      .sort((a, b) => a.start - b.start);
    const js = res.filter((r) => /\/assets\/.*\.js(\?|$)/.test(r.name));
    const css = res.filter((r) => /\.css(\?|$)/.test(r.name));
    const font = res.filter((r) => /\.(woff2?|eot|ttf)(\?|$)/.test(r.name));
    const sum = (arr, k) =>
      Math.round(arr.reduce((s, r) => s + (r[k] || 0), 0) / 1024);
    const lastJs = js.reduce((m, r) => Math.max(m, r.responseEnd), 0);
    const cached = js.filter((r) => r.transferSize === 0).length;
    return {
      ttfb: Math.round(nav.responseStart),
      dcl: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      fcp: Math.round(window.__v.fcp),
      lcp: Math.round(window.__v.lcp),
      js: {
        n: js.length,
        kb: sum(js, "encodedBodySize"),
        wireKb: sum(js, "transferSize"),
        fromCache: cached,
        lastEnd: Math.round(lastJs),
      },
      css: { n: css.length, kb: sum(css, "encodedBodySize") },
      font: {
        n: font.length,
        kb: sum(font, "encodedBodySize"),
        names: font.map((f) => f.name.split("/").pop()),
      },
      api,
      marks: window.__v.marks,
      longTasks: window.__v.longTasks,
      tbt: window.__v.longTasks.reduce((s, e) => s + Math.max(0, e.d - 50), 0),
      dom: document.querySelectorAll("*").length,
    };
  });
  return { path, content: Math.round(contentAt), ...data };
}

const results = { tag: TAG, base: BASE, cpu: CPU, pages: {} };
await login();
for (const path of PAGES) {
  const runs = [];
  for (let i = 0; i < RELOADS; i += 1) {
    try {
      runs.push(await measureReload(path));
    } catch (e) {
      runs.push({ path, error: String(e).slice(0, 160) });
    }
  }
  results.pages[path] = runs;
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/reload-${TAG}.json`, JSON.stringify(results, null, 1));

const pad = (s, n) => String(s).padEnd(n);
const padl = (s, n) => String(s).padStart(n);
console.log(`\nF5 — ${BASE} — CPU x${CPU}\n`);
console.log(
  pad("trang", 26),
  padl("lượt", 4),
  padl("TTFB", 6),
  padl("FCP", 6),
  padl("LCP", 6),
  padl("DCL", 6),
  padl("JSend", 6),
  padl("NỘI DUNG", 9),
  padl("TBT", 5),
  padl("LT", 3),
  padl("js#", 4),
  padl("jsKB", 6),
  padl("wire", 5),
  padl("api#", 4),
  " api (start→end ms)",
);
for (const [path, runs] of Object.entries(results.pages)) {
  runs.forEach((r, i) => {
    if (r.error) {
      console.log(pad(path, 26), padl(i + 1, 4), " LỖI ", r.error);
      return;
    }
    const apiStr = r.api
      .map((a) => `${a.url.split("?")[0]} ${a.start}→${a.end}`)
      .join(" | ");
    const marksStr = Object.entries(r.marks ?? {})
      .sort((a, b) => a[1] - b[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    if (marksStr) console.log(pad("", 26), padl("", 4), " mốc:", marksStr);
    console.log(
      pad(path, 26),
      padl(i + 1, 4),
      padl(r.ttfb, 6),
      padl(r.fcp, 6),
      padl(r.lcp, 6),
      padl(r.dcl, 6),
      padl(r.js.lastEnd, 6),
      padl(r.content, 9),
      padl(r.tbt, 5),
      padl(r.longTasks.length, 3),
      padl(r.js.n, 4),
      padl(r.js.kb, 6),
      padl(r.js.wireKb, 5),
      padl(r.api.length, 4),
      " " + apiStr.slice(0, 220),
    );
  });
}
console.log(`\nĐã ghi ${OUT}/reload-${TAG}.json`);
await browser.close();
