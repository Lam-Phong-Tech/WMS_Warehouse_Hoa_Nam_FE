#!/usr/bin/env node
/**
 * Bộ đo "chart/card không được tràn khi đổi cỡ cửa sổ" — chạy trên Chromium
 * THẬT qua Playwright (Browser pane của Claude không bắn ResizeObserver nên
 * không dùng được để kiểm co giãn).
 *
 * Vì sao tồn tại: UAT 09/09/2026 (RPT-04 "Diễn biến và điểm cần xử lý") —
 * ApexCharts ghi style.width=<px> lên .apexcharts-canvas; ô chứa là grid item
 * min-width:auto nên bị chính canvas cũ chống ra, ResizeObserver không bắn,
 * chart đè card đứng cạnh khi bo nhỏ. Fix nằm ở LazyApexChart + hn-responsive.css;
 * script này là bằng chứng hồi quy: mở từng màn ở bề rộng đầu, đưa mọi card
 * vào viewport (để chart lazy vẽ), rồi đổi cỡ qua từng mốc và kiểm:
 *   (a) không .apexcharts-canvas nào tràn khỏi card chứa nó,
 *   (b) không svg to nào (chart tự vẽ kiểu Vuexy) tràn khỏi card,
 *   (c) không card nào có scrollWidth > clientWidth,
 *   (d) trang không tràn ngang.
 *
 * Cách chạy (dev server đang bật, tài khoản test đọc từ env — KHÔNG hard-code):
 *   HN_USER=<email> HN_PASS=<mật khẩu> yarn ui:chart-sweep
 *   HN_BASE=http://localhost:5179 HN_WIDTHS=1500,1100,900 HN_ROUTES=/reports/import-quality yarn ui:chart-sweep
 * Ảnh full-page của mốc lỗi ghi vào test-results/chart-sweep/.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.HN_BASE ?? "http://localhost:5173";
const USER = process.env.HN_USER;
const PASS = process.env.HN_PASS;
const OUT = process.env.HN_OUT ?? "test-results/chart-sweep";
const WIDTHS = (process.env.HN_WIDTHS ?? "1500,1250,1100,900,1500")
  .split(",")
  .map(Number);
const ROUTES = (
  process.env.HN_ROUTES ??
  "/dashboard,/reports/inventory-flow,/reports/outbound-flow,/reports/stock-reconcile,/reports/traceability,/reports/import-quality,/reports/packing-label,/reports/warranty,/reports/recipient,/reports/pending-evidence,/putaway/trays"
).split(",");

if (!USER || !PASS) {
  console.error(
    "[chart-sweep] Cần HN_USER và HN_PASS (tài khoản test) trong env.",
  );
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
let ctx;
let page;

async function login() {
  if (ctx) await ctx.close().catch(() => {});
  ctx = await browser.newContext({
    viewport: { width: WIDTHS[0], height: 900 },
  });
  page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="identifier"]', USER);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 30000,
  });
}

async function bringCardsIntoView() {
  // Chỉ phần tử HIỂN THỊ: màn báo cáo keep-alive để lại article ẩn trong DOM,
  // mỗi cái ẩn tốn trọn timeout — sweep chậm dần theo số màn đã ghé.
  const targets = page.locator(
    "main article:visible, main section:visible, main .MuiPaper-root:visible",
  );
  const n = Math.min(await targets.count(), 60);
  for (let i = 0; i < n; i += 1) {
    try {
      await targets.nth(i).scrollIntoViewIfNeeded({ timeout: 700 });
    } catch {
      /* phần tử vừa ẩn đi — bỏ qua */
    }
  }
  await page.waitForTimeout(500);
}

async function audit() {
  return page.evaluate(() => {
    const cardSel = "article, .MuiPaper-root, .MuiCard-root";
    const problems = [];
    const visible = (el) => el.getBoundingClientRect().width > 0;
    const short = (el) =>
      `${el.tagName.toLowerCase()}.${String(el.className || "")
        .split(" ")
        .slice(0, 2)
        .join(".")}`;

    const canvases = [
      ...document.querySelectorAll(".apexcharts-canvas"),
    ].filter(visible);
    for (const canvas of canvases) {
      const card = canvas.closest(cardSel) ?? canvas.parentElement;
      const over = Math.round(
        canvas.getBoundingClientRect().right -
          card.getBoundingClientRect().right,
      );
      if (over > 1)
        problems.push({ kind: "apex", card: short(card), overflowPx: over });
    }

    for (const svg of document.querySelectorAll("main svg")) {
      const r = svg.getBoundingClientRect();
      if (r.width < 120 || svg.closest(".apexcharts-canvas")) continue;
      const card = svg.closest(cardSel);
      if (!card) continue;
      const over = Math.round(r.right - card.getBoundingClientRect().right);
      if (over > 1)
        problems.push({ kind: "svg", card: short(card), overflowPx: over });
    }

    const cards = [...document.querySelectorAll(`main :is(${cardSel})`)].filter(
      visible,
    );
    for (const card of cards) {
      const over = card.scrollWidth - card.clientWidth;
      if (over > 2)
        problems.push({ kind: "card", card: short(card), overflowPx: over });
    }

    return {
      apex: canvases.length,
      cards: cards.length,
      pageOverflowPx: document.documentElement.scrollWidth - window.innerWidth,
      problems,
    };
  });
}

let bad = 0;
await login();
for (const route of ROUTES) {
  try {
    await page.setViewportSize({ width: WIDTHS[0], height: 900 });
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    if (page.url().includes("/login")) {
      await login();
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    }
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await bringCardsIntoView();
      const ready = await page.evaluate(
        () =>
          document.querySelectorAll(
            "main article, main .MuiPaper-root, .apexcharts-canvas svg",
          ).length,
      );
      if (ready > 0 && attempt >= 1) break;
      await page.waitForTimeout(2000);
    }
    for (let i = 0; i < WIDTHS.length; i += 1) {
      if (i > 0) {
        await page.setViewportSize({ width: WIDTHS[i], height: 900 });
        await page.waitForTimeout(1200);
        await bringCardsIntoView();
      }
      const a = await audit();
      const tag = `${route.replace(/\//g, "_")}@${WIDTHS[i]}`;
      const ok = a.problems.length === 0 && a.pageOverflowPx <= 0;
      console.log(
        `${ok ? "OK " : "BAD"} ${tag.padEnd(36)} apex=${a.apex} cards=${a.cards} pageOverflow=${a.pageOverflowPx}px ${
          a.problems.length ? JSON.stringify(a.problems.slice(0, 4)) : ""
        }`,
      );
      if (!ok) {
        bad += 1;
        await page
          .screenshot({
            path: `${OUT}/BAD-${tag.replace(/@/g, "-")}.png`,
            fullPage: true,
          })
          .catch(() => {});
      }
    }
  } catch (error) {
    console.log(`ERR ${route}: ${String(error.message).split("\n")[0]}`);
    bad += 1;
    await login().catch((e) => console.log("relogin failed:", e.message));
  }
}
console.log(
  bad === 0
    ? "SWEEP PASS — không màn nào tràn"
    : `SWEEP FAIL — ${bad} mốc cần xem`,
);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
