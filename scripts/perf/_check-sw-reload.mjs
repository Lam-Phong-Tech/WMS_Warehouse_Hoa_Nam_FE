/**
 * Kiểm: lần cài service worker ĐẦU TIÊN (máy sạch) có làm trang tự tải lại không.
 * Mở context mới (không có SW), vào /login, đếm số lần điều hướng của frame chính
 * trong 4 giây.
 *
 *   node scripts/perf/_check-sw-reload.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:5199";
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const navs = [];
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) navs.push({ t: Date.now(), url: frame.url() });
});
const t0 = Date.now();
await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.waitForTimeout(4000);
const info = await page.evaluate(async () => ({
  navType: performance.getEntriesByType("navigation")[0]?.type,
  hasController: Boolean(navigator.serviceWorker?.controller),
  regs: (await navigator.serviceWorker?.getRegistrations())?.length ?? 0,
}));
console.log("số lần điều hướng frame chính:", navs.length, navs.map((n) => `${n.t - t0}ms ${n.url}`));
console.log("navigation.type của tài liệu hiện tại:", info.navType, "| SW controller:", info.hasController, "| registrations:", info.regs);
console.log(navs.length > 1 || info.navType === "reload" ? "KẾT LUẬN: lần cài SW đầu tiên LÀM TRANG TẢI LẠI (tải 2 lần)." : "KẾT LUẬN: không tải lại.");
await browser.close();
