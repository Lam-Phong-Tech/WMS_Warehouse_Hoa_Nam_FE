import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";
import { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN } from "./support/mock-tokens";

const SOURCE_SHA = process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local-controlled";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
const EVIDENCE_ROOT = process.env.WWHN_274_EVIDENCE_DIR ?? join("test-results", "wwhn-274", SOURCE_SHA);

const REQUIRED_VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "tablet", width: 768, height: 1024 },
  { key: "mobile", width: 375, height: 812 },
] as const;

interface EvidenceInput {
  scenario: string;
  role: string;
  viewport: { width: number; height: number };
  route: string;
  assertions: string[];
}

interface AuthOptions {
  refreshSuccess?: boolean;
  isSuperAdmin?: boolean;
  permissionCodes?: string[];
}

function safeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function captureEvidence(page: Page, testInfo: TestInfo, input: EvidenceInput): Promise<void> {
  const timestamp = new Date().toISOString();
  const prefix = [
    "WWHN-274",
    safeName(input.scenario),
    safeName(input.role),
    `${input.viewport.width}x${input.viewport.height}`,
  ].join("__");
  const screenshotFilename = `${prefix}.png`;
  const metadataFilename = `${prefix}.json`;

  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE_ROOT, screenshotFilename), fullPage: true });

  const metadata = {
    ticket: "WWHN-274",
    parent: "WWHN-72",
    parentTempKey: "HN-DEVOPS-003",
    evidenceClass: "FE_CONTROLLED_NOT_QA_UAT",
    result: "PASS",
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    browserProject: testInfo.project.name,
    role: input.role,
    viewport: input.viewport,
    route: input.route,
    finalUrl: page.url(),
    timestamp,
    screenshotFilename,
    assertions: input.assertions,
    truthBoundary:
      "Controlled FE release-signoff evidence only; not independent QA1/UAT evidence and not proof of backend authorization/data-scope, deployment, backup, restore or rollback.",
  };

  writeFileSync(join(EVIDENCE_ROOT, metadataFilename), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await testInfo.attach("wwhn-274-evidence-metadata", {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

function authUser(options: Required<AuthOptions>) {
  const activeContext = {
    role_id: 274,
    role_name: options.isSuperAdmin ? "Super Admin" : "Limited Release Viewer",
    scope_type: "he_thong",
    org_unit_id: null,
    department_id: null,
    warehouse_id: null,
    permission_codes: options.permissionCodes,
  };

  return {
    id: 274,
    name: options.isSuperAdmin ? "WWHN-274 Super Admin" : "WWHN-274 Viewer",
    email: "wwhn274.evidence@example.com",
    code: "WWHN-274-EVIDENCE",
    is_super_admin: options.isSuperAdmin,
    permissions: options.permissionCodes,
    active_context: activeContext,
    available_contexts: [activeContext],
  };
}

async function setupMockApi(page: Page, partial: AuthOptions = {}): Promise<void> {
  const options: Required<AuthOptions> = {
    refreshSuccess: partial.refreshSuccess ?? false,
    isSuperAdmin: partial.isSuperAdmin ?? false,
    permissionCodes: partial.permissionCodes ?? [],
  };
  const user = authUser(options);

  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/auth/refresh")) {
      if (!options.refreshSuccess) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "No active controlled release session",
            error_code: "UNAUTHENTICATED",
            request_id: "WWHN-274-REFRESH-401",
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
          meta: { request_id: "WWHN-274-REFRESH-200" },
        }),
      });
      return;
    }

    if (path.endsWith("/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: user, meta: { request_id: "WWHN-274-ME-200" } }),
      });
      return;
    }

    if (path.endsWith("/auth/logout")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [], meta: {} }),
    });
  });
}

