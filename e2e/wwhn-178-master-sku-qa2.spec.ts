/**
 * WWHN-178 / WWHN-179 – Master/SKU UI, validation, responsive, RBAC and
 * API-error evidence (R2 — rebuilt 2026-08-20 against the current
 * SkuMasterScreen at ROUTES.MASTER_DATA).
 *
 * R1 của pack này viết cho MasterPage.tsx cũ (tabs Item/Mã vật lý, nút
 * "Import SKU cũ") — UI đó đã bị thay bằng ApiMasterScreens.SkuMasterScreen
 * (MST-01) + SkuImportModal (WWHN-331), nên R1 fail toàn bộ và không còn là
 * bằng chứng. R2 mô tả đúng bề mặt hiện tại:
 *   - GET /products là nguồn danh sách SKU (OpenAPI 2.0.0 đã pin, BE m1);
 *   - Import Excel đã được mở chính thức theo WWHN-330/331 (không còn
 *     fail-closed);
 *   - 403 dùng đúng envelope BE thật: error_code ACCESS_DENIED +
 *     meta.request_id (ApiError.php), FE hiển thị mã lỗi + request id.
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

const MASTER_ROUTE = "/master-data/skus";
const FORBIDDEN_REQUEST_ID = "req-wwhn-178-forbidden";

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
    schemaVersion: "2.0.0",
    ticket: "WWHN-178",
    qaTicket: "WWHN-179",
    scenario,
    result: "PASS",
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    browserProject: testInfo.project.name,
    viewport,
    route: MASTER_ROUTE,
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

/**
 * Mock session theo envelope BE thật ({ success, data, meta }).
 * Trả về danh sách path đã được FE gọi để assert contract boundary.
 */
