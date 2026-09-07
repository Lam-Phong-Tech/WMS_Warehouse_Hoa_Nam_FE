/**
 * Đo độ mượt khi CHUYỂN MÀN / CHUYỂN TAB / MỞ MODAL — bằng trình duyệt thật (Playwright,
 * Chromium headless, không bị throttle), trên bản build production đang chạy ở BASE_URL.
 *
 *   node scripts/perf/measure-transitions.mjs
 *   BASE_URL=http://localhost:5199 ROUNDS=2 node scripts/perf/measure-transitions.mjs
 *
 * Với mỗi lần chuyển, ghi lại:
 *   - contentMs : từ lúc bấm tới lúc màn mới có nội dung THẬT (hết skeleton/"Đang tải")
 *   - blockMs   : tổng thời gian luồng chính bị khoá (long task ≥ 50 ms) trong lần chuyển
 *   - worstMs   : long task dài nhất
 *   - api       : số request API phát ra trong lần chuyển
 *   - chunks    : số file JS/CSS phải tải thêm (chunk theo route)
 *   - dom       : số node DOM sau khi ổn định
 *
 * Vòng 1 = lần đầu vào mỗi màn (chunk chưa tải, cache React Query rỗng).
 * Vòng 2 = quay lại từng màn (chunk đã có, cache còn tươi) — phải gần như tức thì.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5199';
const ROUNDS = Number(process.env.ROUNDS ?? 2);
const EMAIL = process.env.BENCH_EMAIL ?? 'admin-01@gmail.com';
const PASSWORD = process.env.BENCH_PASSWORD ?? 'Cntt@1234';
const OUT = process.env.BENCH_OUT ?? 'build/perf';

const REPORTS = [
  ['/reports/inventory-flow', 'Nhập – Xuất – Tồn'],
  ['/reports/stock-reconcile', 'Tồn kho & đối soát'],
  ['/reports/traceability', 'Truy vết hàng hóa'],
  ['/reports/import-quality', 'Nhập dữ liệu / đối chiếu & lỗi dữ liệu'],
  ['/reports/packing-label', 'Nhãn đóng gói – In / In lại'],
  ['/reports/warranty', 'Bảo hành & linh kiện'],
  ['/reports/recipient', 'Xuất theo người nhận / đại lý'],
  ['/reports/pending-evidence', 'Lịch sử nhập – xuất kho'],
];
const OPERATIONAL = [
  ['/dashboard', 'Tổng quan vận hành'],
  ['/master-data/skus', 'Danh sách SKU'],
  ['/inbound', 'Danh sách phiếu nhập'],
  ['/outbound', 'Xuất kho'],
  ['/inventory', 'Tồn kho'],
  ['/warranty', 'Bảo hành'],
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// CPU=4 → giả lập máy văn phòng chậm hơn máy dev ~4 lần (đúng cách Lighthouse làm).
const CPU = Number(process.env.CPU ?? 1);
if (CPU > 1) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  console.log('CPU throttling x' + CPU);
}

// Đặt observer TRƯỚC mọi script của trang, và giữ qua mọi lần điều hướng SPA.
await context.addInitScript(() => {
  window.__perf = { longTasks: [], marks: [] };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__perf.longTasks.push({ t: e.startTime, d: e.duration });
  }).observe({ entryTypes: ['longtask'] });
});

const apiCalls = [];
const chunkLoads = [];
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/v1/')) apiCalls.push({ url, t: performance.now() });
  else if (/\/assets\/.*\.(js|css)$/.test(url)) chunkLoads.push({ url, t: performance.now() });
});

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('your@gmail.com').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Nội dung "thật" = không còn skeleton/"Đang tải", thân trang có chữ, VÀ số node DOM
 * đã đứng yên qua hai lần đọc cách nhau một khung hình — chặn việc bắt nhầm shell
 * rỗng của lúc chunk đang tải (đã xảy ra: ~380 node, 0 request API).
 */
