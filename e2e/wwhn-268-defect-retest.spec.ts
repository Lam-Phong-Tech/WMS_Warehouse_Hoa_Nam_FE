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

/**
 * WWHN-268 — retest bằng chứng cho từng defect FE của vòng sửa lỗi WWHN-70 /
 * HN-QA-005-ST01.
 *
 * Spec này KHÔNG phải bằng chứng UAT độc lập. Nó là bằng chứng FE-controlled:
 * mọi phản hồi API đều do Playwright giả lập để ép đúng một trạng thái UI, nên
 * nó chứng minh hành vi FE chứ không chứng minh backend enforce permission /
 * data scope. Bằng chứng backend thuộc WWHN-264 (QA1) và WWHN-266/267 (BE1/BE2).
 *
 * Mỗi capture ghi kèm: SHA nguồn, môi trường, build, vai trò/tài khoản, viewport,
 * route, defect id và danh sách assertion đã chạy — đúng các trường mà register
 * P0/P1/P2 của WWHN-268 yêu cầu.
 */

const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local-controlled";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
const EVIDENCE_ROOT =
  process.env.WWHN_268_EVIDENCE_DIR ??
  join("test-results", "wwhn-268", SOURCE_SHA);

/** Selector hợp đồng — phải khớp src/shared/constants/ui-state.ts. */
const UI_STATE_SELECTOR = {
  loading: '[data-ui-state="loading"]',
  empty: '[data-ui-state="empty"]',
  error: '[data-ui-state="error"]',
  success: '[data-sonner-toast][data-type="success"]',
  disabled: '[data-ui-state="disabled"]',
  confirm: '[data-ui-state="confirm"]',
  "permission-denied": '[data-ui-state="permission-denied"]',
} as const;

type UiState = keyof typeof UI_STATE_SELECTOR;

const REQUIRED_VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "tablet", width: 768, height: 1024 },
  { key: "mobile", width: 375, height: 812 },
] as const;

/**
 * Phạm vi regression của WWHN-268 bám đúng dependency mà register nêu:
 * stock (inbound/outbound/inventory), reversal, warranty và report.
 */
const IN_SCOPE_MODULES = [
  {
    module: "stock-inbound",
    route: "/inbound",
    permissions: ["inbound.view", "inbound.create", "inbound.scan"],
  },
  {
    module: "stock-outbound",
    route: "/outbound",
    permissions: ["outbound.view", "outbound.create", "outbound.scan"],
  },
  {
    module: "stock-inventory",
    route: "/inventory",
    permissions: ["inventory.view"],
  },
  {
    module: "reversal",
    route: "/reverse",
    permissions: ["inventory.reversal.post"],
  },
  {
    module: "warranty",
    route: "/warranty",
    permissions: ["warranty.view", "warranty.manage"],
  },
  { module: "report", route: "/reports", permissions: ["report.view"] },
] as const;

interface CaptureInput {
  defectId: string;
  scenario: string;
  uiState: UiState | "responsive" | "rbac";
  module: string;
  role: string;
  account: string;
  viewport: { width: number; height: number };
  route: string;
  assertions: string[];
}

const capturedIndex: Array<Record<string, unknown>> = [];

function safeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  input: CaptureInput,
): Promise<void> {
  const prefix = [
    "WWHN-268",
    safeName(input.defectId),
    safeName(input.module),
    safeName(input.scenario),
    `${input.viewport.width}x${input.viewport.height}`,
  ].join("__");

  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  await page.screenshot({
    path: join(EVIDENCE_ROOT, `${prefix}.png`),
    fullPage: true,
  });

  const metadata = {
    ticket: "WWHN-268",
    parent: "WWHN-70",
    qaSource: "HN-QA-005-ST01",
    defectId: input.defectId,
    evidenceClass: "FE_CONTROLLED_NOT_UAT",
    result: "PASS",
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    browserProject: testInfo.project.name,
    module: input.module,
    uiState: input.uiState,
    role: input.role,
    account: input.account,
    viewport: input.viewport,
    route: input.route,
    finalUrl: page.url(),
    timestamp: new Date().toISOString(),
    screenshotFilename: `${prefix}.png`,
    assertions: input.assertions,
    truthBoundary:
      "FE-controlled evidence only. Backend permission/data-scope enforcement is proven by WWHN-264 (QA1) and WWHN-266/267 (BE1/BE2), not by this spec.",
  };

  writeFileSync(
    join(EVIDENCE_ROOT, `${prefix}.json`),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
  capturedIndex.push(metadata);

  await testInfo.attach("wwhn-268-evidence-metadata", {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

interface MockOptions {
  /** Cho phép bootstrap phiên thành công. */
  authenticated?: boolean;
  isSuperAdmin?: boolean;
  permissionCodes?: string[];
  /** Ép mọi endpoint nghiệp vụ trả về một hình thái cố định. */
  businessResponse?: "empty" | "error" | "forbidden" | "hang";
}

function authUser(isSuperAdmin: boolean, permissionCodes: string[]) {
  const activeContext = {
    role_id: 268,
    role_name: isSuperAdmin ? "Super Admin" : "WWHN-268 Limited Role",
    scope_type: "he_thong",
    org_unit_id: null,
    department_id: null,
    warehouse_id: null,
    permission_codes: permissionCodes,
  };

  return {
    id: 268,
    name: isSuperAdmin ? "WWHN-268 Super Admin" : "WWHN-268 Limited Role",
    email: "wwhn268.retest@example.com",
    code: "WWHN-268-RETEST",
    is_super_admin: isSuperAdmin,
    permissions: permissionCodes,
    active_context: activeContext,
    available_contexts: [activeContext],
  };
}

async function setupMockApi(
  page: Page,
  options: MockOptions = {},
): Promise<void> {
  const authenticated = options.authenticated ?? true;
  const isSuperAdmin = options.isSuperAdmin ?? false;
  const permissionCodes = options.permissionCodes ?? [];
  const businessResponse = options.businessResponse ?? "empty";
  const user = authUser(isSuperAdmin, permissionCodes);

  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/auth/refresh")) {
      if (!authenticated) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "No controlled retest session",
            error_code: "AUTH_REQUIRED",
            request_id: "WWHN-268-REFRESH-401",
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
          meta: { request_id: "WWHN-268-REFRESH-200" },
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
          meta: { request_id: "WWHN-268-ME-200" },
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

    if (businessResponse === "hang") {
      // Không bao giờ fulfill: giữ màn hình ở đúng trạng thái loading để chụp.
      return;
    }

    if (businessResponse === "forbidden") {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Bạn không có quyền thực hiện thao tác này",
          error_code: "PERMISSION_DENIED",
          request_id: "WWHN-268-BUSINESS-403",
        }),
      });
      return;
    }

    if (businessResponse === "error") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Lỗi máy chủ khi tải dữ liệu",
          error_code: "INTERNAL_ERROR",
          request_id: "WWHN-268-BUSINESS-500",
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
        meta: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
      }),
    });
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflowed = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflowed).toBe(false);
}