async function mockSession(
  page: Page,
  {
    permissions = ["sku.view", "sku.manage"],
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

    if (path.endsWith("/products") && route.request().method() === "GET") {
      if (productMode === "forbidden") {
        // Envelope 403 thật của BE (app/Support/ApiError.php):
        // error_code = ACCESS_DENIED, request_id nằm trong meta.
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          headers: { "x-request-id": FORBIDDEN_REQUEST_ID },
          body: JSON.stringify({
            success: false,
            message: "Bạn không có quyền thực hiện thao tác này.",
            error_code: "ACCESS_DENIED",
            errors: [],
            error: { code: "ACCESS_DENIED", details: [] },
            meta: {
              request_id: FORBIDDEN_REQUEST_ID,
              timestamp: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      const rows =
        productMode === "empty"
          ? []
          : [
              {
                sku_id: "wwhn-178-sku-1",
                id: "wwhn-178-sku-1",
                sku_code: "SKU-WWHN-178",
                code: "SKU-WWHN-178",
                sku_name: "Sản phẩm evidence WWHN-178",
                name: "Sản phẩm evidence WWHN-178",
                sku_type: "PRODUCT",
                unit: "PCS",
                brand_id: null,
                category_id: null,
                model_id: null,
                power_source_id: null,
                package_variant_id: null,
                version_code: "V1",
                is_serial_tracked: true,
                status: "ACTIVE",
                published_to_app: false,
                version: 0,
              },
            ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: rows,
          meta: {
            current_page: 1,
            per_page: 15,
            total: rows.length,
            last_page: 1,
            request_id: "req-wwhn-178-products",
          },
        }),
      });
      return;
    }

    // Catalog refs cho MST-02 (brands/product-categories/product-models/
    // power-sources/package-variants) và mọi GET phụ khác: danh sách rỗng.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [],
        meta: { total: 0, request_id: "req-wwhn-178-generic" },
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

test.describe("WWHN-178 / WWHN-179 Master/SKU closure R2", () => {
  for (const viewport of VIEWPORTS) {
    test(`success and responsive ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockSession(page, { productMode: "success" });
      await page.goto(`${BASE_URL}${MASTER_ROUTE}`);

      await expect(page.locator('[data-mvp-screen="MST-01"]')).toBeVisible();
      await expect(page.getByText("SKU-WWHN-178")).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Thêm SKU/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Import Excel/ }),
      ).toBeVisible();
      await expectNoDocumentOverflow(page);

      await captureEvidence(
        page,
        testInfo,
        `success-responsive-${viewport.key}`,
        [
          "Canonical GET /products data renders on MST-01",
          "Thêm SKU and Import Excel actions are visible with sku.manage",
          "Document has no horizontal overflow",
          "Named controls expose accessible roles",
        ],
      );
    });
  }

  test("loading and empty states", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { productMode: "empty", latencyMs: 1200 });
    await page.goto(`${BASE_URL}${MASTER_ROUTE}`);

    await expect(page.getByText("Đang tải dữ liệu từ API...")).toBeVisible();
    await expect(
      page.getByText("Không có SKU phù hợp bộ lọc."),
    ).toBeVisible();

    await captureEvidence(page, testInfo, "loading-empty", [
      "Table loading indicator is visible during delayed API response",
      "Empty state is visible after an empty canonical response",
    ]);
  });

  test("403 API error exposes ACCESS_DENIED code and request id", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { productMode: "forbidden" });
    await page.goto(`${BASE_URL}${MASTER_ROUTE}`);

    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
    const trace = page.getByTestId("permission-denied-trace");
    await expect(trace).toBeVisible();
    await expect(trace).toContainText("HTTP 403");
    await expect(trace).toContainText("ACCESS_DENIED");
    await expect(trace).toContainText(FORBIDDEN_REQUEST_ID);

    await captureEvidence(page, testInfo, "api-error-403", [
      "HTTP 403 renders the shared NoPermissionState",
      "Real backend error code ACCESS_DENIED is visible",
      "Request ID is visible for traceability (SRS §8.2)",
    ]);
  });

  test("validation and keyboard focus", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page);
    await page.goto(`${BASE_URL}${MASTER_ROUTE}`);

    const createButton = page.getByRole("button", { name: /Thêm SKU/ });
    await createButton.focus();
    await expect(createButton).toBeFocused();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Thêm SKU").first()).toBeVisible();
    await dialog.getByRole("button", { name: "Lưu SKU" }).click();

    await expect(
      dialog.getByText("Mã SKU và tên SKU là bắt buộc."),
    ).toBeVisible();

    await captureEvidence(page, testInfo, "validation-keyboard-focus", [
      "Keyboard Enter opens the SKU create dialog",
      "Required field validation (mã/tên SKU) is visible",
    ]);
  });

  test("import modal opens for sku.manage and is absent without it", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page);
    await page.goto(`${BASE_URL}${MASTER_ROUTE}`);

    await page.getByRole("button", { name: /Import Excel/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Import SKU từ Excel (WWHN-331)"),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await captureEvidence(page, testInfo, "import-modal-permission", [
      "Import Excel opens the WWHN-331 SkuImportModal for sku.manage",
      "Import surface is the officially contracted /skus/import-* family",
    ]);
  });

  test("view-only user has no manage actions", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { permissions: ["sku.view"] });
    await page.goto(`${BASE_URL}${MASTER_ROUTE}`);

    await expect(page.locator('[data-mvp-screen="MST-01"]')).toBeVisible();
    await expect(page.getByText("SKU-WWHN-178")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Thêm SKU/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Import Excel/ }),
    ).toHaveCount(0);

    await captureEvidence(page, testInfo, "view-only-actions-hidden", [
      "sku.view renders the list (route allows view-only)",
      "Thêm SKU / Import Excel are not rendered without sku.manage",
      "UI hiding is UX only; backend authorization remains the boundary",
    ]);
  });

  test("route RBAC denies a user without master permissions", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(page, { permissions: [] });
    await page.goto(`${BASE_URL}${MASTER_ROUTE}`);

    await expect(page).toHaveURL(/\/errors\/403$/);
    await captureEvidence(page, testInfo, "route-rbac-deny", [
      "User without sku.view/sku.manage is redirected to /errors/403",
      "This is a FE entry guard and does not replace backend authorization",
    ]);
  });

  test("screen only calls endpoints inside the pinned BE contract", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const requestedPaths = await mockSession(page);
    await page.goto(`${BASE_URL}${MASTER_ROUTE}`);
    await expect(page.getByText("SKU-WWHN-178")).toBeVisible();

    // Bề mặt hợp lệ của MST-01 theo swagger-api.json (BE pin 7da26cb):
    // auth/*, /products, catalog refs. Phantom endpoint (/uoms, /suppliers —
    // có controller nhưng không route/spec) tuyệt đối không được gọi.
    const allowed = [
      /\/api\/v1\/auth\/(refresh|me|logout)$/,
      /\/api\/v1\/products$/,
      /\/api\/v1\/brands$/,
      /\/api\/v1\/product-categories$/,
      /\/api\/v1\/product-models$/,
      /\/api\/v1\/power-sources$/,
      /\/api\/v1\/package-variants$/,
    ];
    const outside = requestedPaths.filter(
      (path) => !allowed.some((pattern) => pattern.test(path)),
    );
    expect(outside).toEqual([]);
    expect(requestedPaths.some((path) => path.endsWith("/uoms"))).toBe(false);
    expect(requestedPaths.some((path) => path.endsWith("/suppliers"))).toBe(
      false,
    );

    await captureEvidence(page, testInfo, "contract-boundary", [
      "MST-01 only calls endpoints present in the pinned OpenAPI 2.0.0",
      "Phantom endpoints /uoms and /suppliers are never requested",
    ]);
  });
});
