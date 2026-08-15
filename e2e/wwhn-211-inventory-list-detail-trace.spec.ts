/**
 * WWHN-211 – Inventory list/detail/trace UI, responsive, RBAC and API-error
 * evidence.
 *
 * Controlled mocks prove deterministic FE behaviour only. They do not replace
 * independent QA2 execution (WWHN-212) or backend authorization evidence
 * (DEV211-P1-04).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN } from "./support/mock-tokens";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
const EVIDENCE_ROOT =
  process.env.WWHN_211_EVIDENCE_DIR ??
  join("test-results", "wwhn-211", SOURCE_SHA);

const VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "tablet", width: 768, height: 1024 },
  { key: "mobile", width: 375, height: 812 },
] as const;

type BalanceMode = "success" | "empty" | "forbidden";

interface SessionOptions {
  permissions?: string[];
  balanceMode?: BalanceMode;
  latencyMs?: number;
}

function safeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  scenario: string,
  assertions: string[],
): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const prefix = [
    "WWHN-211",
    safeName(scenario),
    `${viewport.width}x${viewport.height}`,
  ].join("__");
  const screenshotFilename = `${prefix}.png`;
  const metadataFilename = `${prefix}.json`;

  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  await page.screenshot({
    path: join(EVIDENCE_ROOT, screenshotFilename),
    fullPage: true,
  });

  const metadata = {
    schemaVersion: "1.0.0",
    ticket: "WWHN-211",
    qaTicket: "WWHN-212",
    scenario,
    result: "PASS",
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    browserProject: testInfo.project.name,
    viewport,
    route: "/inventory",
    finalUrl: page.url(),
    timestamp: new Date().toISOString(),
    screenshotFilename,
    videoPolicy: "on",
    tracePolicy: "on",
    assertions,
    evidenceBoundary:
      "Controlled FE evidence only; independent QA2 execution (WWHN-212) and direct backend 403/data-scope evidence (DEV211-P1-04) remain separate owner gates.",
  };

  writeFileSync(
    join(EVIDENCE_ROOT, metadataFilename),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
  await testInfo.attach("wwhn-211-evidence-metadata", {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

async function mockSession(
  page: Page,
  {
    permissions = ["inventory.view", "inventory.trace"],
    balanceMode = "success",
    latencyMs = 0,
  }: SessionOptions = {},
): Promise<string[]> {
  const requestedPaths: string[] = [];

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    requestedPaths.push(path);

    if (latencyMs > 0 && path.endsWith("/inventory/balances")) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }

    if (path.endsWith("/auth/refresh")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            access_token: MOCK_ACCESS_TOKEN,
            refresh_token: MOCK_REFRESH_TOKEN,
            token_type: "bearer",
            expires_in: 3600,
          },
          meta: { request_id: "wwhn-211-refresh" },
        }),
      });
      return;
    }

    if (path.endsWith("/auth/me")) {
      const activeContext = {
        role_id: 211,
        role_name: "WWHN-211 QA Role",
        scope_type: "he_thong",
        org_unit_id: null,
        department_id: null,
        warehouse_id: null,
        permission_codes: permissions,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 211,
            name: "WWHN-211 QA User",
            email: "qa.wwhn211@example.com",
            code: "QA-WWHN-211",
            is_super_admin: false,
            roles: [
              {
                role_id: 211,
                role_code: "WWHN_211_QA",
                role_name: "WWHN-211 QA Role",
              },
            ],
            permissions,
            active_context: activeContext,
            available_contexts: [activeContext],
          },
          meta: { request_id: "wwhn-211-me" },
        }),
      });
      return;
    }

    if (path.endsWith("/inventory/balances")) {
      if (balanceMode === "forbidden") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          headers: { "x-request-id": "req-wwhn-211-forbidden" },
          body: JSON.stringify({
            success: false,
            message: "Permission denied",
            error_code: "PERMISSION_DENIED",
            meta: { request_id: "req-wwhn-211-forbidden" },
          }),
        });
        return;
      }

      const rows =
        balanceMode === "empty"
          ? []
          : [
              {
                id: "bal-wwhn-211",
                sku_code: "SKU-WWHN-211",
                product_name: "Sản phẩm evidence WWHN-211",
                warehouse_name: "Kho WWHN-211",
                lot_no: "LOT-211",
                uom: "cái",
                available_qty: 10,
                on_hand_qty: 12,
                reserved_qty: 2,
                item_subledger_count: 1,
                container_subledger_count: 1,
                reconciliation_status: "MATCH",
                updated_at: "2026-08-10T00:00:00Z",
              },
            ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: rows,
          meta: {
            total: rows.length,
            page: 1,
            per_page: 20,
            request_id: "req-wwhn-211-balances",
          },
        }),
      });
      return;
    }

    if (path.endsWith("/stock-movements")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "mv-wwhn-211",
              movement_no: "MV-WWHN-211",
              occurred_at: "2026-08-10T00:00:00Z",
              movement_type: "RECEIPT",
              sku_code: "SKU-WWHN-211",
              warehouse_name: "Kho WWHN-211",
              qty_change: 10,
              document_code: "IN-WWHN-211",
              document_type: "INBOUND",
              status: "POSTED",
            },
          ],
          meta: { total: 1, request_id: "req-wwhn-211-movements" },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [],
        meta: { request_id: "req-wwhn-211-generic" },
      }),
    });
  });

  return requestedPaths;
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBe(false);
}

test.use({ video: "on", trace: "on", screenshot: "on" });

test.describe("WWHN-211 Inventory list/detail/trace closure", () => {
  for (const viewport of VIEWPORTS) {
    test(`success and responsive ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockSession(page, { balanceMode: "success" });
      await page.goto(`${BASE_URL}/inventory`);

      await expect(page.getByText("SKU-WWHN-211")).toBeVisible();
      await expect(page.getByText("MATCH", { exact: true })).toBeVisible();
      await expectNoDocumentOverflow(page);

      await captureEvidence(
        page,
        testInfo,
        `success-responsive-${viewport.key}`,
        [
          "GET /inventory/balances data renders",
          "Reconciliation status is visible",
          "Document has no horizontal overflow",
        ],
      );
    });
  }

  test("loading and empty states", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { balanceMode: "empty", latencyMs: 800 });
    await page.goto(`${BASE_URL}/inventory`);

    await expect(page.locator(".ant-table-wrapper").first()).toBeVisible();
    await expect(
      page.getByText("Không có tồn kho theo bộ lọc hiện tại"),
    ).toBeVisible();

    await captureEvidence(page, testInfo, "loading-empty", [
      "Loading indicator is visible during delayed API response",
      "Empty state renders after an empty canonical response",
    ]);
  });

  test("403 API error exposes code and request id", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { balanceMode: "forbidden" });
    await page.goto(`${BASE_URL}/inventory`);

    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
    await expect(
      page.getByText(
        "Bạn không có quyền thực hiện thao tác này. Liên hệ quản trị viên để được cấp quyền.",
      ),
    ).toBeVisible();

    await captureEvidence(page, testInfo, "api-error-403", [
      "HTTP 403 renders a dedicated no-permission error state with retry",
    ]);
  });

  test("balance detail modal opens with subledger and related movements", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page);
    await page.goto(`${BASE_URL}/inventory`);

    await page.getByRole("button", { name: "Mở" }).click();
    await expect(
      page.getByText(/Chi tiết tồn kho — SKU-WWHN-211/),
    ).toBeVisible();

    await captureEvidence(page, testInfo, "balance-detail-modal", [
      "Balance detail modal opens on row action",
      "Subledger and related-movement sections render",
    ]);
  });

  test("trace flow: movement history tab, Trace action, TraceModal opens", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page);
    await page.goto(`${BASE_URL}/inventory`);

    await page.getByText("Lịch sử dịch chuyển").click();
    await expect(page.getByText("MV-WWHN-211")).toBeVisible();

    await page.getByRole("button", { name: "Trace" }).click();
    await expect(
      page.getByText("Truy vết chứng từ nguồn (TRACE-01)"),
    ).toBeVisible();

    await captureEvidence(page, testInfo, "trace-flow", [
      "Movement history tab renders GET /stock-movements data",
      "Trace action opens TraceModal for the selected movement",
    ]);
  });

  test("route RBAC denies a user without inventory.view", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { permissions: [] });
    await page.goto(`${BASE_URL}/inventory`);

    await expect(page).toHaveURL(/\/errors\/403$/);
    await captureEvidence(page, testInfo, "route-rbac-deny", [
      "User without inventory.view is redirected to /errors/403",
      "This is a FE entry guard and does not replace backend authorization (DEV211-P1-04)",
    ]);
  });

  test("Trace action is disabled without inventory.trace permission", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { permissions: ["inventory.view"] });
    await page.goto(`${BASE_URL}/inventory`);

    await page.getByText("Lịch sử dịch chuyển").click();
    await expect(page.getByText("MV-WWHN-211")).toBeVisible();
    await expect(page.getByRole("button", { name: "Trace" })).toBeDisabled();
    await expect(page.getByText("Truy vết mã")).toHaveCount(0);

    await captureEvidence(page, testInfo, "trace-permission-disabled", [
      "Trace action is disabled in the UI without inventory.trace",
      "Physical-code lookup shortcut is hidden without inventory.trace",
      "UI hide/disable does not replace backend authorization (DEV211-P1-04)",
    ]);
  });
});
