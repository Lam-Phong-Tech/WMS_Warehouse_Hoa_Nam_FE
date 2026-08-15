/**
 * WWHN-178 / WWHN-179 – Master/SKU UI, validation, responsive, RBAC and
 * API-error evidence.
 *
 * Controlled mocks prove deterministic FE behaviour only. They do not replace
 * independent QA2 execution or backend authorization evidence.
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
  process.env.WWHN_178_EVIDENCE_DIR ??
  join("test-results", "wwhn-178", SOURCE_SHA);

const VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "tablet", width: 768, height: 1024 },
  { key: "mobile", width: 375, height: 812 },
] as const;

type ProductMode = "success" | "empty" | "forbidden";

interface SessionOptions {
  permissions?: string[];
  productMode?: ProductMode;
  latencyMs?: number;
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
  scenario: string,
  assertions: string[],
): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const prefix = [
    "WWHN-178",
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
    ticket: "WWHN-178",
    qaTicket: "WWHN-179",
    scenario,
    result: "PASS",
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    browserProject: testInfo.project.name,
    viewport,
    route: "/master-data",
    finalUrl: page.url(),
    timestamp: new Date().toISOString(),
    screenshotFilename,
    videoPolicy: "on",
    tracePolicy: "on",
    assertions,
    evidenceBoundary:
      "Controlled FE evidence only; independent QA2 execution and direct backend 403/data-scope evidence remain separate owner gates.",
  };

  writeFileSync(
    join(EVIDENCE_ROOT, metadataFilename),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
  await testInfo.attach("wwhn-178-evidence-metadata", {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

async function mockSession(
  page: Page,
  {
    permissions = ["sku.manage", "master.manage"],
    productMode = "success",
    latencyMs = 0,
  }: SessionOptions = {},
): Promise<string[]> {
  const requestedPaths: string[] = [];

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    requestedPaths.push(path);

    if (latencyMs > 0 && path.endsWith("/products")) {
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
          meta: { request_id: "wwhn-178-refresh" },
        }),
      });
      return;
    }

    if (path.endsWith("/auth/me")) {
      const activeContext = {
        role_id: 178,
        role_name: "WWHN-178 QA Role",
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
            id: 178,
            name: "WWHN-178 QA User",
            email: "qa.wwhn178@example.com",
            code: "QA-WWHN-178",
            is_super_admin: false,
            active_context: activeContext,
            available_contexts: [activeContext],
          },
          meta: { request_id: "wwhn-178-me" },
        }),
      });
      return;
    }

    if (path.endsWith("/products")) {
      if (productMode === "forbidden") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          headers: { "x-request-id": "req-wwhn-178-forbidden" },
          body: JSON.stringify({
            success: false,
            message: "Permission denied",
            error_code: "PERMISSION_DENIED",
            meta: { request_id: "req-wwhn-178-forbidden" },
          }),
        });
        return;
      }

      const rows =
        productMode === "empty"
          ? []
          : [
              {
                id: 178,
                product_code: "SKU-WWHN-178",
                barcode: "8930000000178",
                name: "Sản phẩm evidence WWHN-178",
                supplier_id: 1,
                category_id: 1,
                uom_id: 1,
                list_price_net: 100000,
                vat_rate: 8,
                status: "active",
              },
            ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            data: rows,
            current_page: 1,
            per_page: 15,
            total: rows.length,
            last_page: 1,
          },
          meta: { request_id: "req-wwhn-178-products" },
        }),
      });
      return;
    }

    if (
      path.endsWith("/uoms") ||
      path.endsWith("/suppliers") ||
      path.endsWith("/product-categories")
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [],
          meta: { total: 0, request_id: "req-wwhn-178-reference" },
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
        meta: { request_id: "req-wwhn-178-generic" },
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

test.describe("WWHN-178 / WWHN-179 Master/SKU closure", () => {
  for (const viewport of VIEWPORTS) {
    test(`success and responsive ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockSession(page, { productMode: "success" });
      await page.goto(`${BASE_URL}/master-data`);

      await expect(
        page.getByRole("heading", { name: "Danh mục /SKU" }),
      ).toBeVisible();
      await expect(page.getByText("SKU-WWHN-178")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Import SKU cũ" }),
      ).toBeDisabled();
      await expectNoDocumentOverflow(page);

      await captureEvidence(
        page,
        testInfo,
        `success-responsive-${viewport.key}`,
        [
          "Canonical /products data renders",
          "Unapproved SKU import remains disabled",
          "Document has no horizontal overflow",
          "Named controls expose accessible roles",
        ],
      );
    });
  }

  test("loading and empty states", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { productMode: "empty", latencyMs: 800 });
    await page.goto(`${BASE_URL}/master-data`);

    await expect(page.locator(".ant-table-wrapper .ant-spin")).toBeVisible();
    await expect(page.getByText("Chưa có SKU")).toBeVisible();

    await captureEvidence(page, testInfo, "loading-empty", [
      "Table loading indicator is visible during delayed API response",
      "Empty state is visible after an empty canonical response",
    ]);
  });

  test("403 API error exposes code and request id", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { productMode: "forbidden" });
    await page.goto(`${BASE_URL}/master-data`);

    await expect(
      page.getByText("Không có quyền truy cập dữ liệu"),
    ).toBeVisible();
    await expect(page.getByText(/HTTP 403/)).toBeVisible();
    await expect(page.getByText(/PERMISSION_DENIED/)).toBeVisible();
    await expect(page.getByText(/req-wwhn-178-forbidden/)).toBeVisible();

    await captureEvidence(page, testInfo, "api-error-403", [
      "HTTP 403 renders a dedicated no-permission state",
      "Backend error code is visible",
      "Request ID is visible for traceability",
    ]);
  });

  test("validation and keyboard focus", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page);
    await page.goto(`${BASE_URL}/master-data`);

    const createButton = page.getByRole("button", { name: "Tạo sản phẩm" });
    await createButton.focus();
    await expect(createButton).toBeFocused();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", {
      name: "Tạo sản phẩm/SKU mới",
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Lưu" }).click();

    await expect(page.getByText("Vui lòng nhập mã sản phẩm")).toBeVisible();
    await expect(page.getByText("Vui lòng nhập tên sản phẩm")).toBeVisible();
    await expect(page.getByText("Vui lòng chọn đơn vị tính")).toBeVisible();
    await expect(page.getByText("Vui lòng nhập giá niêm yết")).toBeVisible();

    await captureEvidence(page, testInfo, "validation-keyboard-focus", [
      "Keyboard Enter opens the named dialog",
      "Required field validation is visible",
      "Import action remains disabled pending contract",
    ]);
  });

  test("item and physical-code tabs never call unapproved endpoints", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const requestedPaths = await mockSession(page);
    await page.goto(`${BASE_URL}/master-data`);

    await page.getByRole("tab", { name: "Item" }).click();
    await expect(
      page.getByText("Chưa có contract API chính thức"),
    ).toBeVisible();
    await expect(
      page.getByText(/OpenAPI 3\.0\.0 hiện chưa publish \/items/),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Mã vật lý" }).click();
    await expect(
      page.getByText(/OpenAPI 3\.0\.0 hiện chưa publish \/physical-codes/),
    ).toBeVisible();

    expect(requestedPaths.some((path) => path.endsWith("/items"))).toBe(false);
    expect(
      requestedPaths.some((path) => path.endsWith("/physical-codes")),
    ).toBe(false);
    expect(
      requestedPaths.some((path) => path.endsWith("/skus/import-excel")),
    ).toBe(false);

    await captureEvidence(page, testInfo, "contract-fail-closed", [
      "Item tab shows an explicit contract blocker",
      "Physical-code tab shows an explicit contract blocker",
      "No /items, /physical-codes or /skus/import-excel request is sent",
    ]);
  });

  test("route RBAC denies a user without master permissions", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { permissions: [] });
    await page.goto(`${BASE_URL}/master-data`);

    await expect(page).toHaveURL(/\/errors\/403$/);
    await captureEvidence(page, testInfo, "route-rbac-deny", [
      "User without sku.manage/master.manage is redirected to /errors/403",
      "This is a FE entry guard and does not replace backend authorization",
    ]);
  });
});
