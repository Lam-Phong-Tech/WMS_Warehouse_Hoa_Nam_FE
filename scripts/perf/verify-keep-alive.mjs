/**
 * KIỂM TRA ĐẦU-CUỐI cơ chế giữ sống màn báo cáo (KeepAliveOutlet) trên bản build
 * production đang chạy ở BASE_URL, bằng trình duyệt thật (Playwright/Chromium).
 *
 *   node scripts/perf/verify-keep-alive.mjs
 *   BASE_URL=http://localhost:5199 node scripts/perf/verify-keep-alive.mjs
 *
 * Mỗi dòng in ra là một điều kiện PASS/FAIL; script thoát mã 1 nếu có FAIL.
 * Các điều kiện:
 *   1. Rời màn báo cáo rồi quay lại: bộ lọc đã gõ, tab đã chọn, vị trí cuộn còn nguyên.
 *   2. Quay lại KHÔNG phát request API nào (dữ liệu còn trong cache) và không tải chunk.
 *   3. Drawer/Dialog (portal, nằm ngoài cây DOM của trang) phải BIẾN MẤT khi rời trang
 *      — không được lơ lửng đè lên màn khác — và hiện lại đúng chỗ khi quay về.
 *   4. Không giữ quá MAX_KEPT (6) màn; màn không thuộc nhóm báo cáo vẫn remount.
 *   5. Deep-link ?screen= của màn KHÔNG keep-alive vẫn chạy (IAM-02 mở modal tạo user).
 *   6. Hiệu ứng chuyển trang (.hn-page-transition) vẫn có mặt; không lỗi console.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:5199';
const EMAIL = process.env.BENCH_EMAIL ?? 'admin-01@gmail.com';
const PASSWORD = (process.env.BENCH_PASSWORD || (() => { throw new Error("BENCH_PASSWORD chưa được đặt: script đo không còn mật khẩu mặc định."); })());

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
});
page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + String(err).slice(0, 200)));
// Ghi kèm URL của response lỗi để dòng "Failed to load resource" của console có địa chỉ.
page.on('response', async (r) => {
  if (r.status() >= 400) {
    const path = r.url().replace(/^.*\/api\/v1/, '');
    const body = (await r.text().catch(() => '')).slice(0, 120);
    consoleErrors.push(`HTTP ${r.status()} ${r.request().method()} ${path} ${body}`);
  }
});

let apiCalls = [];
let chunkLoads = [];
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/v1/')) apiCalls.push(url.replace(BASE, ''));
  else if (/\/assets\/.*\.(js|css)$/.test(url)) chunkLoads.push(url.split('/').pop());
});
const resetCounters = () => {
  apiCalls = [];
  chunkLoads = [];
};

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures += 1;
}

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('your@gmail.com').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Bấm mục menu THẬT (để chạy cả prefetch lẫn handler điều hướng). Mục con nằm trong
 * nhóm gập (grid 0fr + inert — vẫn có hộp nên isVisible() không tin được) ⇒ luôn
 * tra nhóm chứa nó qua aria-controls và mở nếu aria-expanded chưa true.
 */
/**
 * Đánh dấu section ĐANG hiển thị trước khi điều hướng. Router đổi URL ngay nhưng
 * React commit trang mới trong một transition — trang cũ còn trên màn hình tới lúc
 * đó — nên "có nội dung thật" phải là nội dung của section KHÁC section vừa đánh dấu.
 */
async function markVisible() {
  await page.evaluate(() => {
    for (const s of document.querySelectorAll('main section.hn-mvp-screen')) {
      s.removeAttribute('data-probe-prev');
      if (getComputedStyle(s).display !== 'none') s.setAttribute('data-probe-prev', '1');
    }
  });
}

async function clickNav(path) {
  await markVisible();
  const item = page.locator(`[data-nav-path="${path}"]`);
  const submenuId = await item.evaluate((el) => el.closest('[id^="hn-nav-submenu"]')?.id ?? null);
  if (submenuId) {
    const header = page.locator(`button.hn-mvp-group[aria-controls="${submenuId}"]`);
    if ((await header.getAttribute('aria-expanded')) !== 'true') {
      await header.click();
      await page.waitForFunction(
        (id) => document.getElementById(id)?.getAttribute('aria-hidden') === 'false',
        submenuId,
      );
      await page.waitForTimeout(250); // hết transition mở nhóm
    }
  }
  await item.hover();
  await item.click();
  await page.waitForURL((u) => u.pathname === path, { timeout: 15_000 });
}

/**
 * "Nội dung thật" chỉ xét TRONG section đang hiển thị. Các màn giữ sống bị ẩn
 * (display:none) vẫn nằm trong <main>: màn bị ẩn giữa lúc đang tải thì giữ nguyên
 * loader tới khi hiện lại (effect/subscription của nó đã được gỡ) — đó là chủ ý,
 * không phải trang hiện tại chưa xong.
 */
