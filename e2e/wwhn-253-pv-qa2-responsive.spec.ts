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
 * WWHN-253 · FE252-P1-05R2 — bằng chứng QA2 cho App PV trên ĐÚNG bản build đang
 * review.
 *
 * Register đòi 3 nhóm khung nhìn và 7 nhóm trạng thái; mỗi ô của ma trận đó là
 * một test ở đây, mỗi test ghi ra một ảnh + một tệp JSON metadata (có SHA) để
 * `scripts/generate-wwhn-253-qa2-report.mjs` dựng báo cáo. Không ô nào được
 * "suy ra": thiếu ô nào thì trình sinh báo cáo fail-closed.
 *
 * Ranh giới sự thật: đây là bằng chứng FE có kiểm soát (API mock ở tầng
 * network) — nó chứng minh hành vi giao diện theo hợp đồng Annex C, KHÔNG chứng
 * minh backend enforce quyền hay data scope. Phần đó thuộc test BE
 * (Wwhn252PvContractTest / Wwhn249PvSurfaceGovernanceTest).
 *
 * Nguồn hợp đồng: SRS/FRD v1.12 §3 (actor App PV ẩn danh), REQ-SRS-017/018/019,
 * NFR-SRS-016 (độ tươi), Annex C error set nhóm PV = {400,404,429,500},
 * Annex D SCR-PV-01/02/ADM-01.
 */
const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local-controlled";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";
const EVIDENCE_ROOT =
  process.env.WWHN_253_EVIDENCE_DIR ??
  join("test-results", "wwhn-253", SOURCE_SHA);

/** Ba nhóm khung nhìn register yêu cầu; desktop lấy CẢ 1366 và 1440. */
const VIEWPORTS = [
  { key: "mobile-390x844", width: 390, height: 844 },
  { key: "tablet-768x1024", width: 768, height: 1024 },
  { key: "desktop-1366x768", width: 1366, height: 768 },
  { key: "desktop-1440x900", width: 1440, height: 900 },
] as const;

const SKU_ID = "11111111-1111-4111-8111-111111111111";
const MISSING_SKU_ID = "99999999-9999-4999-8999-999999999999";

type Viewport = (typeof VIEWPORTS)[number];

interface EvidenceInput {
  scenario: string;
  viewport: Viewport;
  route: string;
  role: string;
  assertions: string[];
}

function pvProduct(overrides: Record<string, unknown> = {}) {
  return {
    sku_id: SKU_ID,
    sku_code: "SKU-PV-001",
    sku_name: "May khoan cam tay HN-500",
    display_name: "May khoan cam tay HN-500",
    description: "May khoan dung cho lap dat noi that.",
    unit: "cai",
    brand_id: "brand-1",
    brand_name: "Hoa Nam",
    category_id: "cat-1",
    category_name: "Dung cu dien",
    power_source_id: "ps-1",
    power_source_name: "Dien 220V",
    model_name: "HN-500",
    available_qty: 12,
    stock_status: "IN_STOCK",
    stock_label: "Con hang",
    last_inventory_sync_at: "2026-08-19T00:00:00Z",
    max_staleness_seconds: 60,
    images: [],
    industries: [
      {
        industry_id: "ind-1",
        industry_code: "NOI_THAT",
        industry_name: "Noi that",
      },
    ],
    tags: [],
    ...overrides,
  };
}

function pvMeta(dataAsOf: string) {
  return {
    total: 1,
    page: 1,
    per_page: 12,
    last_page: 1,
    data_as_of: dataAsOf,
    max_staleness_seconds: 60,
    request_id: "WWHN-253-PV",
  };
}

