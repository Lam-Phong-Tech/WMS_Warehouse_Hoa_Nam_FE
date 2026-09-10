/**
 * Lấy mẫu CPU (CDP Profiler) trong một lần chuyển màn / bấm tab, rồi gộp self-time
 * theo hàm + file để thấy tiền chảy vào đâu. Chạy ở CPU x1 để số lấy mẫu sạch.
 *
 *   node scripts/perf/_profile-transition.mjs /reports/recipient
 *   node scripts/perf/_profile-transition.mjs /reports/import-quality "Dạng hộp"
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5199';
const target = process.argv[2] ?? '/reports/recipient';
const tabLabel = process.argv[3];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.getByPlaceholder('your@gmail.com').fill('admin-01@gmail.com');
await page.locator('input[type="password"]').fill((process.env.BENCH_PASSWORD || (() => { throw new Error("BENCH_PASSWORD chưa được đặt: script đo không còn mật khẩu mặc định."); })()));
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.waitForURL(/\/dashboard/);
await page.waitForLoadState('networkidle');

async function go(path) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForURL((u) => u.pathname === path);
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.querySelectorAll('*').length > 800, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
}

// Warm the chunk first so the profile shows RENDER cost, not download/parse.
await go(target);
await go('/dashboard');

await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
await cdp.send('Profiler.start');
if (tabLabel) {
  await go(target);
  await page.getByRole('tab', { name: tabLabel }).first().click();
  await page.waitForTimeout(1500);
} else {
  await go(target);
}
const { profile } = await cdp.send('Profiler.stop');

// Aggregate self time per (function, url:line)
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const selfUs = new Map();
const dt = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i += 1) {
  const n = nodes.get(profile.samples[i]);
  const cf = n.callFrame;
  const url = (cf.url || '').split('/').pop().split('?')[0];
  const key = `${cf.functionName || '(anon)'}  ${url}:${cf.lineNumber}`;
  selfUs.set(key, (selfUs.get(key) ?? 0) + (dt[i] ?? 0));
}
const total = [...selfUs.values()].reduce((a, b) => a + b, 0);
const top = [...selfUs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28);
console.log(`\nProfile ${target}${tabLabel ? ' ▸ ' + tabLabel : ''} — total sampled ${(total / 1000).toFixed(0)} ms\n`);
for (const [k, us] of top) console.log(`${(us / 1000).toFixed(1).padStart(8)} ms  ${((us / total) * 100).toFixed(1).padStart(5)}%  ${k}`);

// Aggregate by file
const byFile = new Map();
for (const [k, us] of selfUs) {
  const file = k.split('  ')[1].split(':')[0] || '(native)';
  byFile.set(file, (byFile.get(file) ?? 0) + us);
}
console.log('\n--- theo file ---');
for (const [f, us] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14))
  console.log(`${(us / 1000).toFixed(1).padStart(8)} ms  ${((us / total) * 100).toFixed(1).padStart(5)}%  ${f}`);

await browser.close();
