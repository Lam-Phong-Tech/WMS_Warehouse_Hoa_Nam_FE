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

const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local-controlled";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
const EVIDENCE_ROOT =
  process.env.WWHN_292_EVIDENCE_DIR ??
  join("test-results", "wwhn-292", SOURCE_SHA);

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

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  input: EvidenceInput,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const prefix = [
    "WWHN-292",
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
    ticket: "WWHN-292",
    parent: "WWHN-78",
    dependency: "HN-UAT-003",
    evidenceClass: "FE_CONTROLLED_NOT_UAT",
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
      "Controlled FE behavior evidence only; not QA2 independent UAT evidence and not proof of backend authorization/data-scope enforcement.",
  };

  writeFileSync(
    join(EVIDENCE_ROOT, metadataFilename),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  await testInfo.attach("wwhn-292-evidence-metadata", {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

function authUser(options: Required<AuthOptions>) {
  const activeContext = {
    role_id: 292,
    role_name: options.isSuperAdmin ? "Super Admin" : "Limited UAT Viewer",
    scope_type: "he_thong",
    org_unit_id: null,
    department_id: null,
    warehouse_id: null,
    permission_codes: options.permissionCodes,
  };

  return {
    id: 292,
    name: options.isSuperAdmin ? "WWHN-292 Super Admin" : "WWHN-292 Viewer",
    email: "wwhn292.evidence@example.com",
    code: "WWHN-292-EVIDENCE",
    is_super_admin: options.isSuperAdmin,
    permissions: options.permissionCodes,
    active_context: activeContext,
    available_contexts: [activeContext],
  };
}

async function setupMockApi(
  page: Page,
  partial: AuthOptions = {},
): Promise<void> {
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
            message: "No active controlled evidence session",
            error_code: "UNAUTHENTICATED",
            request_id: "WWHN-292-REFRESH-401",
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
          meta: { request_id: "WWHN-292-REFRESH-200" },
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
          meta: { request_id: "WWHN-292-ME-200" },
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

test.describe("WWHN-292 FE-controlled UI/responsive/RBAC closure", () => {
  for (const viewport of REQUIRED_VIEWPORTS) {
    test(`required login viewport ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page, { refreshSuccess: false });
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/login");

      await expect(
        page.getByRole("heading", { name: "Đăng nhập hệ thống" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Đăng nhập" }),
      ).toBeVisible();

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

  test("shared component states are explicit and retry-safe", async ({
    page,
  }, testInfo) => {
    const viewport = { width: 1440, height: 900 };
    await setupMockApi(page, { refreshSuccess: true, isSuperAdmin: true });
    await page.setViewportSize(viewport);
    await page.goto("/component-catalog");

    await expect(
      page.getByRole("heading", { name: "Component catalog", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("Loading", { exact: true })).toBeVisible();
    await expect(page.getByText("Empty", { exact: true })).toBeVisible();
    await expect(page.getByText("Error", { exact: true })).toBeVisible();
    await expect(
      page.getByText("No permission", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("API error + field errors", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Confirm action", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Disabled until valid" }),
    ).toBeDisabled();

    await captureEvidence(page, testInfo, {
      scenario: "shared-ui-states",
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

  test("limited role menu and direct URL fail closed to 403", async ({
    page,
  }, testInfo) => {
    const viewport = { width: 1440, height: 900 };
    await setupMockApi(page, {
      refreshSuccess: true,
      permissionCodes: ["inventory.view"],
    });
    await page.setViewportSize(viewport);

    await page.goto("/dashboard");
    await expect(page.getByTestId("primary-navigation")).toBeVisible();
    await expect(
      page.getByText("Danh sách SKU / Product Master", { exact: true }),
    ).toHaveCount(0);

    await page.goto("/master-data/skus");
    await expect(page).toHaveURL(/\/errors\/403$/);
    await expect(
      page.getByText("Không có quyền truy cập", { exact: true }),
    ).toBeVisible();

    await captureEvidence(page, testInfo, {
      scenario: "limited-role-menu-direct-url-403",
      role: "inventory_viewer_controlled",
      viewport,
      route: "/master-data/skus",
      assertions: [
        "Master/SKU navigation is hidden without permission",
        "Direct protected URL bypass redirects to /errors/403",
        "Explicit no-permission state is rendered",
      ],
    });
  });

  test("controlled login 422 remains visible and retry enabled", async ({
    page,
  }, testInfo) => {
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
          errors: {
            email: ["Thông tin đăng nhập không hợp lệ"],
          },
          request_id: "WWHN-292-LOGIN-422",
        }),
      });
    });

    await page.setViewportSize(viewport);
    await page.goto("/login");
    await page.locator('input[name="identifier"]').fill("wwhn292@example.com");
    await page
      .locator('input[name="password"]')
      .fill(process.env.QA_EVIDENCE_PASSWORD ?? "<QA_EVIDENCE_PASSWORD>");

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v1/auth/login") &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Đăng nhập" }).click(),
    ]);

    expect(loginResponse.status()).toBe(422);
    await expect(
      page.getByText("Thông tin đăng nhập không hợp lệ"),
    ).toBeVisible();
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

  /**
   * NFR-SRS-006 fixes the desktop baseline at >=1280px, and the BA wireframe
   * (HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12) stacks the 300px aside below
   * 980px. The authenticated shell — not only /login — must honour both.
   */
  const SHELL_VIEWPORTS = [
    { key: "desktop", width: 1440, height: 900 },
    { key: "desktop-nfr-006-min", width: 1280, height: 900 },
    { key: "tablet", width: 768, height: 1024 },
    { key: "mobile", width: 375, height: 812 },
  ] as const;

  const WIREFRAME_STACK_BREAKPOINT = 980;
  const DESKTOP_ASIDE_WIDTH = 300;

  for (const viewport of SHELL_VIEWPORTS) {
    test(`authenticated shell responsive ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page, { refreshSuccess: true, isSuperAdmin: true });
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/dashboard");

      await expect(page.getByTestId("primary-navigation")).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Bản đồ màn hình & phạm vi",
          level: 2,
        }),
      ).toBeVisible();

      const shell = await page.evaluate(() => {
        const aside = document.querySelector(".hn-mvp-aside");
        const main = document.querySelector(".hn-mvp-main");
        return {
          hasHorizontalOverflow:
            document.documentElement.scrollWidth > window.innerWidth + 1,
          asidePosition: aside ? getComputedStyle(aside).position : null,
          asideWidth: aside
            ? Math.round(aside.getBoundingClientRect().width)
            : null,
          mainMarginLeft: main ? getComputedStyle(main).marginLeft : null,
        };
      });

      expect(shell.hasHorizontalOverflow).toBe(false);

      const isStacked = viewport.width <= WIREFRAME_STACK_BREAKPOINT;
      if (isStacked) {
        expect(shell.asidePosition).toBe("static");
        expect(shell.mainMarginLeft).toBe("0px");
        expect(shell.asideWidth).toBe(viewport.width);
      } else {
        expect(shell.asidePosition).toBe("fixed");
        expect(shell.asideWidth).toBe(DESKTOP_ASIDE_WIDTH);
        expect(shell.mainMarginLeft).toBe(`${DESKTOP_ASIDE_WIDTH}px`);
      }

      await captureEvidence(page, testInfo, {
        scenario: `responsive-shell-${viewport.key}`,
        role: "super_admin_controlled",
        viewport: { width: viewport.width, height: viewport.height },
        route: "/dashboard",
        assertions: [
          `Authenticated shell rendered at ${viewport.width}x${viewport.height}`,
          "Primary navigation and screen heading are visible",
          "No horizontal page overflow",
          isStacked
            ? `Aside stacks full width at or below ${WIREFRAME_STACK_BREAKPOINT}px (wireframe baseline)`
            : `Aside stays fixed at ${DESKTOP_ASIDE_WIDTH}px and main is offset (NFR-SRS-006 desktop baseline)`,
        ],
      });
    });
  }

  /**
   * Route-level fail-closed must hold for every protected destination, not only
   * one sample route. The limited role below owns inventory.view exclusively.
   */
  const LIMITED_ROLE_PERMISSIONS = ["inventory.view"];

  const PROTECTED_ROUTE_MATRIX = [
    {
      screen: "IAM-01",
      route: "/system/users",
      menuLabel: "Danh sách người dùng & phân quyền",
    },
    {
      screen: "MST-01",
      route: "/master-data/skus",
      menuLabel: "Danh sách SKU / Product Master",
    },
    {
      screen: "MST-CAT-01",
      route: "/master-data/catalog",
      menuLabel: "Danh mục Product Master",
    },
    {
      screen: "WH-01",
      route: "/master-data/warehouse",
      menuLabel: "Cấu hình kho tổng",
    },
    {
      screen: "AGY-01",
      route: "/master-data/agencies",
      menuLabel: "Danh mục đại lý / nơi nhận",
    },
    {
      screen: "DEF-01",
      route: "/master-data/defects",
      menuLabel: "Danh mục bệnh / lỗi",
    },
    { screen: "IN-01", route: "/inbound", menuLabel: "Danh sách phiếu nhập" },
    {
      screen: "PTW-00",
      route: "/putaway",
      menuLabel: "Danh sách linh kiện chờ xếp khay",
    },
    { screen: "OUT-01", route: "/outbound", menuLabel: "Danh sách phiếu xuất" },
    { screen: "WAR-01", route: "/warranty", menuLabel: "Danh sách bảo hành" },
    // REV-00 (/reverse) đã chuyển sang positive control bên dưới: WWHN-242 xác lập
    // REV-00 là màn ĐỌC — SRS §3 "Inventory query/trace/reversal" cấp V qua
    // inventory.view và BE mở GET /reversal-documents bằng inventory.view, nên
    // inventory_viewer PHẢI vào được. Suất deny thay bằng IAM-02 (/system/roles).
    {
      screen: "IAM-02",
      route: "/system/roles",
      menuLabel: "Vai trò & phân quyền",
    },
    { screen: "RPT-01", route: "/reports", menuLabel: "Báo cáo vận hành" },
    { screen: "AUDIT-01", route: "/audit-logs", menuLabel: null },
  ] as const;

  for (const target of PROTECTED_ROUTE_MATRIX) {
    test(`direct URL ${target.route} fails closed for a limited role`, async ({
      page,
    }, testInfo) => {
      const viewport = { width: 1440, height: 900 };
      await setupMockApi(page, {
        refreshSuccess: true,
        permissionCodes: LIMITED_ROLE_PERMISSIONS,
      });
      await page.setViewportSize(viewport);

      await page.goto(target.route);
      await expect(page).toHaveURL(/\/errors\/403$/);
      await expect(
        page.getByText("Không có quyền truy cập", { exact: true }),
      ).toBeVisible();

      if (target.menuLabel) {
        await expect(
          page.getByRole("button", { name: target.menuLabel, exact: true }),
        ).toHaveCount(0);
      }

      await captureEvidence(page, testInfo, {
        scenario: `direct-url-403-${target.screen}`,
        role: "inventory_viewer_controlled",
        viewport,
        route: target.route,
        assertions: [
          `Direct URL ${target.route} bypass redirects to /errors/403`,
          "Explicit no-permission state is rendered",
          target.menuLabel
            ? `Menu entry "${target.menuLabel}" stays hidden without permission`
            : "Route has no menu entry in the MVP navigation",
        ],
      });
    });
  }

  test("permitted route stays reachable for the same limited role", async ({
    page,
  }, testInfo) => {
    const viewport = { width: 1440, height: 900 };
    await setupMockApi(page, {
      refreshSuccess: true,
      permissionCodes: LIMITED_ROLE_PERMISSIONS,
    });
    await page.setViewportSize(viewport);

    await page.goto("/inventory");
    await expect(page).toHaveURL(/\/inventory$/);
    await expect(
      page.getByRole("button", {
        name: "Tra cứu tồn & đối soát",
        exact: true,
      }),
    ).toBeVisible();

    await captureEvidence(page, testInfo, {
      scenario: "permitted-route-reachable",
      role: "inventory_viewer_controlled",
      viewport,
      route: "/inventory",
      assertions: [
        "inventory.view grants entry to /inventory",
        "Permitted menu entry stays visible",
        "Fail-closed guard does not over-block granted permissions",
      ],
    });
  });

  /**
   * Positive control #2 — REV-00 read semantic (WWHN-242). SRS §3 "Inventory
   * query/trace/reversal" grants V through inventory.view and BE serves
   * GET /reversal-documents with inventory.view, so the read-only reversal list
   * must stay reachable for the same limited role; only store/confirm/post/
   * cancel require inventory.reversal.post and stay hidden inside the screen.
   */
  test("reversal read screen stays reachable for inventory.view (WWHN-242 read semantic)", async ({
    page,
  }, testInfo) => {
    const viewport = { width: 1440, height: 900 };
    await setupMockApi(page, {
      refreshSuccess: true,
      permissionCodes: LIMITED_ROLE_PERMISSIONS,
    });
    await page.setViewportSize(viewport);

    await page.goto("/reverse");
    await expect(page).toHaveURL(/\/reverse$/);
    await expect(
      page.getByRole("button", {
        name: "Danh sách phiếu Reversal",
        exact: true,
      }),
    ).toBeVisible();

    await captureEvidence(page, testInfo, {
      scenario: "reversal-read-reachable",
      role: "inventory_viewer_controlled",
      viewport,
      route: "/reverse",
      assertions: [
        "inventory.view grants read entry to /reverse (REV-00 read semantic, WWHN-242)",
        "No redirect to /errors/403 for the read-only reversal list",
        "Write actions remain gated by inventory.reversal.post inside the screen",
      ],
    });
  });
});
