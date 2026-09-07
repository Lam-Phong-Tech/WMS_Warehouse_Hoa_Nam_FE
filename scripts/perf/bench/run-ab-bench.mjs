/**
 * So sánh A/B XEN KẼ hai bản dựng của bàn đo.
 *
 * VÌ SAO PHẢI XEN KẼ: máy phát triển không đứng yên — trình biên dịch, bộ test,
 * dev server của phiên khác đều giành CPU. Đo hết A rồi mới đo B thì chênh lệch
 * đo được có thể chỉ là "lúc đo B máy bận hơn". Đã dính đúng bẫy này một lần:
 * một thay đổi chỉ giảm số object style lại "đo ra" chậm hơn 88 %.
 *
 * Cách chạy xen kẽ A,B,A,B,... rồi lấy TRUNG VỊ của mỗi bên khiến nhiễu theo
 * thời gian rơi đều lên cả hai, nên chênh lệch còn lại mới là chênh lệch thật.
 *
 *   node scripts/perf/bench/run-ab-bench.mjs --pairs 4
 *
 * Cần có sẵn hai thư mục `scripts/perf/bench/dist-a` và `dist-b`.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const benchDir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PAIRS = Number(argOf("pairs", "4"));
const ROWS = Number(argOf("rows", "5956"));
const CPU = Number(argOf("cpu", "4"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

/**
 * MỖI BẢN MỘT CỔNG RIÊNG.
 *
 * Không dùng tiền tố đường dẫn (/a, /b): index.html do Vite dựng tham chiếu tài
 * nguyên bằng đường dẫn TUYỆT ĐỐI (/assets/index-xxx.js), nên dưới tiền tố thì
 * yêu cầu tài nguyên rơi ra ngoài tiền tố — vừa 404, vừa nguy hiểm hơn là bản B
 * có thể nạp nhầm bundle của bản A và "đo ra" hai kết quả giống hệt nhau.
 */
function serveDir(dirName) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const requested = new URL(req.url, "http://localhost").pathname;
      // Lấy phần mở rộng từ đường dẫn ĐÃ GIẢI, không phải đường dẫn yêu cầu:
      // với "/" thì extname("/") = "" -> content-type octet-stream -> trình
      // duyệt TẢI VỀ index.html thay vì hiển thị nó.
      const file = requested === "/" ? "/index.html" : requested;
      try {
        const body = await readFile(path.join(benchDir, dirName, file));
        res.writeHead(200, {
          "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
          "cache-control": "no-store",
        });
        res.end(body);
      } catch {
        res.writeHead(404).end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, port: server.address().port }),
    );
  });
}

const OBSERVER_INIT = `
window.__perf = { events: [], longTasks: [] };
new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.events.push(e.duration); })
  .observe({ type: "event", buffered: true, durationThreshold: 16 });
new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.longTasks.push(e.duration); })
  .observe({ type: "longtask", buffered: true });
window.__perfReset = () => { window.__perf.events = []; window.__perf.longTasks = []; };
window.__perfMax = () => ({
  event: Math.max(0, ...window.__perf.events),
  longTask: Math.max(0, ...window.__perf.longTasks),
});
`;

const median = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

async function measure(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(OBSERVER_INIT);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

  const started = Date.now();
  await page.goto(`${baseUrl}/?rows=${ROWS}`, { waitUntil: "load" });
  await page.waitForSelector("tbody tr", { timeout: 180_000 });
  const mountMs = Date.now() - started;

  await page.evaluate("window.__perfReset()");
  await page.click('[data-testid="bench-filter"]');
  await page.keyboard.press("K");
  await page.waitForTimeout(2000);
  const keystroke = await page.evaluate("window.__perfMax()");

  await page.keyboard.press("Backspace");
  await page.waitForTimeout(1500);

  await page.evaluate("window.__perfReset()");
  await page.locator("thead th", { hasText: "SKU" }).first().click();
  await page.waitForTimeout(1500);
  const sort = await page.evaluate("window.__perfMax()");

  await context.close();
  return {
    mountMs,
    keystrokeMs: keystroke.event,
    keystrokeLongTaskMs: keystroke.longTask,
    sortMs: sort.event,
  };
}

const a = await serveDir("dist-a");
const b = await serveDir("dist-b");
const urlOf = { a: `http://127.0.0.1:${a.port}`, b: `http://127.0.0.1:${b.port}` };
const browser = await chromium.launch();

const results = { a: [], b: [] };
for (let i = 0; i < PAIRS; i += 1) {
  // Đảo thứ tự mỗi cặp: nếu bản chạy TRƯỚC luôn có lợi (hoặc bất lợi) vì trạng
  // thái máy, đảo chiều làm hiệu ứng đó triệt tiêu thay vì dồn về một bên.
  const order = i % 2 === 0 ? ["a", "b"] : ["b", "a"];
  for (const variant of order) {
    results[variant].push(await measure(browser, urlOf[variant]));
  }
  process.stdout.write(`  cặp ${i + 1}/${PAIRS} xong\n`);
}
await browser.close();
a.server.close();
b.server.close();

const keys = Object.keys(results.a[0]);
console.log(
  `\n=== A/B XEN KẼ — ${ROWS} dòng, CPU x${CPU}, ${PAIRS} cặp, trung vị ===`,
);
console.log(
  "chỉ số".padEnd(22) + "A (cũ)".padStart(10) + "B (mới)".padStart(10) + "đổi".padStart(10),
);
for (const key of keys) {
  const a = median(results.a.map((r) => r[key]));
  const b = median(results.b.map((r) => r[key]));
  const delta = a === 0 ? "—" : `${b > a ? "+" : ""}${Math.round(((b - a) / a) * 100)}%`;
  console.log(
    key.padEnd(22) +
      String(Math.round(a)).padStart(10) +
      String(Math.round(b)).padStart(10) +
      delta.padStart(10),
  );
}
