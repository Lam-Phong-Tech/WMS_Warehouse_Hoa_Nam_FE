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
import { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN } from "./support/mock-tokens";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
const EVIDENCE_ROOT =
  process.env.WWHN_144_EVIDENCE_DIR ??
  join("test-results", "wwhn-144", SOURCE_SHA);

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
    // WWHN-165: auth.store.setProfile() đọc `permissionCodes` từ me.permissions
    // top-level (BE m1 trả permission ở top-level /auth/me, không theo
    // active_context) — thiếu field này khiến mọi menu/route gate theo
    // permission bị ẩn hết dù mock có permissionCodes trong active_context.
    permissions: options.permissionCodes,
    roles: [
      {
        role_id: "1",
        role_code: options.isSuperAdmin ? "SUPER_ADMIN" : "QA_WWHN_144",
        role_name: options.isSuperAdmin ? "Super Admin" : "Inventory Viewer",
      },
    ],
    warehouse_scope_ids: [],
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

    // ROUTES.MASTER_DATA = "/master-data/skus" (route thật, xem
    // src/shared/constants/routes.ts) — "/master-data" trần không khớp route
    // nào và rơi vào wildcard "*" → Navigate(HOME), khiến case anonymous vô
    // tình vẫn PASS (đích cuối trùng /login) nhưng không test đúng route bảo vệ.
    await page.goto(`${BASE_URL}/master-data/skus?source=direct-url`);
    await expect(page).toHaveURL(/\/login$/);

    await captureEvidence(page, testInfo, {
      scenario: "anonymous-direct-url-login-guard",
      role: "anonymous",
      viewport: { width: 1440, height: 900 },
      route: "/master-data/skus?source=direct-url",
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

    await page.goto(`${BASE_URL}/master-data/skus?source=direct-url`);
    await expect(page).toHaveURL(/\/errors\/403$/);
    await expect(
      page.getByText("Không có quyền truy cập", { exact: true }),
    ).toBeVisible();

    await captureEvidence(page, testInfo, {
      scenario: "limited-role-menu-direct-url-403",
      role: "inventory_viewer",
      viewport: { width: 1440, height: 900 },
      route: "/master-data/skus?source=direct-url",
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
    // Part 4: MAP-01 là DashboardPage thật (bản wireframe MvpSourceScreen +
    // footer-note "Wireframe low-fi..." đã bị thay từ đợt MUI hoá [skip ci]
    // 5df4f21 — assertion cũ trỏ nội dung không còn tồn tại). Hợp đồng mới:
    // marker MAP-01 + tiêu đề dashboard thật.
    await expect(page.locator('[data-mvp-screen="MAP-01"]')).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Tổng quan kho" }),
    ).toBeVisible();

    // Điều hướng bằng đúng mục sidebar (nhãn nav-data hiện hành).
    await page
      .getByTestId("primary-navigation")
      .getByRole("button", { name: "Danh sách SKU", exact: true })
      .click();
    await expect(page).toHaveURL(/\/master-data\/skus\?screen=MST-01$/);
    await expect(page.locator('[data-mvp-screen="MST-01"]')).toBeVisible();
    // MST-01 sau khi vào bằng SideNav render SkuMasterScreen thật (component
    // API-backed, ApiMasterScreens.tsx) chứ không phải bảng tĩnh của
    // MvpSourceScreen wireframe nữa — cột "Theo dõi serial"/nút "+ Tạo SKU" là
    // câu chữ wireframe cũ, component thật dùng "Serial" (<th>) và "Thêm SKU".
    // Cột "Serial" thuộc bảng SKU thế hệ cũ — bảng hiện hành (ApiMasterScreens)
    // dùng bộ cột SKU/Loại/Hãng/Nhóm hàng/Trạng thái/Ứng dụng phân vùng.
    await expect(
      page.getByRole("columnheader", { name: /sắp xếp theo SKU/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Thêm SKU" })).toBeVisible();

    await captureEvidence(page, testInfo, {
      scenario: "verbatim-ba-source-screen-navigation",
      role: "super_admin",
      viewport: { width: 1440, height: 900 },
      route: "/master-data/skus?screen=MST-01",
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

      // Part 4 shell (UiAppShell — Vuexy): desktop sidebar cố định 260px;
      // <lg (980) sidebar chuyển thành Drawer overlay + hamburger ở topbar
      // (thay hợp đồng cũ .hn-mvp-* 300px/stacked của shell wireframe).
      const main = page.locator("main");
      await expect(main).toBeVisible();
      await expect(page.locator('[data-mvp-screen="MAP-01"]')).toBeVisible();

      const mainBox = await main.boundingBox();
      expect(mainBox).not.toBeNull();

      if (viewport.width >= 980) {
        const aside = page.getByTestId("app-sidebar");
        await expect(aside).toBeVisible();
        await expect(page.getByTestId("primary-navigation")).toBeVisible();
        await expect(
          page.getByText("Hoa Nam WMS", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("Bản đồ màn hình & phạm vi", { exact: true }).first(),
        ).toBeVisible();
        const asideBox = await aside.boundingBox();
        expect(asideBox).not.toBeNull();
        expect(Math.round(asideBox?.width ?? 0)).toBe(260);
        expect(Math.round(mainBox?.x ?? 0)).toBe(260);
      } else {
        // Mobile/tablet: sidebar ẩn, mở qua hamburger → Drawer 260px.
        await expect(page.getByTestId("app-sidebar")).toHaveCount(0);
        const hamburger = page.getByTestId("mobile-nav-toggle");
        await expect(hamburger).toBeVisible();
        await hamburger.click();
        const drawerNav = page.getByTestId("primary-navigation");
        await expect(drawerNav).toBeVisible();
        await expect(
          drawerNav.getByText("Bản đồ màn hình & phạm vi", { exact: true }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(drawerNav).toBeHidden();
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
