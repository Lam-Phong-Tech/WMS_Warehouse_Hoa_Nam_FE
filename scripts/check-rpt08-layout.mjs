/** Real report components with local test fixtures. Never sends traffic to a live API. */
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
const dir = path.resolve("rpt08-layout-harness-tmp");
let server, browser;
try {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "index.html"),
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>',
  );
  await fs.writeFile(
    path.join(dir, "entry.tsx"),
    `
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppThemeProvider } from '/src/shared/ui/theme/AppThemeProvider';
import { useAuthStore } from '/src/shared/store/auth.store';
import { useLanguageStore } from '/src/shared/i18n/language.store';
import { ensureEnglishMessages } from '/src/shared/i18n/english-messages';
import { useThemeStore } from '/src/shared/ui/theme/theme.store';
import PendingEvidenceReportPage from '/src/modules/reports/pages/PendingEvidenceReportPage';
import '/src/shared/ui/tokens/css-vars.css';
import '/src/shared/ui/tokens/css-vars-dark.css';
import '/src/shared/ui/tokens/operations.css';
import '/src/index.css';
import '/src/styles/hn-wms-page-normalize.css';
import '/src/styles/hn-wms-source-screen.css';
import '/src/shared/ui/operations-ui.css';
import '/src/styles/hn-responsive.css';
useAuthStore.setState({isSuperAdmin:true, isAuthenticated:true, isProfileLoaded:true, permissionCodes:[], currentContext:{warehouse_id:1,warehouse_name:'Kho Hoa Nam'}});
useThemeStore.getState().setPreference('light');
const client = new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
function Fixture() {
  const navigate = useNavigate();
  const language = useLanguageStore(s=>s.language);
  useEffect(()=>{window.rpt08Test = {
    navigate: (query)=>navigate('/reports/pending-evidence'+query),
    language: async(value)=>{await ensureEnglishMessages();useLanguageStore.getState().setLanguage(value)},
    theme: (value)=>useThemeStore.getState().setPreference(value)
  }},[navigate]);
  return <div id="fixture" style={{width:'100%',marginInlineStart:'auto',minWidth:0}}>
    <section className="hn-mvp-screen">
      <div aria-hidden="true" style={{position:'fixed',left:-9999,top:0}}>
        <h1 id="reference-title" className="hn-report-page-title">Report reference</h1>
        <nav id="reference-pager" className="hn-report-pagination"><button>2</button><button aria-current="page">1</button></nav>
      </div>
      <PendingEvidenceReportPage key={language}/>
    </section>
  </div>
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><AppThemeProvider><MemoryRouter initialEntries={['/reports/pending-evidence?screen=RPT-08']}><Fixture/></MemoryRouter></AppThemeProvider></QueryClientProvider>);
`,
  );
  server = await createServer({
    server: { host: "127.0.0.1", port: 5198, strictPort: true },
    logLevel: "error",
  });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  const failures = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: { total: 0, current_page: 1, last_page: 1, per_page: 50 },
        }),
      });
    if (!["127.0.0.1", "localhost"].includes(url.hostname))
      return route.abort();
    return route.continue();
  });
  await page.goto("http://127.0.0.1:5198/rpt08-layout-harness-tmp/index.html");
  await page.locator("#rpt08-history-report h1").waitFor({ timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  let cases = 0;
  for (const language of ["vi", "en"]) {
    await page.evaluate((value) => window.rpt08Test.language(value), language);
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => window.rpt08Test.theme(value), theme);
      for (const width of [1920, 1440, 1366, 1280, 1024, 800, 390]) {
        for (const sidebar of width >= 980 ? [300, 80] : [0]) {
          await page.setViewportSize({
            width,
            height: width === 800 ? 1280 : 1080,
          });
          await page.evaluate((sidebar) => {
            document.getElementById("fixture").style.width =
              "calc(100% - " + sidebar + "px)";
          }, sidebar);
          await page.waitForTimeout(80);
          const result = await page.evaluate(() => {
            const root = document.querySelector("#rpt08-history-report");
            const title = root.querySelector("h1");
            const ref = document.querySelector("#reference-title");
            const titleStyle = getComputedStyle(title),
              refStyle = getComputedStyle(ref);
            const footer = root.querySelector(".rpt08-table-footer");
            const pager = root.querySelector(".rpt08-pagination");
            const active = pager.querySelector('[aria-current="page"]');
            const baseline = document.querySelector(
              '#reference-pager [aria-current="page"]',
            );
            const style = getComputedStyle(active),
              baselineStyle = getComputedStyle(baseline);
            const a = title.getBoundingClientRect(),
              b = root
                .querySelector(".rpt08-header-actions")
                .getBoundingClientRect();
            const fr = footer.getBoundingClientRect(),
              pr = pager.getBoundingClientRect();
            const filter = root.querySelector(".rpt08-filter-grid");
            const issues = [];
            const donut = root.querySelector(".rpt08-donut");
            const card = root.querySelector(".rpt08-activity-card");
            if (
              getComputedStyle(donut, "::before").backgroundColor !==
              getComputedStyle(card).backgroundColor
            )
              issues.push("donut inset theme mismatch");
            for (const prop of [
              "fontSize",
              "fontFamily",
              "fontWeight",
              "lineHeight",
              "letterSpacing",
              "color",
            ])
              if (titleStyle[prop] !== refStyle[prop])
                issues.push(
                  "title " +
                    prop +
                    ": " +
                    titleStyle[prop] +
                    " != " +
                    refStyle[prop],
                );
            for (const prop of [
              "width",
              "height",
              "borderRadius",
              "backgroundColor",
              "color",
            ])
              if (style[prop] !== baselineStyle[prop])
                issues.push(
                  "pager " +
                    prop +
                    ": " +
                    style[prop] +
                    " != " +
                    baselineStyle[prop],
                );
            if (root.scrollWidth > root.clientWidth + 2)
              issues.push(
                "report overflow " + root.scrollWidth + "/" + root.clientWidth,
              );
            if (filter.scrollWidth > filter.clientWidth + 2)
              issues.push(
                "filter overflow " +
                  filter.scrollWidth +
                  "/" +
                  filter.clientWidth,
              );
            if (
              a.right > b.left + 1 &&
              a.left < b.right - 1 &&
              a.bottom > b.top + 1 &&
              a.top < b.bottom - 1
            )
              issues.push("header overlap");
            if (Math.abs(fr.right - pr.right) > 3)
              issues.push("pager not right aligned " + (fr.right - pr.right));
            if (pager.scrollWidth > pager.clientWidth + 2)
              issues.push("pager overflow");
            return {
              issues,
              titleSize: titleStyle.fontSize,
              pagerSize: style.width,
              reportWidth: root.clientWidth,
            };
          });
          if (result.issues.length)
            failures.push({ width, sidebar, theme, language, ...result });
          if (
            (width === 1920 && sidebar === 300) ||
            (width === 800 && theme === "light")
          ) {
            await fs.mkdir("test-results/rpt08-layout", { recursive: true });
            await page
              .locator("#rpt08-history-report")
              .screenshot({
                path:
                  "test-results/rpt08-layout/" +
                  language +
                  "-" +
                  theme +
                  "-" +
                  width +
                  ".png",
                animations: "disabled",
              });
          }
          cases++;
        }
      }
    }
  }
  console.log(
    JSON.stringify({
      check: "rpt08-layout-geometry",
      cases,
      failures,
      pageErrors: [...new Set(errors)],
    }),
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(async () => {
    document.getElementById("fixture").style.width = "calc(100% - 300px)";
    await window.rpt08Test.language("vi");
    window.rpt08Test.theme("light");
  });
  const firstCode = await page.locator(".rpt08-code-cell").first().innerText();
  await page.locator('.rpt08-pagination [data-page-direction="next"]').click();
  assert.equal(
    await page.locator('.rpt08-pagination [aria-current="page"]').innerText(),
    "2",
  );
  assert.notEqual(
    await page.locator(".rpt08-code-cell").first().innerText(),
    firstCode,
  );
  await page
    .locator('.rpt08-pagination [data-page-direction="previous"]')
    .click();
  assert.equal(
    await page.locator(".rpt08-code-cell").first().innerText(),
    firstCode,
  );
  await page.locator(".rpt08-view-button").first().click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".rpt08-search-box input").fill("SN-KHONG-TON-TAI");
  await page.locator(".rpt08-table-empty.is-search").waitFor();
  await page.locator(".rpt08-search-box button").click();
  await page.locator(".rpt08-pagination").waitFor();
  for (const state of [
    "loading",
    "empty",
    "no-result",
    "error",
    "readonly",
    "invalid",
  ]) {
    await page.evaluate(
      (state) => window.rpt08Test.navigate("?screen=RPT-08&state=" + state),
      state,
    );
    await page.waitForTimeout(120);
    const overflow = await page.evaluate(() => {
      const el = document.querySelector("#rpt08-history-report");
      return el.scrollWidth > el.clientWidth + 2;
    });
    if (overflow) failures.push({ state, issue: "state overflow" });
  }
  await page.evaluate(() => window.rpt08Test.navigate(""));
  await page.locator(".hn-rpt-io h1.hn-report-page-title").waitFor();
  assert.equal(
    await page
      .locator(".hn-rpt-io h1")
      .evaluate((el) => getComputedStyle(el).fontSize),
    "24px",
  );
  console.log(
    JSON.stringify({
      check: "rpt08-layout",
      cases,
      languages: ["vi", "en"],
      themes: ["light", "dark"],
      widths: [1920, 1440, 1366, 1280, 1024, 800, 390],
      paginationAndRowActions: "tested",
      failures,
      pageErrors: [...new Set(errors)],
    }),
  );
  assert.deepEqual(failures, []);
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server?.close();
  await fs.rm(dir, { recursive: true, force: true });
}
