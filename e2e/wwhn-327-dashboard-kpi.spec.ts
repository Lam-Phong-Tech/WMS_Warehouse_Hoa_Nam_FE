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
 * WWHN-327 — FE Dashboard enhancement, bằng chứng hành vi FE có kiểm soát.
 *
 * Ranh giới sự thật: mọi payload ở đây là mock deterministic. File này chứng minh
 * FE render đúng contract `GET /api/v1/reports/dashboard-quick` (WWHN-328 KPI matrix
 * v1.1) — KHÔNG chứng minh backend thực sự cắt data-scope, không thay QA2 (WWHN-329)
 * và không phải bằng chứng UAT.
 */

const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local-controlled";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
const EVIDENCE_ROOT =
  process.env.WWHN_327_EVIDENCE_DIR ??
  join("test-results", "wwhn-327", SOURCE_SHA);

const REQUIRED_VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "tablet", width: 768, height: 1024 },
  { key: "mobile", width: 375, height: 812 },
] as const;

const GLOBAL_PAYLOAD = {
  period: { from_date: "2026-07-19", to_date: "2026-08-18" },
  data_scope: "GLOBAL",
  scope_warehouse_ids: null,
  available_qty: 1234,
  receipt_qty: 300,
  issue_qty: 120,
  component_issue_qty: 25,
  reversal_net: -5,
  warranty_cases_by_status: { CHECKING: 3, COMPLETED: 7 },
  reconciliation_warning_count: 1,
  reconciliation_warnings: [{ product_id: "p-1" }],
};

/**
 * Trần mẫu 50 dòng của BE là lý do `reconciliation_warnings.length` không còn là tổng.
 * Fixture cố tình để length=2 nhưng count=137 để bắt lỗi nếu FE quay về đếm mảng.
 */
const SCOPED_PAYLOAD = {
  ...GLOBAL_PAYLOAD,
  data_scope: "WAREHOUSE_SCOPED",
  scope_warehouse_ids: ["wh-1", "wh-2"],
  reconciliation_warning_count: 137,
  reconciliation_warnings: [{ product_id: "p-1" }, { product_id: "p-2" }],
};

const EMPTY_PAYLOAD = {
  period: { from_date: "2026-07-19", to_date: "2026-08-18" },
  data_scope: "GLOBAL",
  scope_warehouse_ids: null,
  available_qty: 0,
  receipt_qty: 0,
  issue_qty: 0,
  component_issue_qty: 0,
  reversal_net: 0,
  warranty_cases_by_status: {},
  reconciliation_warning_count: 0,
  reconciliation_warnings: [],
};

interface EvidenceInput {
  scenario: string;
  role: string;
  viewport: { width: number; height: number };
  route: string;
  assertions: string[];
}

