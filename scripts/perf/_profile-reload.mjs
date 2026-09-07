/**
 * Lấy mẫu CPU (CDP Profiler) TRỌN một lần F5 của trang đã đăng nhập, rồi gộp
 * self-time theo hàm/file — và tách riêng cửa sổ "sau khi /auth/refresh về cho tới
 * lúc request dữ liệu đầu tiên bắn ra" để biết khoảng trống đó là CPU gì.
 *
 *   node scripts/perf/_profile-reload.mjs /dashboard
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:5199";
const target = process.argv[2] ?? "/dashboard";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByPlaceholder("your@gmail.com").fill("admin-01@gmail.com");
await page.locator('input[type="password"]').fill("Cntt@1234");
await page.getByRole("button", { name: "Đăng nhập" }).click();
await page.waitForURL(/\/dashboard/);
await page.waitForLoadState("networkidle");
// Làm nóng: vào trang một lần để SW cache chunk, rồi F5 có profile.
await page.goto(`${BASE}${target}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const cdp = await context.newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
const t0 = Date.now();
await page.goto(`${BASE}${target}`, { waitUntil: "commit" });
await page.waitForFunction(
  () => {
    const main = document.querySelector("main") ?? document.body;
    const text = main.innerText || "";
    const sk = main.querySelectorAll(
      '[data-ui-state="loading"], .MuiSkeleton-root',
    ).length;
    return (
      !/Đang tải|Loading/.test(text) &&
      sk === 0 &&
      main.querySelectorAll("*").length > 300 &&
      text.replace(/\s+/g, "").length > 300
    );
  },
  null,
  { timeout: 30000, polling: 16 },
);
await page.waitForTimeout(300);
const { profile } = await cdp.send("Profiler.stop");
const wall = Date.now() - t0;

// Cửa sổ quan tâm theo đồng hồ của TRANG: refresh về → request dữ liệu đầu.
const win = await page.evaluate(() => {
  const res = performance.getEntriesByType("resource");
  const api = res
    .filter((r) => r.name.includes("/api/v1/"))
    .sort((a, b) => a.startTime - b.startTime);
  const refresh = api.find((r) => r.name.includes("/auth/refresh"));
  const firstData = api.find(
    (r) => !r.name.includes("/auth/") && r.startTime > (refresh?.responseEnd ?? 0),
  );
  const nav = performance.getEntriesByType("navigation")[0];
  return {
    timeOrigin: performance.timeOrigin,
    refreshEnd: refresh?.responseEnd ?? null,
    firstDataStart: firstData?.startTime ?? null,
    firstData: firstData?.name.split("/api/v1")[1] ?? null,
    dcl: nav.domContentLoadedEventEnd,
  };
});

// profile.startTime/endTime và timeDeltas tính bằng micro-giây kể từ một mốc riêng;
// quy về ms trang bằng cách neo endTime = lúc Profiler.stop (≈ performance.now() lúc đó).
const nowPage = await page.evaluate(() => performance.now());
const endUs = profile.endTime;
const toPageMs = (us) => nowPage - (endUs - us) / 1000;

const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const selfAll = new Map();
const selfWin = new Map();
let t = profile.startTime;
let inWinUs = 0;
for (let i = 0; i < profile.samples.length; i += 1) {
  t += profile.timeDeltas[i] ?? 0;
  const n = nodes.get(profile.samples[i]);
  const cf = n.callFrame;
  const url = (cf.url || "").split("/").pop().split("?")[0];
  const key = `${cf.functionName || "(anon)"}  ${url || "(native)"}:${cf.lineNumber}`;
  const d = profile.timeDeltas[i + 1] ?? 0;
  selfAll.set(key, (selfAll.get(key) ?? 0) + d);
  const ms = toPageMs(t);
  if (
    win.refreshEnd != null &&
    win.firstDataStart != null &&
    ms >= win.refreshEnd &&
    ms <= win.firstDataStart
  ) {
    selfWin.set(key, (selfWin.get(key) ?? 0) + d);
    inWinUs += d;
  }
}

function report(title, map, limit = 22) {
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  console.log(`\n=== ${title} — tổng mẫu ${(total / 1000).toFixed(0)} ms ===`);
  const idleKeys = ["(idle)", "(program)", "(garbage collector)", "(root)"];
  for (const [k, us] of [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)) {
    console.log(
      `${(us / 1000).toFixed(1).padStart(8)} ms ${((us / total) * 100).toFixed(1).padStart(5)}%  ${k}${idleKeys.some((x) => k.startsWith(x)) ? "   <- không phải JS" : ""}`,
    );
  }
  const byFile = new Map();
  for (const [k, us] of map) {
    const file = k.split("  ")[1].split(":")[0] || "(native)";
    byFile.set(file, (byFile.get(file) ?? 0) + us);
  }
  console.log("--- theo file ---");
  for (const [f, us] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12))
    console.log(`${(us / 1000).toFixed(1).padStart(8)} ms ${((us / total) * 100).toFixed(1).padStart(5)}%  ${f}`);
}

console.log(
  `F5 ${target}: wall ${wall} ms; DCL ${Math.round(win.dcl)} ms; /auth/refresh về lúc ${Math.round(win.refreshEnd)} ms; request dữ liệu đầu (${win.firstData}) lúc ${Math.round(win.firstDataStart)} ms → khoảng trống ${Math.round(win.firstDataStart - win.refreshEnd)} ms, trong đó CPU lấy mẫu ${(inWinUs / 1000).toFixed(0)} ms`,
);
report("TOÀN LẦN F5", selfAll);
report("CỬA SỔ refresh→data (khoảng trống)", selfWin);

await browser.close();
