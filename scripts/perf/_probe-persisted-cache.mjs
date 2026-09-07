/**
 * Soi bản ghi persisted query cache (IndexedDB) sau khi vào một màn: query nào
 * ĐƯỢC ghi, query nào bị loại vì quá khổ, và mỗi cái nặng bao nhiêu.
 *
 *   node scripts/perf/_probe-persisted-cache.mjs /master-data/skus
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:5199";
const target = process.argv[2] ?? "/master-data/skus";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByPlaceholder("your@gmail.com").fill("admin-01@gmail.com");
await page.locator('input[type="password"]').fill("Cntt@1234");
await page.getByRole("button", { name: "Đăng nhập" }).click();
await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
await page.goto(`${BASE}${target}`, { waitUntil: "networkidle", timeout: 60_000 });
// Persister ghi sau 2 s yên tĩnh.
await page.waitForTimeout(4000);

const dump = await page.evaluate(async () => {
  const open = () =>
    new Promise((resolve) => {
      const r = indexedDB.open("wms-query-cache", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    });
  const db = await open();
  if (!db) return { error: "không mở được IndexedDB" };
  const all = await new Promise((resolve) => {
    const tx = db.transaction("dehydrated", "readonly");
    const store = tx.objectStore("dehydrated");
    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();
    tx.oncomplete = () => resolve({ keys: keysReq.result, vals: valsReq.result });
    tx.onerror = () => resolve({ keys: [], vals: [] });
  });
  return {
    namespaces: all.keys,
    records: all.vals.map((rec) => ({
      buildId: rec.buildId,
      savedAt: rec.savedAt,
      queries: (rec.state?.queries ?? []).map((q) => ({
        key: JSON.stringify(q.queryKey).slice(0, 90),
        bytes: JSON.stringify(q).length,
      })),
    })),
  };
});

const live = await page.evaluate(() => {
  // Danh sách query đang sống trong RAM để đối chiếu cái nào KHÔNG được ghi.
  const el = document.querySelector("#root");
  void el;
  return null;
});
void live;

console.log(`\nMàn: ${target}`);
console.log("namespace:", dump.namespaces);
for (const rec of dump.records ?? []) {
  const total = rec.queries.reduce((s, q) => s + q.bytes, 0);
  console.log(
    `\nbuild ${rec.buildId} — ${rec.queries.length} query, tổng ${(total / 1024).toFixed(0)} KB`,
  );
  for (const q of rec.queries.sort((a, b) => b.bytes - a.bytes))
    console.log(`  ${String(Math.round(q.bytes / 1024)).padStart(5)} KB  ${q.key}`);
}
if (dump.error) console.log("LỖI:", dump.error);

await browser.close();