interface DashboardMockOptions {
  permissionCodes?: string[];
  isSuperAdmin?: boolean;
  dashboardStatus?: number;
  dashboardBody?: unknown;
  dashboardErrorCode?: string;
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
    "WWHN-327",
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
    ticket: "WWHN-327",
    parent: "WWHN-88",
    pairedBackendTicket: "WWHN-328",
    independentQaTicket: "WWHN-329",
    contract: "GET /api/v1/reports/dashboard-quick (KPI matrix v1.1)",
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
      "Controlled FE rendering evidence only; not proof of backend data-scope enforcement, not QA2 independent evidence (WWHN-329), not UAT.",
  };

  writeFileSync(
    join(EVIDENCE_ROOT, metadataFilename),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  await testInfo.attach("wwhn-327-evidence-metadata", {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

function authUser(permissionCodes: string[], isSuperAdmin: boolean) {
  const activeContext = {
    role_id: 327,
    role_name: isSuperAdmin ? "Super Admin" : "Warehouse Report Viewer",
    scope_type: "he_thong",
    org_unit_id: null,
    department_id: null,
    warehouse_id: null,
    permission_codes: permissionCodes,
  };

  return {
    id: 327,
    name: "WWHN-327 Dashboard Evidence",
    email: "wwhn327.evidence@example.com",
    code: "WWHN-327-EVIDENCE",
    is_super_admin: isSuperAdmin,
    permissions: permissionCodes,
    active_context: activeContext,
    available_contexts: [activeContext],
  };
}

async function setupMockApi(
  page: Page,
  options: DashboardMockOptions = {},
): Promise<void> {
  const permissionCodes = options.permissionCodes ?? ["report.view"];
  const isSuperAdmin = options.isSuperAdmin ?? false;
  const dashboardStatus = options.dashboardStatus ?? 200;
  const user = authUser(permissionCodes, isSuperAdmin);

  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;

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
          meta: { request_id: "WWHN-327-REFRESH-200" },
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
          meta: { request_id: "WWHN-327-ME-200" },
        }),
      });
      return;
    }

    if (path.endsWith("/reports/dashboard-quick")) {
      if (dashboardStatus !== 200) {
        await route.fulfill({
          status: dashboardStatus,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Controlled dashboard error",
            error_code: options.dashboardErrorCode ?? "ACCESS_DENIED",
            request_id: `WWHN-327-DASHBOARD-${dashboardStatus}`,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: options.dashboardBody ?? GLOBAL_PAYLOAD,
          meta: { request_id: "WWHN-327-DASHBOARD-200" },
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

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
}

test.use({ video: "on", trace: "on", screenshot: "on" });

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe("WWHN-327 FE-controlled dashboard KPI closure", () => {
  for (const viewport of REQUIRED_VIEWPORTS) {
    test(`renders the aggregate KPI at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/dashboard");

      const kpi = page.getByRole("region", { name: "KPI vận hành" });
      await expect(kpi).toBeVisible();
      await expect(kpi.getByText("1.234")).toBeVisible();
      await expect(
        page.getByText(/Phạm vi dữ liệu:\s*Toàn hệ thống/),
      ).toBeVisible();

      // GLOBAL không được hiện ngoại lệ warranty — nếu hiện, nhãn phạm vi mất nghĩa.
      await expect(page.getByRole("note")).toHaveCount(0);
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await captureEvidence(page, testInfo, {
        scenario: "kpi-global",
        role: "report.view",
        viewport,
        route: "/dashboard",
        assertions: [
          "KPI region visible with available_qty formatted vi-VN",
          "data_scope=GLOBAL rendered as 'Toàn hệ thống'",
          "no warranty GLOBAL exception note on a GLOBAL payload",
          "no horizontal overflow",
        ],
      });
    });
  }

  test("declares the warranty GLOBAL exception on a warehouse-scoped payload", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page, { dashboardBody: SCOPED_PAYLOAD });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    await expect(
      page.getByText(/Phạm vi dữ liệu:\s*Giới hạn 2 kho theo phân quyền/),
    ).toBeVisible();

    const note = page.getByRole("note");
    await expect(note).toContainText("số liệu bảo hành vẫn là toàn hệ thống");
    await expect(note).toContainText("warranty_case không gắn kho trong ERD");

    // Tổng cảnh báo phải đọc từ reconciliation_warning_count, không phải length mảng mẫu.
    await expect(page.getByText("137 cảnh báo")).toBeVisible();

    await captureEvidence(page, testInfo, {
      scenario: "kpi-warehouse-scoped",
      role: "report.view",
      viewport: { width: 1440, height: 900 },
      route: "/dashboard",
      assertions: [
        "data_scope=WAREHOUSE_SCOPED rendered with scope_warehouse_ids length",
        "warranty GLOBAL exception declared on screen",
        "reconciliation total read from reconciliation_warning_count (137), not sample length (2)",
      ],
    });
  });

  test("renders an explicit empty state instead of fabricated chart data", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page, { dashboardBody: EMPTY_PAYLOAD });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    await expect(page.getByText("Không có số liệu trong kỳ.")).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Biểu đồ luồng kho/ }),
    ).toHaveCount(0);

    await captureEvidence(page, testInfo, {
      scenario: "empty-state",
      role: "report.view",
      viewport: { width: 1440, height: 900 },
      route: "/dashboard",
      assertions: [
        "explicit empty state rendered",
        "no chart is drawn from zero-value KPI",
      ],
    });
  });

  test("fails closed for a profile without report.view", async ({
    page,
  }, testInfo) => {
    let dashboardCalls = 0;
    await setupMockApi(page, { permissionCodes: ["inventory.view"] });
    page.on("request", (request) => {
      if (request.url().includes("/reports/dashboard-quick"))
        dashboardCalls += 1;
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    await expect(
      page.getByText("Bạn không có quyền report.view trong context hiện hành."),
    ).toBeVisible();
    expect(dashboardCalls).toBe(0);

    await captureEvidence(page, testInfo, {
      scenario: "no-permission",
      role: "inventory.view-only",
      viewport: { width: 1440, height: 900 },
      route: "/dashboard",
      assertions: [
        "no-permission state rendered for a loaded profile without report.view",
        "report API is never called from the UI in that state",
      ],
    });
  });

  test("surfaces a controlled 403 without showing stale or fabricated numbers", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page, {
      dashboardStatus: 403,
      dashboardErrorCode: "ACCESS_DENIED",
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    await expect(
      page.getByText("Bạn không có quyền report.view."),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "KPI vận hành" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeEnabled();

    await captureEvidence(page, testInfo, {
      scenario: "api-403",
      role: "report.view",
      viewport: { width: 1440, height: 900 },
      route: "/dashboard",
      assertions: [
        "403 ACCESS_DENIED rendered as a permission message",
        "no KPI region and no fabricated data on error",
        "retry action stays enabled",
      ],
    });
  });

  test("surfaces a controlled 422 filter error and keeps retry usable", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page, {
      dashboardStatus: 422,
      dashboardErrorCode: "BUSINESS_RULE_ERROR",
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    await expect(page.getByText("Bộ lọc ngày không hợp lệ.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeEnabled();

    await captureEvidence(page, testInfo, {
      scenario: "api-422",
      role: "report.view",
      viewport: { width: 1440, height: 900 },
      route: "/dashboard",
      assertions: [
        "422 BUSINESS_RULE_ERROR rendered as a filter error",
        "retry action stays enabled after an API error",
      ],
    });
  });

  test("blocks a reversed period on the client before calling the API", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    await expect(
      page.getByRole("region", { name: "KPI vận hành" }),
    ).toBeVisible();

    await page.getByLabel("Từ ngày").fill("2026-08-18");
    await page.getByLabel("Đến ngày").fill("2026-08-01");

    await expect(
      page.getByText("Đến ngày phải lớn hơn hoặc bằng Từ ngày."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Áp dụng" })).toBeDisabled();

    await captureEvidence(page, testInfo, {
      scenario: "reversed-period-guard",
      role: "report.view",
      viewport: { width: 1440, height: 900 },
      route: "/dashboard",
      assertions: [
        "to_date < from_date shows an inline validation message",
        "apply action is disabled so no invalid request is sent",
      ],
    });
  });
});
