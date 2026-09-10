/**
 * Đo Core Web Vitals THẬT trên bản build production, bằng trình duyệt thật.
 *
 *   node scripts/perf/measure-web-vitals.mjs
 *   BASE_URL=http://localhost:5199 CPU=4 NET=3g node scripts/perf/measure-web-vitals.mjs
 *
 * Với mỗi trang: tải lại trang (cold cache và warm cache), đo
 *   TTFB, FCP, LCP (kèm phần tử LCP), CLS, TBT (tổng long-task > 50 ms),
 *   số request, tổng byte, số node DOM;
 * rồi thực hiện các thao tác thật (bấm tab, mở modal, lọc, phân trang) và đo
 * INP theo cách Chrome đo: max(interaction latency) qua PerformanceObserver
 * `event` + `first-input` với durationThreshold 0.
 *
 * VÌ SAO KHÔNG DÙNG LIGHTHOUSE: Lighthouse chỉ mô phỏng INP bằng TBT. Yêu cầu
 * của dự án là INP ≤ 100 ms trên thao tác THẬT (bấm tab báo cáo, mở modal), nên
 * ở đây bấm thật rồi đọc `event` entries — đúng định nghĩa INP của web-vitals.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5199';
const EMAIL = process.env.BENCH_EMAIL ?? 'admin-01@gmail.com';
const PASSWORD = (process.env.BENCH_PASSWORD || (() => { throw new Error("BENCH_PASSWORD chưa được đặt: script đo không còn mật khẩu mặc định."); })());
const CPU = Number(process.env.CPU ?? 1);
const TAG = process.env.TAG ?? 'run';
const OUT = process.env.OUT_DIR ?? 'build/perf';

/** Cài observer TRƯỚC khi trang chạy script nào — nếu không sẽ mất LCP/CLS đầu tiên. */
const INIT = () => {
  window.__v = { lcp: 0, lcpEl: '', cls: 0, fcp: 0, longTasks: [], inp: 0, events: [] };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__v.lcp = e.startTime;
        const el = e.element;
        window.__v.lcpEl = el ? (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + (el.textContent ? ' "' + el.textContent.trim().slice(0, 40) + '"' : '')) : '(no element)';
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__v.fcp = e.startTime;
    }).observe({ type: 'paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__v.longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
    // INP: độ trễ tương tác lớn nhất. `duration` của entry `event` đã gồm
    // input delay + xử lý + thời gian tới khung hình kế tiếp.
    const track = (e) => {
      if (e.interactionId || e.entryType === 'first-input') {
        window.__v.events.push({ name: e.name, d: e.duration });
        if (e.duration > window.__v.inp) window.__v.inp = e.duration;
      }
    };
    new PerformanceObserver((l) => l.getEntries().forEach(track)).observe({ type: 'event', buffered: true, durationThreshold: 0 });
    new PerformanceObserver((l) => l.getEntries().forEach(track)).observe({ type: 'first-input', buffered: true });
  } catch (err) { window.__v.error = String(err); }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(INIT);
const page = await context.newPage();

if (CPU > 1) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
}

let bytes = 0;
let requests = 0;
page.on('response', async (r) => {
  requests += 1;
  const len = Number(r.headers()['content-length'] ?? 0);
  bytes += Number.isFinite(len) ? len : 0;
});

const readVitals = () => page.evaluate(() => ({
  ttfb: performance.getEntriesByType('navigation')[0]?.responseStart ?? 0,
  fcp: window.__v.fcp,
  lcp: window.__v.lcp,
  lcpEl: window.__v.lcpEl,
  cls: window.__v.cls,
  tbt: window.__v.longTasks.reduce((s, d) => s + Math.max(0, d - 50), 0),
  longTasks: window.__v.longTasks.length,
  dom: document.querySelectorAll('*').length,
}));

const resetCounters = () => { bytes = 0; requests = 0; };

async function settle(ms = 1200) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('your@gmail.com').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await settle();
}

/** Tải lại một trang và đọc chỉ số của CHÍNH lần tải đó. */
async function loadPage(path, { warm }) {
  if (!warm) await context.clearCookies({ name: '__never' }).catch(() => {});
  resetCounters();
  await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 60_000 });
  await settle();
  const v = await readVitals();
  return { path, warm, ...v, requests, kb: Math.round(bytes / 1024) };
}

const PAGES = [
  ['/login', 'Đăng nhập'],
  ['/dashboard', 'Tổng quan'],
  ['/inventory', 'Tồn kho'],
  ['/inbound', 'Nhập kho'],
  ['/outbound', 'Xuất kho'],
  ['/warranty', 'Bảo hành'],
  ['/reports/inventory-flow', 'Báo cáo Nhập–Xuất–Tồn'],
];

const results = { tag: TAG, cpu: CPU, base: BASE, pages: [], interactions: [] };

// ---- LCP/CLS/TTFB: tải lại từng trang (cold rồi warm) ----------------------
await login();
for (const [path] of PAGES) {
  if (path === '/login') continue;
  results.pages.push(await loadPage(path, { warm: false }));
  results.pages.push(await loadPage(path, { warm: true }));
}
// /login đo ở phiên chưa đăng nhập
await context.clearCookies();
await page.goto(`${BASE}/login`, { waitUntil: 'load' });
await settle();
results.pages.push({ path: '/login', warm: false, ...(await readVitals()), requests, kb: Math.round(bytes / 1024) });