test.use({ video: "on", trace: "on", screenshot: "on" });

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe("WWHN-274 FE-controlled build/config/smoke release sign-off", () => {
  for (const viewport of REQUIRED_VIEWPORTS) {
    test(`responsive login shell ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await setupMockApi(page, { refreshSuccess: false });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/login");

      await expect(page.getByRole("heading", { name: "Đăng nhập hệ thống" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasHorizontalOverflow).toBe(false);

      await captureEvidence(page, testInfo, {
        scenario: `responsive-login-${viewport.key}`,
        role: "anonymous",
        viewport: { width: viewport.width, height: viewport.height },
        route: "/login",
        assertions: [
          `Required viewport ${viewport.width}x${viewport.height} rendered`,
          "Login heading and submit action are visible",
          "No horizontal page overflow",
        ],
      });
    });
  }

  test("shared release UI states are explicit and action-safe", async ({ page }, testInfo) => {
    const viewport = { width: 1440, height: 900 };
    await setupMockApi(page, { refreshSuccess: true, isSuperAdmin: true });
    await page.setViewportSize(viewport);
    await page.goto("/component-catalog");

    await expect(page.getByRole("heading", { name: "Component catalog", level: 2 })).toBeVisible();
    await expect(page.getByText("Loading", { exact: true })).toBeVisible();
    await expect(page.getByText("Empty", { exact: true })).toBeVisible();
    await expect(page.getByText("Error", { exact: true })).toBeVisible();
    await expect(page.getByText("No permission", { exact: true })).toBeVisible();
    await expect(page.getByText("API error + field errors", { exact: true })).toBeVisible();
    await expect(page.getByText("Confirm action", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Disabled until valid" })).toBeDisabled();

    await captureEvidence(page, testInfo, {
      scenario: "shared-release-ui-states",
      role: "super_admin_controlled",
      viewport,
      route: "/component-catalog",
      assertions: [
        "Loading state is visible",
        "Empty state is visible",
        "Error/no-permission states are visible",
        "API field-error state is visible",
        "Confirm state is visible",
        "Invalid action is disabled",
      ],
    });
  });

  test("limited role menu and direct protected URL fail closed to 403", async ({ page }, testInfo) => {
    const viewport = { width: 1440, height: 900 };
    await setupMockApi(page, { refreshSuccess: true, permissionCodes: ["inventory.view"] });
    await page.setViewportSize(viewport);

    await page.goto("/dashboard");
    await expect(page.getByTestId("primary-navigation")).toBeVisible();
    await expect(page.getByText("Danh sách SKU / Product Master", { exact: true })).toHaveCount(0);

    await page.goto("/master-data/skus");
    await expect(page).toHaveURL(/\/errors\/403$/);
    await expect(page.getByText("Không có quyền truy cập", { exact: true })).toBeVisible();

    await captureEvidence(page, testInfo, {
      scenario: "limited-role-menu-direct-url-403",
      role: "inventory_viewer_controlled",
      viewport,
      route: "/master-data/skus",
      assertions: [
        "Unauthorized Master/SKU navigation is hidden",
        "Direct protected URL bypass redirects to /errors/403",
        "Explicit no-permission state is rendered",
      ],
    });
  });

  test("login-api-422-retry-safe", async ({ page }, testInfo) => {
    const viewport = { width: 1440, height: 900 };
    await setupMockApi(page, { refreshSuccess: false });
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Thông tin đăng nhập không hợp lệ",
          error_code: "VALIDATION_ERROR",
          errors: { email: ["Thông tin đăng nhập không hợp lệ"] },
          request_id: "WWHN-274-LOGIN-422",
        }),
      });
    });

    await page.setViewportSize(viewport);
    await page.goto("/login");
    await page.locator('input[name="identifier"]').fill("wwhn274@example.com");
    await page.locator('input[name="password"]').fill(process.env.QA_EVIDENCE_PASSWORD ?? "<QA_EVIDENCE_PASSWORD>");

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (response) => response.url().endsWith("/api/v1/auth/login") && response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Đăng nhập" }).click(),
    ]);

    expect(loginResponse.status()).toBe(422);
    await expect(page.getByText("Thông tin đăng nhập không hợp lệ")).toBeVisible();
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();

    await captureEvidence(page, testInfo, {
      scenario: "login-api-422-retry-safe",
      role: "anonymous",
      viewport,
      route: "/login",
      assertions: [
        "Login API returns controlled 422",
        "Validation message is visible",
        "Login action remains enabled for retry",
      ],
    });
  });
});
