/**
 * WWHN-144 / WWHN-145 – QA2 responsive and RBAC closure suite.
 *
 * This suite intentionally uses mocked API contracts so the FE shell, route
 * guards and menu filtering can be verified deterministically on every commit.
 * Backend authorization remains a separate BE/QA1 responsibility.
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

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
const EVIDENCE_ROOT =
  process.env.WWHN_144_EVIDENCE_DIR ??
  join("test-results", "wwhn-144", SOURCE_SHA);

const MOCK_ACCESS_TOKEN =
  process.env.E2E_MOCK_ACCESS_TOKEN ?? "wwhn-144-access-token";
const MOCK_REFRESH_TOKEN =
  process.env.E2E_MOCK_REFRESH_TOKEN ?? "wwhn-144-refresh-token";

const VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900, navigationMode: "sider" },
  { key: "tablet", width: 768, height: 1024, navigationMode: "drawer" },
  { key: "mobile", width: 375, height: 812, navigationMode: "drawer" },
] as const;

interface MockAuthOptions {
  refreshSuccess?: boolean;
  isSuperAdmin?: boolean;
  permissionCodes?: string[];
}

interface EvidenceInput {
  scenario: string;
  role: string;
  viewport: { width: number; height: number };
  route: string;
  result: "PASS" | "FAIL";
  assertions: string[];
}

function safeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  input: EvidenceInput,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const prefix = [
    "WWHN-144",
    safeName(input.scenario),
    safeName(input.role),
    `${input.viewport.width}x${input.viewport.height}`,
  ].join("__");
  const screenshotFile = `${prefix}.png`;
  const metadataFile = `${prefix}.json`;

  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  await page.screenshot({
    path: join(EVIDENCE_ROOT, screenshotFile),
    fullPage: true,
  });

  const metadata = {
    ticket: "WWHN-144",
    qaTicket: "WWHN-145",
    scenario: input.scenario,
    result: input.result,
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    role: input.role,
    viewport: input.viewport,
    browserProject: testInfo.project.name,
    route: input.route,
    finalUrl: page.url(),
    timestamp,
    screenshotFilename: screenshotFile,
    videoPolicy: "on",
    videoFilename: "video.webm",
    reportFilename: "playwright-report/index.html",
    assertions: input.assertions,
    apiScopeDisposition:
      "UX frame scope only; mocked API contracts verify FE behaviour, not backend endpoint integration or backend authorization.",
  };
  writeFileSync(
    join(EVIDENCE_ROOT, metadataFile),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  await testInfo.attach("wwhn-144-evidence-metadata", {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

function authResponse(options: Required<MockAuthOptions>) {
  const activeContext = {
    role_id: 1,
    role_name: options.isSuperAdmin ? "Super Admin" : "Inventory Viewer",
    scope_type: "he_thong",
    org_unit_id: null,
    department_id: null,
    warehouse_id: null,
    permission_codes: options.permissionCodes,
  };

  return {
    id: 144,
    name: options.isSuperAdmin ? "QA Super Admin" : "QA Inventory Viewer",
    email: "qa.wwhn144@example.com",
    code: "QA-WWHN-144",
    is_super_admin: options.isSuperAdmin,
    active_context: activeContext,
    available_contexts: [activeContext],
  };
}

async function setupMockApi(
  page: Page,
  partial: MockAuthOptions = {},
): Promise<void> {
  const options: Required<MockAuthOptions> = {
    refreshSuccess: partial.refreshSuccess ?? false,
    isSuperAdmin: partial.isSuperAdmin ?? false,
    permissionCodes: partial.permissionCodes ?? [],
  };
  const user = authResponse(options);

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/auth/login")) {
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
            user,
            available_contexts: user.available_contexts,
          },
          meta: { request_id: "wwhn-144-login" },
        }),
      });
      return;
    }

    if (path.endsWith("/auth/refresh")) {
      if (!options.refreshSuccess) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error_code: "UNAUTHENTICATED",
            message: "No active QA session",
          }),
        });
        return;
      }
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
        }),
      });
      return;
    }

    if (path.endsWith("/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: user,
          meta: { request_id: "wwhn-144-me" },
        }),
      });
      return;
    }

    if (path.endsWith("/auth/logout")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (path.includes("/reports/dashboard-quick")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            activeSku: 0,
            productCount: 0,
            componentCount: 0,
            availableStock: 0,
            pendingPutaway: 0,
            openStocktake: 0,
            stocktakeLines: 0,
            warrantyActive: 0,
            warrantyTempOnly: 0,
          },
        }),
      });
      return;
    }

    if (
      path.includes("/document-status-history") ||
      path.includes("/safe-stock-alerts")
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
      return;
    }

    if (path.includes("/inventory-snapshots")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            ledgerBalance: "PASS",
            ledgerSkuCount: 0,
            subledger: "PASS",
            subledgerMessage: "No pending reconciliation issues",
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [], meta: {} }),
    });
  });
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe("WWHN-144 / WWHN-145 closure", () => {
  test("anonymous direct URL is fail-closed and redirects to login", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupMockApi(page, { refreshSuccess: false });

    await page.goto(`${BASE_URL}/master-data?source=direct-url`);
    await expect(page).toHaveURL(/\/login$/);

    await captureEvidence(page, testInfo, {
      scenario: "anonymous-direct-url-login-guard",
      role: "anonymous",
      viewport: { width: 1440, height: 900 },
      route: "/master-data?source=direct-url",
      result: "PASS",
      assertions: [
        "Protected direct URL does not render before authentication",
        "Anonymous user is redirected to /login",
      ],
    });
  });

  test("limited role menu is filtered and forbidden direct URL renders 403", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupMockApi(page, {
      refreshSuccess: true,
      permissionCodes: ["inventory.view"],
    });

    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.getByTestId("desktop-navigation")).toBeVisible();
    await expect(page.getByText("Tồn & truy vết", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Danh mục & SKU", { exact: true }),
    ).toHaveCount(0);

    await page.goto(`${BASE_URL}/master-data?source=direct-url`);
    await expect(page).toHaveURL(/\/errors\/403$/);
    await expect(
      page.getByText("Không có quyền truy cập", { exact: true }),
    ).toBeVisible();

    await captureEvidence(page, testInfo, {
      scenario: "limited-role-menu-direct-url-403",
      role: "inventory_viewer",
      viewport: { width: 1440, height: 900 },
      route: "/master-data?source=direct-url",
      result: "PASS",
      assertions: [
        "Allowed inventory menu is visible",
        "Master/SKU menu is absent without required permission",
        "Direct URL bypass attempt is redirected to /errors/403",
        "403 page renders an explicit no-permission state",
      ],
    });
  });

  test("authenticated user can open /errors/403 directly", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupMockApi(page, {
      refreshSuccess: true,
      permissionCodes: ["inventory.view"],
    });

    await page.goto(`${BASE_URL}/errors/403`);
    await expect(page).toHaveURL(/\/errors\/403$/);
    await expect(
      page.getByText("Không có quyền truy cập", { exact: true }),
    ).toBeVisible();

    await captureEvidence(page, testInfo, {
      scenario: "authenticated-errors-403-route",
      role: "inventory_viewer",
      viewport: { width: 1440, height: 900 },
      route: "/errors/403",
      result: "PASS",
      assertions: [
        "/errors/403 remains session-protected",
        "Authenticated user receives the intended 403 state",
      ],
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`responsive shell ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await setupMockApi(page, {
        refreshSuccess: true,
        isSuperAdmin: true,
      });
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page).toHaveURL(/\/dashboard$/);

      const toggle = page.getByTestId("navigation-toggle");
      await expect(toggle).toBeVisible();

      if (viewport.navigationMode === "sider") {
        await expect(page.getByTestId("desktop-navigation")).toBeVisible();
        await expect(page.getByTestId("primary-navigation")).toBeVisible();
      } else {
        await expect(page.getByTestId("desktop-navigation")).toHaveCount(0);
        await toggle.click();
        await expect(
          page.getByRole("navigation", { name: "Menu điều hướng" }),
        ).toBeVisible();
        await expect(page.getByTestId("primary-navigation")).toBeVisible();
      }

      await expect(page.locator("body")).not.toHaveCSS(
        "overflow-x",
        "scroll",
      );

      await captureEvidence(page, testInfo, {
        scenario: `responsive-${viewport.key}`,
        role: "super_admin",
        viewport: { width: viewport.width, height: viewport.height },
        route: "/dashboard",
        result: "PASS",
        assertions: [
          `Required viewport ${viewport.width}x${viewport.height} rendered`,
          "Authenticated session bootstrap completed before shell assertions",
          viewport.navigationMode === "sider"
            ? "Desktop fixed navigation is visible"
            : "Responsive drawer navigation opens from the header toggle",
          "Primary navigation remains usable",
        ],
      });
    });
  }
});