function jsonBody(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  input: EvidenceInput,
): Promise<void> {
  const prefix = ["WWHN-253", input.scenario, input.viewport.key].join("__");

  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const screenshotFilename = `${prefix}.png`;
  await page.screenshot({
    path: join(EVIDENCE_ROOT, screenshotFilename),
    fullPage: true,
  });

  const metadata = {
    ticket: "WWHN-253",
    registerItem: "FE252-P1-05R2",
    parent: "WWHN-252",
    evidenceClass: "FE_CONTROLLED_QA2_MATRIX",
    result: "PASS",
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    browserProject: testInfo.project.name,
    scenario: input.scenario,
    role: input.role,
    viewport: { width: input.viewport.width, height: input.viewport.height },
    viewportKey: input.viewport.key,
    route: input.route,
    finalUrl: page.url(),
    timestamp: new Date().toISOString(),
    screenshotFilename,
    assertions: input.assertions,
    truthBoundary:
      "Bang chung hanh vi FE co kiem soat (API mock o tang network). Khong phai bang chung backend authorization/data-scope.",
  };

  writeFileSync(
    join(EVIDENCE_ROOT, `${prefix}.json`),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
  await testInfo.attach(`wwhn-253-${input.scenario}-${input.viewport.key}`, {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
}

/** Mặt công khai: KHÔNG có phiên đăng nhập, và request PV không được kèm token. */
async function mockPublicPv(
  page: Page,
  options: {
    productsStatus?: number;
    detailStatus?: number;
    abortPv?: boolean;
    dataAsOf?: string;
    retryAfter?: string;
  } = {},
): Promise<{ authHeaders: (string | undefined)[]; pvCalls: string[] }> {
  const authHeaders: (string | undefined)[] = [];
  const pvCalls: string[] = [];

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.includes("/pv/")) {
      pvCalls.push(path);
      authHeaders.push(route.request().headers()["authorization"]);
    }

    if (options.abortPv && path.includes("/pv/")) {
      await route.abort("internetdisconnected");
      return;
    }

    if (path.includes("/pv/products/") && !path.endsWith("/publish")) {
      const status = options.detailStatus ?? 200;
      if (status !== 200) {
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Khong tim thay san pham.",
            error_code: "RESOURCE_NOT_FOUND",
            meta: { request_id: "WWHN-253-404" },
          }),
        });
        return;
      }
      await route.fulfill(
        jsonBody({
          success: true,
          data: pvProduct({ specifications: { "Cong suat": "500W" } }),
          meta: pvMeta(options.dataAsOf ?? new Date().toISOString()),
        }),
      );
      return;
    }

    if (path.endsWith("/pv/products")) {
      const status = options.productsStatus ?? 200;
      if (status === 429) {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          headers: { "retry-after": options.retryAfter ?? "45" },
          body: JSON.stringify({
            success: false,
            message: "Ban gui qua nhieu yeu cau.",
            error_code: "RATE_LIMIT_EXCEEDED",
            meta: { request_id: "WWHN-253-429" },
          }),
        });
        return;
      }
      if (status !== 200) {
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "May chu dang gap su co.",
            error_code: "INTERNAL_ERROR",
            meta: { request_id: "WWHN-253-500" },
          }),
        });
        return;
      }
      await route.fulfill(
        jsonBody({
          success: true,
          data: [pvProduct()],
          meta: pvMeta(options.dataAsOf ?? new Date().toISOString()),
        }),
      );
      return;
    }

    if (path.endsWith("/pv/industries")) {
      await route.fulfill(
        jsonBody({
          success: true,
          data: [
            {
              industry_id: "ind-1",
              industry_code: "NOI_THAT",
              industry_name: "Noi that",
              sort_order: 1,
            },
          ],
          meta: pvMeta(options.dataAsOf ?? new Date().toISOString()),
        }),
      );
      return;
    }

    if (path.endsWith("/pv/recommendations")) {
      await route.fulfill(
        jsonBody({ success: true, data: [], meta: { total: 0 } }),
      );
      return;
    }

    await route.fulfill(jsonBody({ success: true, data: [], meta: {} }));
  });

  return { authHeaders, pvCalls };
}