async function waitForRealContent(timeoutMs = 30_000) {
  const started = Date.now();
  await page.waitForFunction(
    () => {
      const main = document.querySelector('main') ?? document.body;
      const text = main.innerText || '';
      const loading = /Đang tải|Loading/.test(text);
      const skeletons = main.querySelectorAll('[data-ui-state="loading"], .MuiSkeleton-root').length;
      const nodes = main.querySelectorAll('*').length;
      const stable = window.__lastNodes === nodes;
      window.__lastNodes = nodes;
      return !loading && skeletons === 0 && nodes > 300 && stable && text.replace(/\s+/g, '').length > 300;
    },
    null,
    { timeout: timeoutMs, polling: 32 },
  );
  return Date.now() - started;
}

async function settle() {
  // chờ mạng yên + 2 khung hình để React commit xong
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

function groupOf(path) {
  if (path.startsWith('/reports')) return 'Báo cáo';
  if (path.startsWith('/master-data')) return 'Danh mục';
  if (path.startsWith('/inbound')) return 'Nhập kho';
  if (path.startsWith('/outbound')) return 'Xuất kho';
  if (path.startsWith('/warranty')) return 'Bảo hành & linh kiện';
  if (path.startsWith('/inventory')) return 'Tồn kho & truy vết';
  return '';
}

async function transitionTo(path, label) {
  const apiBefore = apiCalls.length;
  const chunkBefore = chunkLoads.length;
  const prevText = await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText.slice(0, 120));
  const t0 = Date.now();
  const tPage0 = await page.evaluate(() => performance.now());

  // Điều hướng SPA qua chính router của app: pushState + popstate là đúng đường mà
  // React Router lắng nghe. Không bấm theo nhãn menu vì sidebar đang được sửa song
  // song ở phiên khác.
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForURL((u) => u.pathname === path, { timeout: 15_000 });

  // shellMs: lúc người dùng THẤY màn mới (chữ đầu trang đổi và không còn skeleton).
  await page.waitForFunction(
    (prev) => {
      const main = document.querySelector('main') ?? document.body;
      const text = main.innerText.slice(0, 120);
      const loading = main.querySelectorAll('[data-ui-state="loading"], .MuiSkeleton-root').length;
      return text !== prev && text.trim() !== '' && loading === 0;
    },
    prevText,
    { timeout: 30_000, polling: 16 },
  );
  const shellMs = Date.now() - t0;

  // completeMs: mạng yên (không request nào trong 500 ms) + DOM đứng yên 3 nhịp.
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForFunction(
    () => {
      const nodes = document.querySelectorAll('*').length;
      window.__stableN = window.__stableLast === nodes ? (window.__stableN ?? 0) + 1 : 0;
      window.__stableLast = nodes;
      return window.__stableN >= 3;
    },
    null,
    { timeout: 10_000, polling: 32 },
  ).catch(() => {});
  const completeMs = Date.now() - t0;

  const lt = await page.evaluate((from) => window.__perf.longTasks.filter((e) => e.t >= from), tPage0);
  const dom = await page.evaluate(() => document.querySelectorAll('*').length);
  const charts = await page.evaluate(() => document.querySelectorAll('.apexcharts-canvas').length);
  return {
    path, label,
    contentMs: shellMs,
    totalMs: completeMs,
    blockMs: Math.round(lt.reduce((s, e) => s + e.d, 0)),
    worstMs: Math.round(lt.reduce((m, e) => Math.max(m, e.d), 0)),
    longTasks: lt.length,
    api: apiCalls.length - apiBefore,
    chunks: chunkLoads.length - chunkBefore,
    dom, charts,
  };
}

/**
 * Bấm lần lượt từng tab nội bộ (role="tab") của màn đang mở và đo từng cú bấm:
 * thời gian tới khi DOM đứng yên, và long task sinh ra bởi cú bấm đó.
 */