// ---- INP: thao tác thật ----------------------------------------------------
await login();

async function interact(label, path, action) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 60_000 });
  await settle(1500);
  await page.evaluate(() => { window.__v.inp = 0; window.__v.events = []; });
  try {
    await action();
  } catch (err) {
    results.interactions.push({ label, path, inp: null, note: 'không thực hiện được: ' + String(err).slice(0, 80) });
    return;
  }
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({ inp: window.__v.inp, n: window.__v.events.length, worst: window.__v.events.slice().sort((a, b) => b.d - a.d)[0] ?? null }));
  results.interactions.push({ label, path, inp: Math.round(r.inp), samples: r.n, worst: r.worst });
}

const clickIfVisible = async (loc, timeout = 5000) => {
  await loc.first().waitFor({ state: 'visible', timeout });
  await loc.first().click();
  await page.waitForTimeout(400);
};

await interact('Bấm tab trong báo cáo Tồn kho & đối soát', '/reports/stock-reconcile', async () => {
  const tabs = page.locator('main [role="tab"]');
  await tabs.first().waitFor({ state: 'visible', timeout: 20_000 });
  const n = await tabs.count();
  for (let i = 1; i < Math.min(n, 3); i += 1) { await tabs.nth(i).click(); await page.waitForTimeout(600); }
  if (n > 1) await tabs.nth(0).click();
});

await interact('Gõ vào ô lọc của báo cáo Truy vết', '/reports/traceability', async () => {
  const box = page.getByLabel('Người thực hiện').first();
  await box.waitFor({ state: 'visible', timeout: 20_000 });
  await box.click();
  for (const ch of 'BOSCH') { await page.keyboard.type(ch); await page.waitForTimeout(160); }
});

await interact('Mở modal chi tiết ở Tồn kho', '/inventory', async () => {
  const row = page.locator('main table tbody tr').first();
  await row.waitFor({ state: 'visible', timeout: 20_000 });
  await row.click();
});

await interact('Chuyển trang (pagination) ở Nhập kho', '/inbound', async () => {
  // Thanh phân trang là MUI Pagination (UiPagination): nút "trang sau" mang
  // aria-label do MUI sinh ("Go to next page"), KHÔNG phải nhãn tiếng Việt —
  // locator cũ theo tên tiếng Việt nên phép đo này luôn timeout và bỏ trống.
  // Lùi dần: nút next theo aria-label → nút số trang 2 → nút bật cuối cùng.
  const pager = page
    .locator('nav[aria-label*="pagination" i], .MuiPagination-root')
    .first();
  await pager.waitFor({ state: 'visible', timeout: 20_000 });
  const next = pager.locator('button[aria-label*="next" i]:not([disabled])');
  if (await next.count()) {
    await clickIfVisible(next, 10_000);
    return;
  }
  const page2 = pager.getByRole('button', { name: /^2$/ });
  if (await page2.count()) {
    await clickIfVisible(page2, 10_000);
    return;
  }
  await clickIfVisible(pager.locator('button:not([disabled])').last(), 10_000);
});

await interact('Mở menu điều hướng và bấm mục', '/dashboard', async () => {
  const item = page.locator('[data-nav-path="/inventory"]');
  const submenuId = await item.evaluate((el) => el.closest('[id^="hn-nav-submenu"]')?.id ?? null).catch(() => null);
  if (submenuId) {
    const header = page.locator(`button.hn-mvp-group[aria-controls="${submenuId}"]`);
    if ((await header.getAttribute('aria-expanded')) !== 'true') { await header.click(); await page.waitForTimeout(400); }
  }
  await item.click();
  await page.waitForTimeout(800);
});

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/web-vitals-${TAG}.json`, JSON.stringify(results, null, 1));

const pad = (s, n) => String(s).padEnd(n);
const padl = (s, n) => String(s).padStart(n);
const ms = (v) => (v == null ? '—' : Math.round(v) + ' ms');
console.log(`\nCore Web Vitals — ${BASE} — CPU x${CPU}\n`);
console.log(pad('trang', 30), pad('cache', 6), padl('TTFB', 8), padl('FCP', 8), padl('LCP', 9), padl('CLS', 7), padl('TBT', 8), padl('req', 5), padl('KB', 7), padl('DOM', 6), ' LCP element');
for (const p of results.pages) {
  console.log(pad(p.path, 30), pad(p.warm ? 'warm' : 'cold', 6), padl(ms(p.ttfb), 8), padl(ms(p.fcp), 8), padl(ms(p.lcp), 9), padl(p.cls.toFixed(3), 7), padl(ms(p.tbt), 8), padl(p.requests, 5), padl(p.kb, 7), padl(p.dom, 6), ' ' + String(p.lcpEl).slice(0, 46));
}
console.log(`\n${pad('thao tác (INP)', 46)}${padl('INP', 9)}  ghi chú`);
for (const i of results.interactions) {
  console.log(pad(i.label, 46) + padl(i.inp == null ? '—' : i.inp + ' ms', 9) + '  ' + (i.note ?? `${i.samples} tương tác, chậm nhất: ${i.worst ? i.worst.name + ' ' + Math.round(i.worst.d) + ' ms' : '—'}`));
}
console.log(`\nĐã ghi ${OUT}/web-vitals-${TAG}.json`);

await browser.close();
