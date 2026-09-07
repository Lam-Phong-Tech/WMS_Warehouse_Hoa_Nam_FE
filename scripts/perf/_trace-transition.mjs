/**
 * Chrome trace của một lần chuyển màn (hoặc bấm tab), gộp thời gian luồng chính
 * theo LOẠI việc: compile/parse JS, chạy JS, tính style, layout, paint…
 * Đây là câu trả lời cho "(program)" trong profiler JS.
 *
 *   node scripts/perf/_trace-transition.mjs /reports/recipient
 *   node scripts/perf/_trace-transition.mjs /reports/import-quality "Dạng hộp"
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:5199';
const target = process.argv[2] ?? '/reports/recipient';
const tabLabel = process.argv[3];
const CPU = Number(process.env.CPU ?? 1);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
if (CPU > 1) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
}

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.getByPlaceholder('your@gmail.com').fill('admin-01@gmail.com');
await page.locator('input[type="password"]').fill('Cntt@1234');
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
  await page.waitForTimeout(800);
}

const warm = process.env.WARM !== '0';
if (warm) { await go(target); await go('/dashboard'); }

const tracePath = 'build/perf/trace.json';
await browser.startTracing(page, {
  path: tracePath,
  categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'v8', 'disabled-by-default-v8.compile'],
});
if (tabLabel) {
  await go(target);
  await page.getByRole('tab', { name: tabLabel }).first().click();
  await page.waitForTimeout(2000);
} else {
  await go(target);
}
await browser.stopTracing();
await browser.close();

const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
const events = trace.traceEvents ?? trace;
// Only complete events ('X') on the main renderer thread carry `dur`.
const buckets = new Map();
const byFn = new Map();
let mainTid = null;
// pick the thread with the most 'X' events named RunTask as the main thread
const tidCount = new Map();
for (const e of events) if (e.ph === 'X' && ['FunctionCall','Layout','UpdateLayoutTree','Paint','v8.callFunction'].includes(e.name)) tidCount.set(e.pid + ':' + e.tid, (tidCount.get(e.pid + ':' + e.tid) ?? 0) + (e.dur || 0));
mainTid = [...tidCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

const CATS = {
  'v8.compile': 'compile/parse JS', 'V8.CompileScript': 'compile/parse JS', 'v8.compileModule': 'compile/parse JS', 'V8.CompileCode': 'compile/parse JS',
  'EvaluateScript': 'evaluate script', 'FunctionCall': 'run JS', 'v8.callFunction': 'run JS', 'FireAnimationFrame': 'run JS', 'v8.run': 'run JS', 'TimerFire': 'run JS', 'EventDispatch': 'run JS', 'XHRReadyStateChange': 'run JS', 'XHRLoad': 'run JS',
  'UpdateLayoutTree': 'style recalc', 'ScheduleStyleRecalculation': 'style recalc',
  'Layout': 'layout', 'PrePaint': 'layout', 'UpdateLayerTree': 'layout',
  'Paint': 'paint', 'CompositeLayers': 'paint', 'Layerize': 'paint', 'Commit': 'paint', 'RasterTask': 'paint', 'HitTest': 'layout',
  'ParseHTML': 'parse HTML', 'ParseAuthorStyleSheet': 'parse CSS',
  'MinorGC': 'GC', 'MajorGC': 'GC', 'GCEvent': 'GC', 'V8.GCScavenger': 'GC',
};
// self-time attribution: sort by start, use a stack per category
const main = events.filter((e) => e.pid + ':' + e.tid === mainTid && e.ph === 'X' && typeof e.dur === 'number').sort((a, b) => a.ts - b.ts);
// compute self time = dur - sum(children dur)
const stack = [];
for (const e of main) {
  while (stack.length && stack[stack.length - 1].ts + stack[stack.length - 1].dur <= e.ts) stack.pop();
  if (stack.length) stack[stack.length - 1].childDur = (stack[stack.length - 1].childDur ?? 0) + e.dur;
  stack.push(e);
}
for (const e of main) {
  const self = e.dur - (e.childDur ?? 0);
  const cat = CATS[e.name] ?? (e.name === 'RunTask' || e.name === 'RunMicrotasks' || e.name === 'ThreadControllerImpl::RunTask' ? 'other/task' : 'other: ' + e.name);
  buckets.set(cat, (buckets.get(cat) ?? 0) + self);
  if (e.name === 'FunctionCall' && e.args?.data) {
    const d = e.args.data;
    const k = `${d.functionName || '(anon)'} ${(d.url || '').split('/').pop()}:${d.lineNumber ?? ''}`;
    byFn.set(k, (byFn.get(k) ?? 0) + e.dur);
  }
}
const total = [...buckets.values()].reduce((a, b) => a + b, 0);
console.log(`\nTrace ${target}${tabLabel ? ' ▸ ' + tabLabel : ''} — CPU x${CPU} — main thread busy ${(total / 1000).toFixed(0)} ms\n`);
for (const [k, us] of [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14))
  console.log(`${(us / 1000).toFixed(1).padStart(8)} ms  ${((us / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
console.log('\n--- FunctionCall nặng nhất (tổng, gồm con) ---');
for (const [k, us] of [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10))
  console.log(`${(us / 1000).toFixed(1).padStart(8)} ms  ${k}`);
// Long tasks
const lts = main.filter((e) => e.name === 'RunTask' && e.dur > 50_000).sort((a, b) => b.dur - a.dur).slice(0, 6);
console.log('\n--- long task (>50ms) ---');
for (const e of lts) console.log(`${(e.dur / 1000).toFixed(0).padStart(6)} ms`);