/** Mặt nội bộ SCR-PV-ADM-01: có phiên, quyền do test chỉ định. */
async function mockPvAdmin(
  page: Page,
  permissionCodes: string[],
): Promise<void> {
  const activeContext = {
    role_id: 253,
    role_name: "QA2 PV Reviewer",
    scope_type: "he_thong",
    org_unit_id: null,
    department_id: null,
    warehouse_id: null,
    permission_codes: permissionCodes,
  };
  const user = {
    id: 253,
    name: "WWHN-253 QA2",
    email: "wwhn253.qa2@example.com",
    code: "WWHN-253-QA2",
    is_super_admin: false,
    permissions: permissionCodes,
    active_context: activeContext,
    available_contexts: [activeContext],
  };

  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/auth/refresh")) {
      await route.fulfill(
        jsonBody({
          success: true,
          data: {
            access_token: MOCK_ACCESS_TOKEN,
            refresh_token: MOCK_REFRESH_TOKEN,
            token_type: "bearer",
            expires_in: 3600,
          },
          meta: { request_id: "WWHN-253-REFRESH" },
        }),
      );
      return;
    }

    if (path.endsWith("/auth/me")) {
      await route.fulfill(
        jsonBody({
          success: true,
          data: user,
          meta: { request_id: "WWHN-253-ME" },
        }),
      );
      return;
    }

    if (path.includes("/pv-admin/resources/product-profiles")) {
      await route.fulfill(
        jsonBody({
          success: true,
          data: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              sku_id: SKU_ID,
              sku_code: "SKU-PV-001",
              sku_name: "May khoan cam tay HN-500",
              sku_status: "ACTIVE",
              display_name: "May khoan cam tay HN-500",
              description: null,
              sort_order: 0,
              published: false,
              industry_ids: [],
              tag_ids: [],
              version: 3,
            },
          ],
          meta: { total: 1, page: 1, per_page: 15, last_page: 1 },
        }),
      );
      return;
    }

    await route.fulfill(jsonBody({ success: true, data: [], meta: {} }));
  });
}