async function waitForRealContent(timeoutMs = 30_000) {
  await page.waitForFunction(
    () => {
      const main = document.querySelector('main') ?? document.body;
      const visible = [...main.querySelectorAll('section.hn-mvp-screen')]
        .find((s) => getComputedStyle(s).display !== 'none');
      if (!visible || visible.hasAttribute('data-probe-prev')) return false; // trang cũ còn trên màn
      const text = visible.innerText || '';
      const loading = /Đang tải|Loading/.test(text);
      const skeletons = [...visible.querySelectorAll('[data-ui-state="loading"], .MuiSkeleton-root')]
        .filter((el) => !el.closest('[data-lazy]:not(.lazy-ready)')).length;
      return !loading && skeletons === 0 && text.replace(/\s+/g, '').length > 300;
    },
    null,
    { timeout: timeoutMs, polling: 32 },
  );
  await page.waitForLoadState('networkidle').catch(() => {});
}

const visibleOverlays = () =>
  page.evaluate(() => {
    const isShown = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    return [...document.querySelectorAll('.MuiDrawer-root, .MuiDialog-root')].filter(isShown).length;
  });

const keptSections = () =>
  page.evaluate(() => document.querySelectorAll('main section.hn-mvp-screen').length);

await login();

// ---------- 1 + 2 + 3: Truy vết → Dashboard → Truy vết -------------------------------
await clickNav('/reports/traceability');
await waitForRealContent();

const actor = page.getByLabel('Người thực hiện').first();
await actor.fill('kiem-tra-keep-alive');

// Mở drawer chứng cứ bằng cách bấm dòng ledger đầu tiên (nếu có dữ liệu).
const firstRow = page.locator('main table tbody tr').first();
await firstRow.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
let drawerOpened = false;
if (await firstRow.isVisible().catch(() => false)) {
  await firstRow.click();
  await page.waitForTimeout(400);
  drawerOpened = (await visibleOverlays()) > 0;
}
check('Drawer chứng cứ mở được trước khi rời trang', drawerOpened || !(await firstRow.isVisible().catch(() => false)),
  drawerOpened ? 'drawer đang mở' : 'không có dòng ledger để mở (bỏ qua)');

// Drawer của MUI là modal (backdrop chặn chuột) nên người dùng không bấm được menu
// khi nó đang mở — đường rời trang THẬT lúc này là nút Back của trình duyệt.
resetCounters();
await markVisible();
await page.goBack();
await page.waitForURL((u) => u.pathname === '/dashboard', { timeout: 15_000 });
await waitForRealContent();
check('Rời trang (Back) khi drawer đang mở: drawer KHÔNG còn hiển thị đè lên Dashboard', (await visibleOverlays()) === 0);
check('Rời trang: màn báo cáo vẫn được giữ trong DOM (ẩn)', (await keptSections()) >= 2,
  `${await keptSections()} section`);
check('Dashboard (không keep-alive) có .hn-page-transition',
  await page.evaluate(() => !!document.querySelector('main section.hn-page-transition')));

