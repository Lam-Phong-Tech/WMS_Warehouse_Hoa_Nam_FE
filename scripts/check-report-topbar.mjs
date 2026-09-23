/**
 * Browser-level CSS regression check for shared header action visibility.
 * Run: node scripts/check-report-topbar.mjs
 * Requires the repository's Playwright Chromium installation.
 * Uses real shell/report CSS with a minimal header DOM fixture; actual menu
 * behavior is covered separately by AppTopbar.test.tsx. This is not a live-site
 * or full report data/API test.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

function styleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? styleFiles(path)
      : entry.name.endsWith(".css") ? [path] : [];
  }).sort();
}

const shellCss = [
  "src/app/layouts/topbar/app-topbar.css",
  "src/modules/dashboard/dashboard-overview.css",
  "src/app/layouts/system-shell.css",
].map((path) => readFileSync(path, "utf8")).join("\n");
const reportCss = styleFiles("src/modules/reports")
  .map((path) => readFileSync(path, "utf8")).join("\n");
const reportMarkers = [
  "hn-inbound-report",
  "hn-outbound-report",
  "hn-rpt02",
  "hn-trace-report",
];
const controls = ["language", "theme", "shortcut"];
const expectHidden = process.argv.includes("--expect-hidden");
const widths = expectHidden ? [1920] : [1920, 1366, 1280, 1024, 800];
const cases = [...reportMarkers, "other-report", "dashboard"];
let verifiedCases = 0;

function headerMarkup() {
  return `<header class="hn-topbar">
    <div class="topbar-search-wrap"><label class="topbar-search">
      <input id="global-search" type="search" placeholder="Search functions" />
    </label></div>
    <div class="topbar-actions">
      ${controls.map((name) => `<div class="header-control">
        <button type="button" class="icon-button header-menu-toggle ${name === "language" ? "language-toggle" : ""}"
          aria-label="${name}" aria-controls="${name}-menu" aria-expanded="false">
          <span class="toggle-glyph">${name.slice(0, 1).toUpperCase()}</span>
          ${name === "language" ? '<span class="control-code">EN</span>' : ""}
        </button></div>`).join("")}
      <div class="header-control"><button class="icon-button" aria-label="Notifications">N</button></div>
      <div class="header-control"><button class="avatar-button" aria-label="Account"><span class="avatar">SA</span></button></div>
    </div></header>`;
}

const browser = await chromium.launch({ headless: true });
try {
  for (const width of widths) {
    for (const order of ["shell-first", "reports-first"]) {
      const page = await browser.newPage({ viewport: { width, height: 1280 } });
      try {
        await page.setContent(`<!doctype html><html lang="en"><body style="margin:0">
          <div class="hn-system-shell">${headerMarkup()}<main id="report-pages"></main></div>
          </body></html>`);
        // Report chunks may load after the shell, or already be cached on return.
        const styles = order === "shell-first" ? [shellCss, reportCss] : [reportCss, shellCss];
        for (const content of styles) await page.addStyleTag({ content });
        for (const active of cases) {
          // A dashboard has a stronger old shell selector, so baseline proof
          // covers report-to-report navigation; the fixed run covers both.
          if (expectHidden && active === "dashboard") continue;
          await page.evaluate(({ active, markers }) => {
            document.querySelector(".hn-system-shell").classList.toggle("hn-map-shell", active === "dashboard");
            document.getElementById("report-pages").innerHTML = markers.map((name) =>
              `<section style="display:${active === name ? "block" : "none"}"><div class="${name}"></div></section>`
            ).join("") + `<section data-active-page="${active}"></section>`;
          }, { active, markers: reportMarkers });
          for (const name of controls) {
            const button = page.locator(`.hn-topbar button[aria-controls="${name}-menu"]`);
            assert.equal(await button.count(), 1, `${name}: exactly one shared control`);
            const visible = await button.isVisible();
            assert.equal(visible, !expectHidden, `${width}px / ${order} / ${active}: ${name}`);
            if (!expectHidden) {
              const box = await button.boundingBox();
              assert.ok(box && box.width > 0 && box.height > 0, `${name}: non-empty bounds`);
              assert.ok(box.x >= 0 && box.x + box.width <= width, `${name}: stays inside viewport`);
              await button.click({ trial: true, timeout: 3000 });
            }
          }
          verifiedCases += 1;
        }
      } finally {
        await page.close();
      }
    }
  }
  console.log(JSON.stringify({
    check: "report-topbar-css",
    mode: expectHidden ? "original-bug-reproduced" : "fixed-visible-and-clickable",
    verifiedCases,
    widths,
    hiddenCachedReportsIncluded: true,
    reportStylesheets: styleFiles("src/modules/reports").length,
  }));
} finally {
  await browser.close();
}