async function clickInternalTabs(path) {
  const tabs = page.locator('main [role="tab"]');
  const n = await tabs.count();
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const name = ((await tab.textContent()) ?? '').trim().slice(0, 26);
    const tPage0 = await page.evaluate(() => performance.now());
    const t0 = Date.now();
    await tab.click({ timeout: 5_000 }).catch(() => {});
    // Phản hồi = tab vừa bấm được tô sáng (aria-selected). Đó là thứ người dùng
    // nhìn để biết cú bấm đã "ăn".
    await tab.evaluate((el) => new Promise((resolve) => {
      if (el.getAttribute('aria-selected') === 'true') return resolve(0);
      const obs = new MutationObserver(() => { if (el.getAttribute('aria-selected') === 'true') { obs.disconnect(); resolve(0); } });
      obs.observe(el, { attributes: true });
      setTimeout(() => { obs.disconnect(); resolve(0); }, 5000);
    })).catch(() => {});
    const ms = Date.now() - t0;
    // Rồi chờ 1,5 s để gom long task do cú bấm gây ra (panel vẽ ở lượt sau).
    await page.waitForTimeout(1_500);
    const lt = await page.evaluate((from) => window.__perf.longTasks.filter((e) => e.t >= from), tPage0);
    rows.push({
      path: `${path} ▸ ${name}`,
      label: name,
      contentMs: ms,
      totalMs: ms,
      blockMs: Math.round(lt.reduce((s, e) => s + e.d, 0)),
      worstMs: Math.round(lt.reduce((m, e) => Math.max(m, e.d), 0)),
      longTasks: lt.length,
      api: 0,
      chunks: 0,
      dom: await page.evaluate(() => document.querySelectorAll('*').length),
      charts: await page.evaluate(() => document.querySelectorAll('.apexcharts-canvas').length),
    });
  }
  return rows;
}

function printTable(title, rows) {
  console.log(`\n=== ${title} ===`);
  console.log(
    'màn'.padEnd(52) + 'shell'.padStart(9) + 'complete'.padStart(9) + 'block'.padStart(8) +
    'worst'.padStart(8) + 'LT'.padStart(4) + 'api'.padStart(5) + 'chunk'.padStart(6) + 'dom'.padStart(7) + 'chart'.padStart(6),
  );
  for (const r of rows) {
    console.log(
      r.path.padEnd(52) + (r.contentMs + 'ms').padStart(9) + (r.totalMs + 'ms').padStart(9) +
      (r.blockMs + 'ms').padStart(8) + (r.worstMs + 'ms').padStart(8) + String(r.longTasks).padStart(4) +
      String(r.api).padStart(5) + String(r.chunks).padStart(6) + String(r.dom).padStart(7) + String(r.charts).padStart(6),
    );
  }
}

await login();
const results = { rounds: [] };
for (let round = 1; round <= ROUNDS; round += 1) {
  const rows = [];
  for (const [path, label] of [...REPORTS, ...OPERATIONAL]) {
    try {
      rows.push(await transitionTo(path, label));
    } catch (e) {
      rows.push({ path, label, contentMs: -1, totalMs: -1, blockMs: -1, worstMs: -1, longTasks: 0, api: 0, chunks: 0, dom: 0, charts: 0, error: String(e).slice(0, 120) });
    }
  }
  results.rounds.push(rows);
  printTable(round === 1 ? 'VÒNG 1 — lần đầu vào mỗi màn (lạnh)' : `VÒNG ${round} — quay lại (cache còn tươi)`, rows);
}

// Chuyển qua lại nhanh giữa hai màn báo cáo nặng nhất — đúng thao tác người dùng than.
console.log('\n=== CHUYỂN QUA LẠI NHANH (traceability ⇄ stock-reconcile ×3) ===');
const pingPong = [];
for (let i = 0; i < 3; i += 1) {
  pingPong.push(await transitionTo('/reports/stock-reconcile', 'Tồn kho & đối soát'));
  pingPong.push(await transitionTo('/reports/traceability', 'Truy vết hàng hóa'));
}
printTable('ping-pong', pingPong);
results.pingPong = pingPong;

// Tab NỘI BỘ của từng màn báo cáo — người dùng than đổi tab qua lại bị lag.
const tabRows = [];
for (const [path, label] of REPORTS) {
  try {
    await transitionTo(path, label);
    tabRows.push(...(await clickInternalTabs(path)));
  } catch (e) {
    tabRows.push({ path: path + ' ▸ (lỗi)', label, contentMs: -1, totalMs: -1, blockMs: -1, worstMs: -1, longTasks: 0, api: 0, chunks: 0, dom: 0, charts: 0 });
  }
}
printTable('TAB NỘI BỘ trong 8 màn báo cáo', tabRows);
results.tabs = tabRows;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/transitions-${process.env.TAG ?? 'run'}.json`, JSON.stringify(results, null, 1));
console.log(`\nĐã ghi ${OUT}/transitions-${process.env.TAG ?? 'run'}.json`);
await browser.close();
