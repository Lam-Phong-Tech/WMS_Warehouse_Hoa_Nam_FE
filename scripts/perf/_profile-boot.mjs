/**
 * Lấy mẫu CPU trọn một lần F5 ở CPU throttling, chia theo 3 cửa sổ của đường tới
 * hạn để biết tiền chảy vào đâu:
 *   A. boot        : navigationStart → mốc wms:boot        (tải + đánh giá đồ thị ESM)
 *   B. refresh     : wms:refresh:start → wms:refresh:done  (chờ mạng, CPU phải gần 0)
 *   C. render shell: wms:gate:open → request dữ liệu đầu   (dựng shell + trang)
 *
 *   CPU=4 node scripts/perf/_profile-boot.mjs /dashboard
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:5199";
const CPU = Number(process.env.CPU ?? 4);
const target = process.argv[2] ?? "/dashboard";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
if (CPU > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByPlaceholder("your@gmail.com").fill("admin-01@gmail.com");
await page.locator('input[type="password"]').fill("Cntt@1234");
await page.getByRole("button", { name: "Đăng nhập" }).click();
await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
await page.waitForLoadState("networkidle");
await page.goto(`${BASE}${target}`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(800);

await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
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
  { timeout: 60_000, polling: 32 },
);
await page.waitForTimeout(300);
const { profile } = await cdp.send("Profiler.stop");

const win = await page.evaluate(() => {
  const m = (n) =>
    performance.getEntriesByName("wms:" + n, "mark")[0]?.startTime ?? null;
  const api = performance
    .getEntriesByType("resource")
    .filter((r) => r.name.includes("/api/v1/"))
    .sort((a, b) => a.startTime - b.startTime);
  const gate = m("gate:open");
  const firstData = api.find(
    (r) => !r.name.includes("/auth/") && r.startTime >= (gate ?? 0),
  );
  return {
    boot: m("boot"),
    refreshStart: m("refresh:start"),
    refreshDone: m("refresh:done"),
    gate,
    firstDataStart: firstData?.startTime ?? null,
    now: performance.now(),
  };
});

const nowPage = win.now;
const endUs = profile.endTime;
const toPageMs = (us) => nowPage - (endUs - us) / 1000;

const WINDOWS = [
  ["A. boot (tải + đánh giá ESM)", 0, win.boot],
  ["B. chờ /auth/refresh", win.refreshStart, win.refreshDone],
  ["C. dựng shell + trang (gate → request dữ liệu đầu)", win.gate, win.firstDataStart],
];

const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
for (const [title, from, to] of WINDOWS) {
  if (from == null || to == null) {
    console.log(`\n=== ${title}: KHÔNG có mốc ===`);
    continue;
  }
  const self = new Map();
  let t = profile.startTime;
  let total = 0;
  for (let i = 0; i < profile.samples.length; i += 1) {
    t += profile.timeDeltas[i] ?? 0;
    const ms = toPageMs(t);
    if (ms < from || ms > to) continue;
    const cf = nodes.get(profile.samples[i]).callFrame;
    const url = (cf.url || "").split("/").pop().split("?")[0] || "(native)";
    const key = `${cf.functionName || "(anon)"}  ${url}`;
    const d = profile.timeDeltas[i + 1] ?? 0;
    self.set(key, (self.get(key) ?? 0) + d);
    total += d;
  }
  console.log(
    `\n=== ${title} — ${Math.round(to - from)} ms tường, ${(total / 1000).toFixed(0)} ms mẫu ===`,
  );
  const byFile = new Map();
  for (const [k, us] of self) {
    const file = k.split("  ")[1];
    byFile.set(file, (byFile.get(file) ?? 0) + us);
  }
  for (const [f, us] of [...byFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12))
    console.log(
      `${(us / 1000).toFixed(1).padStart(8)} ms ${((us / total) * 100).toFixed(1).padStart(5)}%  ${f}`,
    );
  console.log("  -- hàm --");
  for (const [k, us] of [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8))
    console.log(`${(us / 1000).toFixed(1).padStart(8)} ms  ${k}`);
}

await browser.close();
