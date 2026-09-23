/** Read-only integration checks against the original inbound card. No live API calls. */
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
const dir = path.resolve("report-warehouse-review-tmp");
const baseline = process.env.WAREHOUSE_BASELINE === "1";
const referenceFile = "/tmp/hn-report-warehouse-reference.json";
const routes = [
  ["/reports/inventory-flow", "InventoryFlowReportPage", "RPT-01"],
  ["/reports/outbound-flow", "OutboundFlowReportPage", "RPT-01B"],
  ["/reports/stock-reconcile", "StockReconcileReportPage", "RPT-02"],
  ["/reports/traceability", "TraceabilityReportPage", "RPT-03"],
  ["/reports/import-quality", "ImportQualityReportPage", "RPT-04"],
  ["/reports/packing-label", "PackingLabelReportPage", "RPT-05"],
  ["/reports/warranty", "WarrantyReportPage", "RPT-06"],
  ["/reports/recipient", "RecipientReportPage", "RPT-07"],
  ["/reports/pending-evidence", "PendingEvidenceReportPage", "RPT-08"],
];
let server, browser;
try {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "index.html"),
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>',
  );
  await fs.writeFile(
    path.join(dir, "entry.tsx"),
    `
import {createRoot} from 'react-dom/client';
import {useEffect} from 'react';
import {MemoryRouter,useNavigate,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AppThemeProvider} from '/src/shared/ui/theme/AppThemeProvider';
import {useAuthStore} from '/src/shared/store/auth.store';
import {useLanguageStore} from '/src/shared/i18n/language.store';
import {ensureEnglishMessages} from '/src/shared/i18n/english-messages';
import {useThemeStore} from '/src/shared/ui/theme/theme.store';
${routes.map(([, name], i) => `import Page${i} from '/src/modules/reports/pages/${name}';`).join("\n")}
import '/src/shared/ui/tokens/css-vars.css';
import '/src/shared/ui/tokens/css-vars-dark.css';
import '/src/shared/ui/tokens/operations.css';
import '/src/index.css';
import '/src/styles/hn-wms-page-normalize.css';
import '/src/styles/hn-wms-source-screen.css';
import '/src/shared/ui/operations-ui.css';
import '/src/styles/hn-responsive.css';
useAuthStore.setState({isSuperAdmin:true,isAuthenticated:true,isProfileLoaded:true,permissionCodes:[],currentContext:{warehouse_id:1,warehouse_name:'Kho Hoa Nam'}});
useThemeStore.getState().setPreference('light');
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false,staleTime:60000}}});
const pages={${routes.map(([route], i) => `${JSON.stringify(route)}:Page${i}`).join(",")}};
function Harness(){const loc=useLocation(),navigate=useNavigate(),language=useLanguageStore(s=>s.language);const Page=pages[loc.pathname]||Page0;
useEffect(()=>{window.cardReview={navigate:url=>navigate(url),idle:()=>client.isFetching()===0,language:async(l)=>{await ensureEnglishMessages();useLanguageStore.getState().setLanguage(l)},theme:t=>useThemeStore.getState().setPreference(t)}},[navigate]);
return <div id="fixture" style={{width:'calc(100% - 300px)',marginInlineStart:'auto',minWidth:0}}><section className="hn-mvp-screen"><Page key={loc.pathname+loc.search+language}/></section></div>}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><AppThemeProvider><MemoryRouter initialEntries={['/reports/inventory-flow?screen=RPT-01']}><Harness/></MemoryRouter></AppThemeProvider></QueryClientProvider>);
`,
  );
  server = await createServer({
    server: { host: "127.0.0.1", port: 5197, strictPort: true },
    logLevel: "error",
  });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  const errors = [],
    failures = [];
  let warehouseRequests = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      assert.equal(
        route.request().method(),
        "GET",
        "No report audit may write live records",
      );
      let data = url.pathname.includes("/reports/")
        ? { rows: [], summary: {}, totals: {} }
        : [];
      if (url.pathname.endsWith("/warehouses")) {
        warehouseRequests++;
        data = [
          {
            id: 1,
            warehouse_id: 1,
            code: "KHO-TONG-HN",
            name: "Kho Hoa Nam",
            status: "ACTIVE",
          },
        ];
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data,
          meta: {
            total: Array.isArray(data) ? data.length : 0,
            current_page: 1,
            last_page: 1,
            per_page: 200,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname))
      return route.abort();
    return route.continue();
  });
  await page.goto(
    "http://127.0.0.1:5197/report-warehouse-review-tmp/index.html",
  );
  await page.waitForFunction(() => Boolean(window.cardReview));
  const settle = async () => {
    await page.waitForFunction(
      () => window.cardReview.idle(),
      {},
      { timeout: 30000 },
    );
    await page.waitForTimeout(120);
  };
  await settle();
  await page.evaluate(() => document.fonts.ready);
  const measure = async (selector) =>
    page.locator(selector).evaluate((el) => {
      const common = el.hasAttribute("data-report-warehouse");
      const icon = el.querySelector(
        common ? ".hn-report-warehouse__icon" : ".inbound-warehouse-card__icon",
      );
      const name = el.querySelector("strong"),
        status = el.querySelector("small"),
        dot = status.querySelector("i");
      const props = (node, keys) => {
        const s = getComputedStyle(node);
        return Object.fromEntries(keys.map((k) => [k, s[k]]));
      };
      const r = el.getBoundingClientRect();
      return {
        width: r.width,
        height: r.height,
        card: props(el, [
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
          "borderTopWidth",
          "borderTopColor",
          "borderRadius",
          "backgroundColor",
          "boxShadow",
          "columnGap",
        ]),
        icon: props(icon, [
          "width",
          "height",
          "fontSize",
          "color",
          "backgroundColor",
          "borderRadius",
        ]),
        name: props(name, [
          "fontFamily",
          "fontSize",
          "fontWeight",
          "lineHeight",
          "color",
          "letterSpacing",
        ]),
        status: props(status, [
          "fontFamily",
          "fontSize",
          "fontWeight",
          "lineHeight",
          "color",
          "columnGap",
        ]),
        dot: props(dot, [
          "width",
          "height",
          "backgroundColor",
          "boxShadow",
          "borderRadius",
        ]),
      };
    });
  if (baseline) {
    const result = await measure(".inbound-warehouse-card");
    await fs.writeFile(referenceFile, JSON.stringify(result));
    console.log(
      JSON.stringify({
        check: "original-inbound-warehouse-reference",
        ...result,
      }),
    );
  } else {
    await page
      .locator('[data-report-warehouse][data-state="active"]')
      .waitFor();
    const before = JSON.parse(await fs.readFile(referenceFile, "utf8"));
    const after = await measure("[data-report-warehouse]");
    assert.deepEqual(
      after,
      before,
      "Shared card must retain the original inbound card geometry, typography and colors",
    );
    let cases = 0;
    for (const language of ["vi", "en"]) {
      await page.evaluate((l) => window.cardReview.language(l), language);
      await settle();
      for (const theme of ["light", "dark"]) {
        await page.evaluate((t) => window.cardReview.theme(t), theme);
        for (const width of [1920, 1366, 1024, 800, 390]) {
          await page.setViewportSize({ width, height: 1280 });
          await page.evaluate((w) => {
            document.getElementById("fixture").style.width =
              "calc(100% - " + (w >= 980 ? 300 : 0) + "px)";
          }, width);
          let reference;
          for (const [route, , screen] of [
            ...routes,
            ["/reports/pending-evidence", "PendingEvidenceReportPage", ""],
          ]) {
            await page.evaluate(
              (url) => window.cardReview.navigate(url),
              route + (screen ? "?screen=" + screen : ""),
            );
            await settle();
            const card = page.locator("[data-report-warehouse]");
            await card.waitFor();
            assert.equal(
              await card.count(),
              1,
              "One warehouse context card per report",
            );
            const actual = await measure("[data-report-warehouse]");
            reference ??= actual;
            if (JSON.stringify(actual) !== JSON.stringify(reference))
              failures.push({
                route,
                screen,
                width,
                language,
                theme,
                expected: reference,
                actual,
              });
            const geometry = await card.evaluate((card) => {
              const root = card.closest(
                  '[data-testid="wwhn-258-report-screen"]',
                ),
                r = card.getBoundingClientRect(),
                rr = root.getBoundingClientRect();
              const title = root.querySelector("h1.hn-report-page-title"),
                tr = title?.getBoundingClientRect();
              return {
                outside: r.left < rr.left - 1 || r.right > rr.right + 1,
                overlap:
                  tr &&
                  r.left < tr.right &&
                  r.right > tr.left &&
                  r.top < tr.bottom &&
                  r.bottom > tr.top,
              };
            });
            if (geometry.outside || geometry.overlap)
              failures.push({
                route,
                screen,
                width,
                language,
                theme,
                geometry,
              });
            assert.equal(await card.getAttribute("data-state"), "active");
            assert.equal(
              await card.locator('button,summary,[role="combobox"]').count(),
              0,
            );
            assert.equal(
              await card.locator("strong").innerText(),
              "Kho Hoa Nam",
            );
            cases++;
          }
        }
      }
    }
    assert(
      warehouseRequests < 12,
      "Warehouse card introduced per-navigation duplicate directory requests",
    );
    console.log(
      JSON.stringify({
        check: "report-warehouse-parity",
        cases,
        originalInboundMatched: true,
        warehouseRequests,
        failures,
        pageErrors: errors,
      }),
    );
    assert.deepEqual(failures, []);
    assert.deepEqual(errors, []);
  }
} finally {
  await browser?.close();
  await server?.close();
  await fs.rm(dir, { recursive: true, force: true });
}
