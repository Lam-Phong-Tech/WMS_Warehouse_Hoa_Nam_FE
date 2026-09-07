import { chromium } from "playwright";
const BASE = "http://localhost:5199";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.getByPlaceholder("your@gmail.com").fill("admin-01@gmail.com");
await p.locator('input[type="password"]').fill("Cntt@1234");
await p.getByRole("button", { name: "Đăng nhập" }).click();
await p.waitForURL(/\/dashboard/, { timeout: 60000 });
await p.goto(`${BASE}/master-data/skus`, { waitUntil: "networkidle" });
await p.waitForTimeout(4000);            // để persister ghi xong (debounce 2s)
const reqs = [];
p.on("request", (r) => { if (r.url().includes("/api/v1/")) reqs.push(r.url().split("/api/v1")[1].split("?")[0]); });
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);
console.log("request sau F5:", reqs.length);
for (const r of reqs) console.log("  ", r);
const st = await p.evaluate(() => {
  const marks = performance.getEntriesByType("mark").filter(m => m.name.startsWith("wms:")).map(m => m.name + "=" + Math.round(m.startTime));
  return marks;
});
console.log("mốc:", st.join(" "));
await b.close();
