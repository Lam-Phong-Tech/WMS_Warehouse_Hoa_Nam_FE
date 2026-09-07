/**
 * Trình điều khiển bàn đo bảng dữ liệu lớn.
 *
 * Chạy:  node scripts/perf/bench/run-table-bench.mjs --label before [--rows 5956]
 *
 * Đo trên bản BUILD PRODUCTION của bàn đo (không phải dev server): dev build của
 * React có thêm cảnh báo/kiểm tra nên số đo không nói được gì về sản phẩm thật.
 *
 * Số đo lấy được (ghi ra scripts/perf/bench/results/<label>.json):
 *   mountMs         thời gian từ lúc điều hướng tới lúc bảng có dòng đầu tiên
 *   domNodes        tổng số phần tử DOM của trang khi vừa vẽ xong
 *   domNodesBottom  tổng số phần tử DOM SAU KHI cuộn hết bảng
 *   keystrokeMs     thời lượng sự kiện dài nhất khi gõ MỘT ký tự vào ô lọc (INP)
 *   longTaskMs      tác vụ dài nhất trên luồng chính trong cùng cú gõ đó
 *   sortMs          thời lượng sự kiện dài nhất khi bấm sắp xếp một cột
 *   scrollMs        thời gian cuộn hết bảng + tác vụ dài nhất khi cuộn
 *   heapMB          JS heap sau khi cuộn hết bảng
 *
 * Mọi phép đo lặp `repeats` lần và lấy TRUNG VỊ để bớt nhiễu máy.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const benchDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(benchDir, "dist");
const resultsDir = path.join(benchDir, "results");

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const label = argOf("label", "run");
const rows = Number(argOf("rows", "5956"));
const REPEATS = Number(argOf("repeats", "3"));
/** Giả lập máy văn phòng chậm — cùng hệ số dùng ở docs/perf (x4). */
const CPU_THROTTLE = Number(argOf("cpu", "4"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, "http://localhost");
      const file = url.pathname === "/" ? "/index.html" : url.pathname;
      const target = path.join(distDir, file);
      try {
        const body = await readFile(target);
        res.writeHead(200, {
          "content-type":
            MIME[path.extname(target)] ?? "application/octet-stream",
          "cache-control": "no-store",
        });
        res.end(body);
      } catch {
        res.writeHead(404).end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/**
 * Cài đặt hai PerformanceObserver TRƯỚC khi trang chạy: `event` cho thời lượng
 * tương tác (chính là thứ INP lấy ra) và `longtask` cho tác vụ khoá luồng chính.
 */
const OBSERVER_INIT = `
window.__perf = { events: [], longTasks: [] };
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) window.__perf.events.push(e.duration);
}).observe({ type: "event", buffered: true, durationThreshold: 16 });
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) window.__perf.longTasks.push(e.duration);
}).observe({ type: "longtask", buffered: true });
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
const round = (value) => Math.round(value * 10) / 10;

/**
 * Cuộn tới đáy bằng `behavior: "instant"`.
 *
 * BẪY ĐÃ DÍNH: khung bảng đặt `scroll-behavior: smooth` (ResponsiveDataTable) và
 * hn-motion.css đặt thêm ở `html`. Gán thẳng `scrollTop` vì thế KHỞI ĐỘNG MỘT
 * HOẠT ẢNH chứ không nhảy tới nơi; gán lại liên tục làm hoạt ảnh khởi động lại
 * và thanh cuộn bò từng đoạn — đo ra "không tới được đáy" trong khi sản phẩm
 * hoàn toàn bình thường. `scrollTo({behavior:"instant"})` bỏ qua lớp hoạt ảnh đó.
 */
const SCROLL_TO_BOTTOM = `(async () => {
  const table = document.querySelector("tbody");
  let box = table ? table.parentElement : null;
  while (box) {
    const style = getComputedStyle(box);
    if (style.overflowY === "auto" || style.overflowY === "scroll") break;
    box = box.parentElement;
  }
  const scroller = box || document.scrollingElement;
  window.__benchScroller = scroller;
  window.__benchMaxIndex = 0;
  // Đọc số THỨ TỰ ở ô đầu dòng cuối cùng đang vẽ: cột STT có ở CẢ hai đường
  // (cửa sổ nới dần lẫn cuộn ảo) nên số này so sánh được trước/sau.
  const track = () => {
    const rows = document.querySelectorAll("tbody tr[role=row]");
    const last = rows[rows.length - 1];
    const stt = last ? Number(last.querySelector("td")?.textContent) : NaN;
    if (Number.isFinite(stt) && stt > window.__benchMaxIndex) {
      window.__benchMaxIndex = stt;
    }
  };
  for (let i = 0; i < 20; i += 1) {
    scroller.scrollTo({ top: (scroller.scrollHeight * (i + 1)) / 20, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 200));
    track();
  }
  // Đáy của danh sách đo động dịch dần khi các dòng cuối được đo thật — nhấn
  // thêm vài nhịp cho nó chốt lại.
  for (let i = 0; i < 8; i += 1) {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 200));
    track();
  }
})()`;

async function runOnce(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(OBSERVER_INIT);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });

  const startedAt = Date.now();
  await page.goto(`${baseUrl}/?rows=${rows}`, { waitUntil: "load" });
  await page.waitForSelector("tbody tr", { timeout: 180_000 });
  const mountMs = Date.now() - startedAt;

  const domNodes = await page.evaluate(
    () => document.getElementsByTagName("*").length,
  );
  const renderedRows = await page.evaluate(
    () => document.querySelectorAll("tbody tr").length,
  );

  // --- Một cú gõ vào ô lọc: đúng thao tác đã gây INP 14.696 ms ---
  await page.evaluate("window.__perfReset()");
  await page.click('[data-testid="bench-filter"]');
  await page.keyboard.press("K");
  await page.waitForTimeout(2000);
  const keystroke = await page.evaluate("window.__perfMax()");

  await page.keyboard.press("Backspace");
  await page.waitForTimeout(2000);

  // --- Bấm sắp xếp một cột ---
  await page.evaluate("window.__perfReset()");
  await page.locator("thead th", { hasText: "SKU" }).first().click();
  await page.waitForTimeout(2000);
  const sort = await page.evaluate("window.__perfMax()");

  // --- Cuộn hết bảng ---
  await page.evaluate("window.__perfReset()");
  const scrollStart = Date.now();
  await page.evaluate(SCROLL_TO_BOTTOM);
  const scrollMs = Date.now() - scrollStart;
  const scroll = await page.evaluate("window.__perfMax()");
  const rowReachedByScroll = await page.evaluate("window.__benchMaxIndex ?? 0");
  const domNodesBottom = await page.evaluate(
    () => document.getElementsByTagName("*").length,
  );
  const rowsBottom = await page.evaluate(
    () => document.querySelectorAll("tbody tr").length,
  );

  const heapMB = await cdp
    .send("Runtime.getHeapUsage")
    .then((r) => r.usedSize / 1024 / 1024)
    .catch(() => 0);

  await context.close();
  return {
    mountMs,
    domNodes,
    renderedRows,
    keystrokeMs: keystroke.event,
    keystrokeLongTaskMs: keystroke.longTask,
    sortMs: sort.event,
    sortLongTaskMs: sort.longTask,
    scrollMs,
    scrollLongTaskMs: scroll.longTask,
    domNodesBottom,
    rowsBottom,
    rowReachedByScroll,
    heapMB,
  };
}

const server = await serve();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const runs = [];
for (let i = 0; i < REPEATS; i += 1) {
  runs.push(await runOnce(browser, baseUrl));
  process.stdout.write(`  lượt ${i + 1}/${REPEATS} xong\n`);
}
await browser.close();
server.close();

const keys = Object.keys(runs[0]);
const summary = Object.fromEntries(
  keys.map((key) => [key, round(median(runs.map((run) => run[key])))]),
);
summary.label = label;
summary.rows = rows;
summary.cpuThrottle = CPU_THROTTLE;
summary.repeats = REPEATS;

if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
writeFileSync(
  path.join(resultsDir, `${label}.json`),
  `${JSON.stringify({ summary, runs }, null, 2)}\n`,
);

console.log(
  `\n=== BÀN ĐO "${label}" — ${rows} dòng, CPU x${CPU_THROTTLE}, trung vị ${REPEATS} lượt ===`,
);
for (const key of keys) console.log(`${key.padEnd(22)} ${summary[key]}`);