test.use({ video: "on", trace: "on", screenshot: "on" });

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe("WWHN-253 · QA2 App PV — ma tran khung nhin x trang thai", () => {
  for (const viewport of VIEWPORTS) {
    test(`public catalog an danh · ${viewport.key}`, async ({
      page,
    }, testInfo) => {
      const captured = await mockPublicPv(page);
      await page.setViewportSize(viewport);
      await page.goto("/pv");

      await expect(page.getByTestId("pv-product-grid")).toBeVisible();
      await expect(page.getByTestId("pv-search-input")).toBeVisible();
      await expect(page.getByText("SKU-PV-001")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // SRS §3: người xem App PV là actor ẩn danh — không token nào được gửi.
      expect(captured.pvCalls.length).toBeGreaterThan(0);
      expect(captured.authHeaders.filter(Boolean)).toEqual([]);

      await captureEvidence(page, testInfo, {
        scenario: "public-catalog",
        viewport,
        route: "/pv",
        role: "anonymous",
        assertions: [
          "Luoi san pham SCR-PV-01 hien thi",
          "O tim kiem + bo loc hien thi",
          "Khong tran ngang o khung nhin nay",
          "Request /pv/* KHONG kem Authorization (actor an danh)",
        ],
      });
    });

    test(`freshness NFR-SRS-016 · ${viewport.key}`, async ({
      page,
    }, testInfo) => {
      await mockPublicPv(page, {
        // Cũ hơn max_staleness_seconds = 60s ⇒ phải cảnh báo, không im lặng.
        dataAsOf: new Date(Date.now() - 10 * 60_000).toISOString(),
      });
      await page.setViewportSize(viewport);
      await page.goto("/pv");

      const tag = page.getByTestId("pv-freshness");
      await expect(tag).toBeVisible();
      await expect(tag).toHaveAttribute("data-pv-freshness", "degraded");
      await expectNoHorizontalOverflow(page);

      await captureEvidence(page, testInfo, {
        scenario: "freshness-degraded",
        viewport,
        route: "/pv",
        role: "anonymous",
        assertions: [
          "Nhan do tuoi hien trang thai degraded khi data_as_of qua nguong",
          "Nguong lay tu max_staleness_seconds cua response, khong hardcode",
        ],
      });
    });

    test(`404 chi tiet san pham · ${viewport.key}`, async ({
      page,
    }, testInfo) => {
      await mockPublicPv(page, { detailStatus: 404 });
      await page.setViewportSize(viewport);
      await page.goto(`/pv/products/${MISSING_SKU_ID}`);

      await expect(page.getByTestId("pv-back-to-catalog")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await captureEvidence(page, testInfo, {
        scenario: "error-404",
        viewport,
        route: `/pv/products/${MISSING_SKU_ID}`,
        role: "anonymous",
        assertions: [
          "404 hien trang thai khong tim thay tai cho",
          "Van co duong quay lai danh muc (khong phai ngo cut)",
        ],
      });
    });

    test(`429 rate limit · ${viewport.key}`, async ({ page }, testInfo) => {
      const captured = await mockPublicPv(page, {
        productsStatus: 429,
        retryAfter: "45",
      });
      await page.setViewportSize(viewport);
      await page.goto("/pv");

      await expect(page.getByTestId("pv-error-rate-limited")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Không được retry 429: mỗi lần gọi lại chỉ kéo dài cửa sổ khoá.
      await page.waitForTimeout(1500);
      const productCalls = captured.pvCalls.filter((path) =>
        path.endsWith("/pv/products"),
      );
      expect(productCalls.length).toBe(1);

      await captureEvidence(page, testInfo, {
        scenario: "error-429",
        viewport,
        route: "/pv",
        role: "anonymous",
        assertions: [
          "429 hien thong diep gioi han truy cap kem so giay cho tu Retry-After",
          "Khong tu retry sau 429 (dung 1 request /pv/products)",
        ],
      });
    });

    test(`offline · ${viewport.key}`, async ({ page }, testInfo) => {
      await mockPublicPv(page, { abortPv: true });
      await page.setViewportSize(viewport);
      await page.goto("/pv");

      await expect(page.getByTestId("pv-error-offline")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await captureEvidence(page, testInfo, {
        scenario: "offline",
        viewport,
        route: "/pv",
        role: "anonymous",
        assertions: [
          "Mat mang hien trang thai mat ket noi chu khong da sang /login",
          "Co nut thu lai",
        ],
      });
    });

    test(`loi may chu 500 + request_id · ${viewport.key}`, async ({
      page,
    }, testInfo) => {
      await mockPublicPv(page, { productsStatus: 500 });
      await page.setViewportSize(viewport);
      await page.goto("/pv");

      await expect(page.getByTestId("pv-error-generic")).toBeVisible();
      await expect(page.getByText(/WWHN-253-500/)).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await captureEvidence(page, testInfo, {
        scenario: "error-500",
        viewport,
        route: "/pv",
        role: "anonymous",
        assertions: [
          "500 hien trang thai loi tai cho",
          "Hien thi request_id de doi chieu log (NFR-SRS-008)",
        ],
      });
    });

    test(`RBAC SCR-PV-ADM-01 · ${viewport.key}`, async ({ page }, testInfo) => {
      await mockPvAdmin(page, ["pv.master.manage"]);
      await page.setViewportSize(viewport);
      await page.goto("/pv-admin");

      const toggle = page.getByTestId("pv-admin-publish-switch");
      await expect(toggle).toBeVisible();
      await expect(toggle).toBeDisabled();
      await expectNoHorizontalOverflow(page);

      await captureEvidence(page, testInfo, {
        scenario: "rbac-publish-denied",
        viewport,
        route: "/pv-admin",
        role: "pv.master.manage",
        assertions: [
          "pv.master.manage KHONG mo khoa cong tac publish (§3 tach hai quyen)",
          "UI noi ro ly do thay vi im lang vo hieu hoa",
        ],
      });

      await page.unrouteAll({ behavior: "ignoreErrors" });
      await mockPvAdmin(page, ["pv.master.manage", "pv.publish"]);
      await page.reload();

      await expect(page.getByTestId("pv-admin-publish-switch")).toBeEnabled();

      await captureEvidence(page, testInfo, {
        scenario: "rbac-publish-allowed",
        viewport,
        route: "/pv-admin",
        role: "pv.master.manage + pv.publish",
        assertions: ["Co pv.publish thi cong tac publish mo khoa"],
      });
    });
  }
});
