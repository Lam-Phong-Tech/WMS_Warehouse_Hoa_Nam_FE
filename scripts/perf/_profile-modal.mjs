/**
 * Soi CPU của đúng MỘT cú bấm mở modal chi tiết ở màn Tồn kho.
 *
 *   CPU=4 node scripts/perf/_profile-modal.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:5199";
const CPU = Number(process.env.CPU ?? 4);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
if (CPU > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByPlaceholder("your@gmail.com").fill("admin-01@gmail.com");
await page.locator('input[type="password"]').fill((process.env.BENCH_PASSWORD || (() => { throw new Error("BENCH_PASSWORD chưa được đặt: script đo không còn mật khẩu mặc định."); })()));
await page.getByRole("button", { name: "Đăng nhập" }).click();
await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(1200);

const row = page.locator("main table tbody tr").first();
await row.waitFor({ state: "visible", timeout: 20_000 });

await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 150 });
await cdp.send("Profiler.start");
await row.click();
await page.waitForTimeout(1500);
const { profile } = await cdp.send("Profiler.stop");

const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
let total = 0;
for (let i = 0; i < profile.samples.length; i += 1) {
  const cf = nodes.get(profile.samples[i]).callFrame;
  const url = (cf.url || "").split("/").pop().split("?")[0] || "(native)";
  const key = `${cf.functionName || "(anon)"}  ${url}`;
  const d = profile.timeDeltas[i + 1] ?? 0;
  self.set(key, (self.get(key) ?? 0) + d);
  total += d;
}
const byFile = new Map();
for (const [k, us] of self) {
  const f = k.split("  ")[1];
  byFile.set(f, (byFile.get(f) ?? 0) + us);
}
console.log(`\nMở modal Tồn kho (CPU x${CPU}) — tổng mẫu ${(total / 1000).toFixed(0)} ms`);
console.log("--- theo file ---");
for (const [f, us] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12))
  console.log(`${(us / 1000).toFixed(1).padStart(8)} ms ${((us / total) * 100).toFixed(1).padStart(5)}%  ${f}`);
console.log("--- theo hàm ---");
for (const [k, us] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14))
  console.log(`${(us / 1000).toFixed(1).padStart(8)} ms  ${k}`);

await browser.close();