resetCounters();
await markVisible();
await page.goForward();
await page.waitForURL((u) => u.pathname === '/reports/traceability', { timeout: 15_000 });
await waitForRealContent();
check('Quay lại (Forward): giá trị ô lọc còn nguyên', (await actor.inputValue()) === 'kiem-tra-keep-alive');
if (drawerOpened) {
  check('Quay lại (Forward): drawer hiện lại đúng như lúc rời đi', (await visibleOverlays()) > 0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.MuiDrawer-root .MuiBackdrop-root'), null, { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(300);
}
check('Quay lại (Forward): KHÔNG gọi API', apiCalls.length === 0, apiCalls.slice(0, 3).join(', ') || '0 request');

// Vòng hai: đi–về bằng bấm menu thật (chạy cả prefetch lẫn handler điều hướng).
await page.evaluate(() => { document.querySelector('main').scrollTop = 700; });
await page.waitForTimeout(300);
const scrollBefore = await page.evaluate(() => document.querySelector('main').scrollTop);
await clickNav('/dashboard');
const topAtUrlChange = await page.evaluate(() => document.querySelector('main').scrollTop);
await waitForRealContent();
const topAfterContent = await page.evaluate(() => document.querySelector('main').scrollTop);
await page.waitForTimeout(500);
const topSettled = await page.evaluate(() => document.querySelector('main').scrollTop);
check('Sang trang KHÔNG keep-alive: về đầu khung cuộn (không "dính" 700px của màn trước)',
  topSettled === 0, `scrollTop lúc đổi URL=${topAtUrlChange}, sau nội dung=${topAfterContent}, sau 500ms=${topSettled}`);
resetCounters();
const t0 = Date.now();
await clickNav('/reports/traceability');
await waitForRealContent();
const backMs = Date.now() - t0;
check('Quay lại (bấm menu): giá trị ô lọc còn nguyên', (await actor.inputValue()) === 'kiem-tra-keep-alive');
const scrollAfter = await page.evaluate(() => document.querySelector('main').scrollTop);
check('Quay lại (bấm menu): vị trí cuộn được giữ', Math.abs(scrollAfter - scrollBefore) < 40,
  `${scrollBefore} → ${scrollAfter}`);
check('Quay lại (bấm menu): KHÔNG gọi API', apiCalls.length === 0, apiCalls.slice(0, 3).join(', ') || '0 request');
const ownChunks = chunkLoads.filter((c) => /Traceability|MovementTrace|movement-trace/i.test(c));
check('Quay lại (bấm menu): KHÔNG tải chunk của chính màn đó', ownChunks.length === 0,
  ownChunks.join(', ') || `0 chunk của màn (${chunkLoads.length} chunk nạp trước lúc rảnh)`);
check('Quay lại (bấm menu): nhanh (< 1000 ms tới nội dung thật, CPU x1)', backMs < 1000, `${backMs} ms`);

// ---------- 1b: tab đã chọn ở màn khác cũng được giữ --------------------------------
await clickNav('/reports/stock-reconcile');
await waitForRealContent();
const tabs = page.locator('main [role="tab"]');
await tabs.first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
const tabCount = await tabs.count();
if (tabCount >= 2) {
  await tabs.nth(1).click();
  await page.waitForTimeout(400);
  const chosen = await tabs.nth(1).getAttribute('aria-selected');
  await clickNav('/reports/inventory-flow');
  await waitForRealContent();
  resetCounters();
  await clickNav('/reports/stock-reconcile');
  await waitForRealContent();
  check('Tồn kho & đối soát: tab thứ hai vẫn đang chọn sau khi đi–về',
    chosen === 'true' && (await tabs.nth(1).getAttribute('aria-selected')) === 'true');
  check('Tồn kho & đối soát: quay lại không gọi API', apiCalls.length === 0, apiCalls.slice(0, 3).join(', ') || '0 request');
} else {
  check('Tồn kho & đối soát có tab để kiểm', false, `${tabCount} tab`);
}

// ---------- 4: trần MAX_KEPT và màn nghiệp vụ vẫn remount ----------------------------
for (const p of ['/reports/import-quality', '/reports/packing-label', '/reports/warranty', '/reports/recipient', '/reports/pending-evidence']) {
  await clickNav(p);
  try {
    await waitForRealContent();
  } catch {
    const why = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      const text = main.innerText || '';
      return {
        loadingText: (text.match(/Đang tải[^\n]{0,40}/g) ?? []).slice(0, 3),
        skeletons: [...main.querySelectorAll('[data-ui-state="loading"], .MuiSkeleton-root')]
          .filter((el) => !el.closest('[data-lazy]:not(.lazy-ready)')).length,
        textLen: text.replace(/\s+/g, '').length,
      };
    });
    check(`Màn ${p} đạt "nội dung thật" trong 30 s`, false, JSON.stringify(why));
  }
}
const kept = await keptSections();
check('Không giữ quá 6 màn báo cáo cùng lúc', kept <= 6, `${kept} section trong DOM`);

await clickNav('/inventory');
await waitForRealContent();
const invSearch = page.locator('main input[type="text"], main input[type="search"]').first();
let inventoryRemounts = true;
if (await invSearch.isVisible().catch(() => false)) {
  await invSearch.fill('remount-check');
  await clickNav('/dashboard');
  await waitForRealContent();
  await clickNav('/inventory');
  await waitForRealContent();
  inventoryRemounts = (await invSearch.inputValue().catch(() => '')) !== 'remount-check';
}
check('Màn nghiệp vụ (Tồn kho) KHÔNG keep-alive: quay lại là mount mới', inventoryRemounts);

// ---------- 5: deep-link ?screen= của màn không keep-alive ---------------------------
await page.goto(`${BASE}/system/users?screen=IAM-02`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
check('?screen=IAM-02 mở modal tạo người dùng', (await visibleOverlays()) > 0);
await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
check('/system/users không ?screen= thì modal đóng (remount theo key)', (await visibleOverlays()) === 0);

// ---------- 6: console sạch -----------------------------------------------------------
// WebSocket 6001 = Laravel Echo; stack dev không chạy websocket server ⇒ lỗi môi trường, không tính.
const realErrors = consoleErrors.filter((m) => !/favicon|ResizeObserver loop|localhost:6001/.test(m));
check('Không lỗi console/pageerror trong suốt kịch bản', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();
console.log(failures === 0 ? '\nTẤT CẢ ĐIỀU KIỆN PASS' : `\n${failures} điều kiện FAIL`);
process.exit(failures === 0 ? 0 : 1);