// Ảnh bằng chứng do capture() chụp tường minh, nên không cần Playwright tự chụp
// mọi bước: giữ video/trace/screenshot ở chế độ chỉ-khi-lỗi để tránh nghẽn I/O
// làm rớt ca kiểm vì lý do hạ tầng thay vì lý do nghiệp vụ.
test.use({
  video: "retain-on-failure",
  trace: "retain-on-failure",
  screenshot: "only-on-failure",
});

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe("WWHN-268 · FE268-D01 · hợp đồng trạng thái UI có bằng chứng theo từng trạng thái", () => {
  for (const viewport of REQUIRED_VIEWPORTS) {
    test(`gallery 7 trạng thái tại ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page, { authenticated: true, isSuperAdmin: true });
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/component-catalog");

      // loading / empty / error / permission-denied render tĩnh trên gallery.
      for (const state of [
        "loading",
        "empty",
        "error",
        "permission-denied",
      ] as const) {
        await expect(
          page.locator(UI_STATE_SELECTOR[state]).first(),
        ).toBeVisible();
      }

      // disabled: nút submit bị chặn phải mang test hook chuẩn.
      const disabled = page.locator(UI_STATE_SELECTOR.disabled).first();
      await expect(disabled).toBeVisible();
      await expect(disabled).toBeDisabled();

      // confirm: mở Popconfirm bằng hành động thật của người dùng.
      await page.getByRole("button", { name: "useUiConfirm()" }).click();
      await expect(
        page.locator(UI_STATE_SELECTOR.confirm).first(),
      ).toBeVisible();

      // success: xác nhận Popconfirm để sinh toast thành công thật.
      await page.getByRole("button", { name: "Đồng ý" }).click();
      await expect(
        page.locator(UI_STATE_SELECTOR.success).first(),
      ).toBeVisible();

      await expectNoHorizontalOverflow(page);

      await capture(page, testInfo, {
        defectId: "FE268-D01",
        scenario: `ui-state-gallery-${viewport.key}`,
        uiState: "responsive",
        module: "shared-ui-states",
        role: "SUPER_ADMIN",
        account: "wwhn268.retest@example.com",
        viewport: { width: viewport.width, height: viewport.height },
        route: "/component-catalog",
        assertions: [
          "loading/empty/error/permission-denied/disabled/confirm/success đều có selector ổn định",
          "Nút disabled thực sự bị vô hiệu hoá, không chỉ đổi màu",
          "Confirm mở bằng thao tác người dùng và toast success sinh sau khi đồng ý",
          `Không tràn ngang tại ${viewport.width}x${viewport.height}`,
        ],
      });
    });
  }
});

test.describe("WWHN-268 · FE268-D02 · trạng thái theo từng module trong phạm vi regression", () => {
  for (const target of IN_SCOPE_MODULES) {
    test(`${target.module} · loading → empty`, async ({ page }, testInfo) => {
      await setupMockApi(page, {
        authenticated: true,
        permissionCodes: [...target.permissions],
        businessResponse: "hang",
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(target.route);

      // Skeleton lúc tải chunk route cũng là data-ui-state="loading"; bằng chứng
      // của module phải khoá vào đúng dải loading của bảng dữ liệu.
      await expect(
        page.getByTestId("ui-state-loading-table").first(),
      ).toBeVisible();
      await capture(page, testInfo, {
        defectId: "FE268-D02",
        scenario: "loading",
        uiState: "loading",
        module: target.module,
        role: "LIMITED_ROLE",
        account: "wwhn268.retest@example.com",
        viewport: { width: 1440, height: 900 },
        route: target.route,
        assertions: [
          "Yêu cầu nghiệp vụ bị giữ nên bảng dữ liệu ở đúng trạng thái loading",
          "Dải loading của bảng có testid ổn định ui-state-loading-table, tách khỏi skeleton chunk route",
        ],
      });

      await page.unrouteAll({ behavior: "ignoreErrors" });
      await setupMockApi(page, {
        authenticated: true,
        permissionCodes: [...target.permissions],
        businessResponse: "empty",
      });
      await page.goto(target.route);
      await expect(page.locator(UI_STATE_SELECTOR.empty).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await capture(page, testInfo, {
        defectId: "FE268-D02",
        scenario: "empty",
        uiState: "empty",
        module: target.module,
        role: "LIMITED_ROLE",
        account: "wwhn268.retest@example.com",
        viewport: { width: 1440, height: 900 },
        route: target.route,
        assertions: [
          "Danh sách rỗng hiển thị EmptyState dùng chung",
          "Trạng thái empty có selector ổn định data-ui-state=empty",
        ],
      });
    });

    test(`${target.module} · lỗi máy chủ và từ chối quyền`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page, {
        authenticated: true,
        permissionCodes: [...target.permissions],
        businessResponse: "error",
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(target.route);

      await expect(page.locator(UI_STATE_SELECTOR.error).first()).toBeVisible();
      await capture(page, testInfo, {
        defectId: "FE268-D02",
        scenario: "error-500",
        uiState: "error",
        module: target.module,
        role: "LIMITED_ROLE",
        account: "wwhn268.retest@example.com",
        viewport: { width: 1440, height: 900 },
        route: target.route,
        assertions: [
          "500 INTERNAL_ERROR hiển thị surface lỗi dùng chung, không phải bảng rỗng câm",
          "Trạng thái error có selector ổn định data-ui-state=error",
        ],
      });

      await page.unrouteAll({ behavior: "ignoreErrors" });
      await setupMockApi(page, {
        authenticated: true,
        permissionCodes: [...target.permissions],
        businessResponse: "forbidden",
      });
      await page.goto(target.route);
      await expect(
        page.locator(UI_STATE_SELECTOR["permission-denied"]).first(),
      ).toBeVisible();
      await capture(page, testInfo, {
        defectId: "FE268-D02",
        scenario: "permission-denied-403",
        uiState: "permission-denied",
        module: target.module,
        role: "LIMITED_ROLE",
        account: "wwhn268.retest@example.com",
        viewport: { width: 1440, height: 900 },
        route: target.route,
        assertions: [
          "403 PERMISSION_DENIED hiển thị trạng thái không đủ quyền riêng biệt, không lẫn với lỗi 500",
          "Trạng thái permission-denied có selector ổn định",
        ],
      });
    });
  }
});

test.describe("WWHN-268 · FE268-D03 · chặn truy cập trực tiếp theo vai trò", () => {
  for (const target of IN_SCOPE_MODULES) {
    test(`${target.module} · vai trò thiếu quyền bị chặn trước khi vào màn`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page, {
        authenticated: true,
        permissionCodes: ["dashboard.view"],
        businessResponse: "empty",
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(target.route);

      await expect(page).toHaveURL(/\/errors\/403$/);
      await capture(page, testInfo, {
        defectId: "FE268-D03",
        scenario: "rbac-direct-url-denied",
        uiState: "rbac",
        module: target.module,
        role: "DASHBOARD_ONLY",
        account: "wwhn268.retest@example.com",
        viewport: { width: 1440, height: 900 },
        route: target.route,
        assertions: [
          "Truy cập trực tiếp bằng URL vẫn bị chặn, không chỉ ẩn menu",
          "Điều hướng về /errors/403 thay vì render màn nghiệp vụ",
        ],
      });
    });
  }
});

test.afterAll(async () => {
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  writeFileSync(
    join(EVIDENCE_ROOT, "WWHN-268_EVIDENCE_INDEX.json"),
    `${JSON.stringify(
      {
        ticket: "WWHN-268",
        parent: "WWHN-70",
        qaSource: "HN-QA-005-ST01",
        sourceSha: SOURCE_SHA,
        environment: APP_ENV,
        buildVersion: BUILD_VERSION,
        generatedAt: new Date().toISOString(),
        captureCount: capturedIndex.length,
        captures: capturedIndex,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
});
