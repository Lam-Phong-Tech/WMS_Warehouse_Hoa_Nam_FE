/**
 * WWHN-144 / WWHN-145 – QA2 responsive and RBAC closure suite.
 *
 * UI baseline: HN_WMS_Wireframe_MVP.html supplied by BA on 2026-08-10.
 * Desktop = 300px dark aside + main. <=980px = stacked aside + main.
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
  { key: "desktop", width: 1440, height: 900 },
  { key: "tablet", width: 768, height: 1024 },
  { key: "mobile", width: 375, height: 812 },
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
  const screenshotFilename = `${prefix}.png`;
  const metadataFilename = `${prefix}.json`;

  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  await page.screenshot({
    path: join(EVIDENCE_ROOT, screenshotFilename),
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
    screenshotFilename,
    videoPolicy: "on",
    videoFilename: "video.webm",
    reportFilename: "playwright-report/index.html",
    assertions: input.assertions,
    apiScopeDisposition:
      "UX frame scope only; mocked API contracts verify FE behaviour, not backend endpoint integration or backend authorization.",
  };

  writeFileSync(
    join(EVIDENCE_ROOT, metadataFilename),
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
    const path = new URL(route.request().url()).pathname;

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
        body: JSON.stringify({ success: true, data: user }),
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
    await expect(page.getByTestId("primary-navigation")).toBeVisible();
    await expect(
      page.getByText("Tra cứu tồn & đối soát", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Danh sách SKU / Product Master", { exact: true }),
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

  test("BA source-port navigation renders exact screen inventory", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupMockApi(page, { refreshSuccess: true, isSuperAdmin: true });

    await page.goto(`${BASE_URL}/dashboard?screen=MAP-01`);
    await expect(page.locator('[data-mvp-screen="MAP-01"]')).toBeVisible();
    await expect(
      page.getByText("Wireframe mức low-fi · Nguồn BA: BRD / SRS-FRD / BPD hiện tại."),
    ).toBeVisible();

    await page.getByText("Danh sách SKU / Product Master", { exact: true }).click();
    await expect(page).toHaveURL(/\/master-data\?screen=MST-01$/);
    await expect(page.locator('[data-mvp-screen="MST-01"]')).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Theo dõi serial" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Tạo SKU" })).toBeVisible();

    await captureEvidence(page, testInfo, {
      scenario: "verbatim-ba-source-screen-navigation",
      role: "super_admin",
      viewport: { width: 1440, height: 900 },
      route: "/master-data?screen=MST-01",
      result: "PASS",
      assertions: [
        "MAP-01 is rendered by the verbatim BA source-port",
        "Sidebar navigates to the exact MST-01 screen id",
        "MST-01 preserves BA table column wording",
        "MST-01 preserves the BA create-SKU action wording",
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
      await setupMockApi(page, { refreshSuccess: true, isSuperAdmin: true });
      await page.goto(`${BASE_URL}/dashboard?screen=MAP-01`);
      await expect(page).toHaveURL(/\/dashboard\?screen=MAP-01$/);

      const app = page.locator(".hn-mvp-app");
      const aside = page.locator(".hn-mvp-aside");
      const main = page.locator(".hn-mvp-main");
      await expect(app).toBeVisible();
      await expect(aside).toBeVisible();
      await expect(main).toBeVisible();
      await expect(page.getByTestId("primary-navigation")).toBeVisible();
      await expect(page.locator('[data-mvp-screen="MAP-01"]')).toBeVisible();
      await expect(page.getByText("Hoa Nam WMS", { exact: true })).toBeVisible();
      await expect(
        page.getByText("Bản đồ màn hình & phạm vi", { exact: true }).first(),
      ).toBeVisible();

      const asideBox = await aside.boundingBox();
      const mainBox = await main.boundingBox();
      expect(asideBox).not.toBeNull();
      expect(mainBox).not.toBeNull();

      if (viewport.width > 980) {
        expect(Math.round(asideBox?.width ?? 0)).toBe(300);
        expect(Math.round(mainBox?.x ?? 0)).toBe(300);
      } else {
        expect(Math.round(asideBox?.width ?? 0)).toBe(viewport.width);
        expect(
          (mainBox?.y ?? 0) >= (asideBox?.height ?? 0) - 1,
        ).toBeTruthy();
      }

      const hasHorizontalOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBeFalsy();

      await captureEvidence(page, testInfo, {
        scenario: `responsive-${viewport.key}`,
        role: "super_admin",
        viewport: { width: viewport.width, height: viewport.height },
        route: "/dashboard?screen=MAP-01",
        result: "PASS",
        assertions: [
          `Required viewport ${viewport.width}x${viewport.height} rendered`,
          "Authenticated session bootstrap completed before shell assertions",
          "MAP-01 is rendered from the verbatim BA source-port",
          viewport.width > 980
            ? "Desktop renders the exact 300px MVP sidebar"
            : "<=980px renders the MVP stacked sidebar/main layout",
          "Primary navigation remains usable",
          "No horizontal page overflow",
        ],
      });
    });
  }
});
