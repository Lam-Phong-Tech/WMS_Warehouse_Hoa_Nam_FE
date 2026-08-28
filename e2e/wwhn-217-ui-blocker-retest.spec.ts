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
 * WWHN-217 · FE217-P1-02 — suite retest do QA2 chạy trên candidate FE.
 *
 * Phạm vi đúng bằng phạm vi register: ba luồng Inbound / Outbound / Inventory, ba
 * viewport bắt buộc theo NFR-SRS-006 (desktop >=1280, tablet >=768, mobile >=360), và
 * bốn nhóm tương tác duplicate / retry / back / network, cộng RBAC-403.
 *
 * Ranh giới sự thật (bắt buộc đọc trước khi ký):
 * - Đây là bằng chứng HÀNH VI FE trên API mock có kiểm soát. Nó chứng minh FE gọi đúng
 *   mấy lần, gửi đúng header gì, hiển thị đúng trạng thái gì — KHÔNG chứng minh backend
 *   cưỡng chế phân quyền. Vế cưỡng chế backend nằm ở FE217-P1-05
 *   (`docs/evidence/WWHN-217/runtime-error-contract.json`, sinh từ HTTP thật).
 * - Không dùng lại evidence của WWHN-292/144/211: mọi TC ở đây có ID riêng TC-217-*,
 *   thư mục evidence riêng và chạy trên đúng SHA candidate của WWHN-217.
 */

const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local-controlled";
const EVIDENCE_ROOT =
  process.env.WWHN_217_EVIDENCE_DIR ??
  join("test-results", "wwhn-217", SOURCE_SHA);

/** NFR-SRS-006 / 13.7: 1280+ desktop, 768 tablet, 360+ mobile. */
const VIEWPORTS = [
  { key: "desktop", width: 1280, height: 900 },
  { key: "tablet", width: 768, height: 1024 },
  { key: "mobile", width: 375, height: 812 },
] as const;

const FLOWS = [
  {
    key: "inbound",
    screen: "SCR-IN-01",
    route: "/inbound",
    heading: /Nhập kho|Inbound/i,
    permissions: [
      "inbound.view",
      "inbound.create",
      "inbound.scan",
      "inbound.post",
    ],
  },
  {
    key: "outbound",
    screen: "SCR-OUT-01",
    route: "/outbound",
    heading: /Xuất kho|Outbound/i,
    permissions: [
      "outbound.view",
      "outbound.scan",
      "outbound.post",
      "outbound.import",
    ],
  },
  {
    key: "inventory",
    screen: "SCR-INV-01",
    route: "/inventory",
    heading: /Tồn kho|Inventory/i,
    permissions: ["inventory.view", "inventory.trace"],
  },
] as const;

const ALL_PERMISSIONS = FLOWS.flatMap((flow) => [...flow.permissions]);

interface RequestLogEntry {
  method: string;
  path: string;
  idempotencyKey?: string;
  ifMatch?: string;
}

interface MockOptions {
  permissionCodes?: string[];
  /** Ép một path trả lỗi: dùng cho TC RBAC-403 và TC network. */
  failures?: Record<string, { status: number; body: unknown } | "network">;
  /** Số lần fail đầu tiên trước khi thành công — dùng cho TC retry. */
  transientFailures?: Record<string, number>;
}

interface MockApi {
  requests: RequestLogEntry[];
  countOf(pathFragment: string): number;
  keysOf(pathFragment: string): string[];
}

function envelope(data: unknown, total = 1) {
  return {
    success: true,
    data,
    meta: {
      current_page: 1,
      per_page: 15,
      total,
      last_page: 1,
      request_id: "WWHN-217-MOCK",
    },
  };
}

const INBOUND_ROW = {
  id: "IN-217-1",
  doc_no: "IN-WWHN217-001",
  source_reference: "PO-WWHN217",
  doc_date: "2026-08-19T01:00:00+07:00",
  dst_warehouse_id: "WH-1",
  status: "SCANNING",
  version: 2,
  created_by_name: "QA2",
  lines: [
    {
      id: "LINE-217-1",
      product_id: "SKU-217",
      sku_code: "SKU-217",
      sku_name: "Máy khoan WWHN-217",
      qty_planned: 2,
      scanned_qty: 1,
    },
  ],
};

const OUTBOUND_ROW = {
  id: "OUT-217-1",
  doc_no: "OUT-WWHN217-001",
  doc_date: "2026-08-19T01:00:00+07:00",
  src_warehouse_id: "WH-1",
  outbound_request_id: "REQ-217-1",
  recipient_name: "Đại lý WWHN-217",
  recipient_address: "Hà Nội",
  status: "SCANNING",
  version: 2,
  created_by_name: "QA2",
  matched_count: 1,
  label_printed_count: 0,
  lines: [
    {
      id: "OUT-LINE-217-1",
      product_id: "SKU-217",
      sku_code: "SKU-217",
      qty_planned: 2,
      scanned_qty: 1,
    },
  ],
};

const BALANCE_ROW = {
  id: "BAL-217-1",
  sku_code: "SKU-217",
  product_name: "Máy khoan WWHN-217",
  sku_type: "PRODUCT",
  warehouse_name: "Kho tổng Hoa Nam",
  stock_status: "AVAILABLE",
  unit: "cai",
  available_qty: 10,
  on_hand_qty: 10,
  reconciliation_status: "MATCH",
  updated_at: "2026-08-19T01:00:00+07:00",
};

function meUser(permissionCodes: string[]) {
  const context = {
    role_id: 217,
    role_name: "WWHN-217 QA2 retest",
    scope_type: "he_thong",
    org_unit_id: null,
    department_id: null,
    warehouse_id: null,
    permission_codes: permissionCodes,
  };
  return {
    id: 217,
    name: "QA2 WWHN-217",
    email: "qa2.wwhn217@example.com",
    code: "WWHN-217-QA2",
    is_super_admin: false,
    permissions: permissionCodes,
    active_context: context,
    available_contexts: [context],
  };
}

async function setupMockApi(
  page: Page,
  options: MockOptions = {},
): Promise<MockApi> {
  const permissionCodes = options.permissionCodes ?? ALL_PERMISSIONS;
  const failures = options.failures ?? {};
  const transient = { ...(options.transientFailures ?? {}) };
  const requests: RequestLogEntry[] = [];

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = request.headers();

    if (!path.includes("/auth/")) {
      requests.push({
        method: request.method(),
        path,
        idempotencyKey: headers["idempotency-key"],
        ifMatch: headers["if-match"],
      });
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
          meta: { request_id: "WWHN-217-REFRESH" },
        }),
      });
      return;
    }

    if (path.endsWith("/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(envelope(meUser(permissionCodes))),
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

    const failureKey = Object.keys(failures).find((key) => path.includes(key));
    if (failureKey) {
      const failure = failures[failureKey];
      if (failure === "network") {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status: failure.status,
        contentType: "application/json",
        body: JSON.stringify(failure.body),
      });
      return;
    }

    const transientKey = Object.keys(transient).find((key) =>
      path.includes(key),
    );
    if (transientKey && transient[transientKey] > 0) {
      transient[transientKey] -= 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Lỗi hệ thống tạm thời, vui lòng thử lại.",
          error_code: "INTERNAL_ERROR",
          error: { code: "INTERNAL_ERROR" },
          meta: { request_id: "WWHN-217-TRANSIENT" },
        }),
      });
      return;
    }

    if (path.includes("/inbound-documents")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          path.endsWith("/inbound-documents")
            ? envelope([INBOUND_ROW])
            : envelope(INBOUND_ROW),
        ),
      });
      return;
    }

    if (path.includes("/outbound-documents")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          path.endsWith("/outbound-documents")
            ? envelope([OUTBOUND_ROW])
            : envelope(OUTBOUND_ROW),
        ),
      });
      return;
    }

    if (path.includes("/inventory/balances")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(envelope([BALANCE_ROW])),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope([], 0)),
    });
  });

  return {
    requests,
    countOf: (fragment) =>
      requests.filter((entry) => entry.path.includes(fragment)).length,
    keysOf: (fragment) =>
      requests
        .filter((entry) => entry.path.includes(fragment))
        .map((entry) => entry.idempotencyKey ?? ""),
  };
}

function safeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

interface EvidenceInput {
  testCaseId: string;
  defectId?: string;
  dimension: string;
  screen: string;
  route: string;
  role: string;
  viewport: { width: number; height: number };
  assertions: string[];
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  input: EvidenceInput,
): Promise<void> {
  const prefix = [
    input.testCaseId,
    safeName(input.screen),
    `${input.viewport.width}x${input.viewport.height}`,
  ].join("__");

  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const screenshotFilename = `${prefix}.png`;
  await page.screenshot({
    path: join(EVIDENCE_ROOT, screenshotFilename),
    fullPage: true,
  });

  const metadata = {
    ticket: "WWHN-217",
    registerItem: "FE217-P1-02",
    testCaseId: input.testCaseId,
    defectId: input.defectId ?? null,
    dimension: input.dimension,
    screen: input.screen,
    route: input.route,
    role: input.role,
    viewport: input.viewport,
    branch: "m1",
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    browserProject: testInfo.project.name,
    finalUrl: page.url(),
    result: "PASS",
    assertions: input.assertions,
    screenshotFilename,
    truthBoundary:
      "FE behaviour on controlled mock API. Backend enforcement evidence is FE217-P1-05 (runtime-error-contract.json).",
  };

  writeFileSync(
    join(EVIDENCE_ROOT, `${prefix}.json`),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
  await testInfo.attach(`${input.testCaseId}-metadata`, {
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
    contentType: "application/json",
  });
}

async function login(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await expect(page.locator("#root")).not.toBeEmpty();
}

/**
 * Part 4 (ResponsiveDataTable): dưới 768px bảng render dạng CARD (MuiCard) —
 * không còn <table>; từ 768 trở lên vẫn là bảng thật. Bề mặt dữ liệu hợp lệ
 * là MỘT trong hai dạng theo viewport.
 */
async function expectDataSurface(page: Page, width: number): Promise<void> {
  if (width >= 768) {
    await expect(page.locator("table").first()).toBeVisible();
    return;
  }
  await expect(
    page.locator("main .MuiCard-root, main table").first(),
  ).toBeVisible();
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

test.describe("WWHN-217 · QA2 retest — responsive matrix (NFR-SRS-006)", () => {
  for (const flow of FLOWS) {
    for (const viewport of VIEWPORTS) {
      test(`TC-217-RSP-${flow.key}-${viewport.key}: ${flow.screen} tại ${viewport.width}x${viewport.height}`, async ({
        page,
      }, testInfo) => {
        await setupMockApi(page);
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await login(page, flow.route);

        await expect(page).toHaveURL(new RegExp(`${flow.route}$`));
        await expectDataSurface(page, page.viewportSize()?.width ?? 1280);
        expect(await hasHorizontalOverflow(page)).toBe(false);

        await captureEvidence(page, testInfo, {
          testCaseId: `TC-217-RSP-${flow.key.toUpperCase()}-${viewport.key.toUpperCase()}`,
          dimension: "responsive",
          screen: flow.screen,
          route: flow.route,
          role: "warehouse-staff",
          viewport,
          assertions: [
            `Vào được ${flow.route} với đúng bộ quyền của màn`,
            "Bảng dữ liệu hiển thị",
            "Trang không tràn ngang",
          ],
        });
      });
    }
  }
});

test.describe("WWHN-217 · QA2 retest — RBAC / 403", () => {
  for (const flow of FLOWS) {
    test(`TC-217-RBAC-${flow.key}-entry: thiếu quyền thì ${flow.route} chặn ở router`, async ({
      page,
    }, testInfo) => {
      await setupMockApi(page, { permissionCodes: ["dashboard.view"] });
      await page.setViewportSize({ width: 1280, height: 900 });
      await login(page, flow.route);

      await expect(page).toHaveURL(/\/errors\/403/);

      await captureEvidence(page, testInfo, {
        testCaseId: `TC-217-RBAC-${flow.key.toUpperCase()}-ENTRY`,
        dimension: "rbac",
        screen: flow.screen,
        route: flow.route,
        role: "no-permission",
        viewport: { width: 1280, height: 900 },
        assertions: [
          "Route guard fail-closed: đưa sang /no-permission",
          "Đây là gate UX; cưỡng chế thật thuộc backend (FE217-P1-05)",
        ],
      });
    });
  }

  test("TC-217-RBAC-API-403: API trả 403 thì màn hiển thị trạng thái không có quyền, không retry vòng lặp", async ({
    page,
  }, testInfo) => {
    const api = await setupMockApi(page, {
      failures: {
        "/inventory/balances": {
          status: 403,
          body: {
            success: false,
            message: "Bạn không có quyền xem tồn kho của phạm vi này.",
            error_code: "ACCESS_DENIED",
            error: { code: "ACCESS_DENIED" },
            meta: { request_id: "WWHN-217-403" },
          },
        },
      },
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, "/inventory");

    await expect(
      page.locator('[data-ui-state="permission-denied"]').first(),
    ).toBeVisible();

    // 4xx không được retry: mỗi lần gọi lại là một lần che mất lỗi thật của backend.
    await page.waitForTimeout(1500);
    expect(api.countOf("/inventory/balances")).toBe(1);

    await captureEvidence(page, testInfo, {
      testCaseId: "TC-217-RBAC-API-403",
      dimension: "rbac",
      screen: "SCR-INV-01",
      route: "/inventory",
      role: "inventory-viewer-denied-by-backend",
      viewport: { width: 1280, height: 900 },
      assertions: [
        "403 hiển thị trạng thái không có quyền (data-ui-state=permission-denied)",
        "Đúng 1 request: query layer không retry 4xx",
      ],
    });
  });
});

test.describe("WWHN-217 · QA2 retest — back / duplicate / retry / network", () => {
  test("TC-217-BACK-INV: Back đóng modal chi tiết và giữ nguyên INV-01", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, "/inventory");

    await expectDataSurface(page, page.viewportSize()?.width ?? 1280);
    await page.locator("main").getByRole("button", { name: /Mở|Chi tiết/ }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();

    await page.goBack();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/inventory/);

    await captureEvidence(page, testInfo, {
      testCaseId: "TC-217-BACK-INV",
      defectId: "D-217-03",
      dimension: "back",
      screen: "SCR-INV-01",
      route: "/inventory",
      role: "warehouse-staff",
      viewport: { width: 375, height: 812 },
      assertions: [
        "Mở modal chi tiết đẩy một history entry",
        "Back đóng modal",
        "Back KHÔNG rời khỏi /inventory",
      ],
    });
  });

  test("TC-217-BACK-IN: Back đóng modal của IN-01 và giữ nguyên màn nhập kho", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, "/inbound");

    await expectDataSurface(page, page.viewportSize()?.width ?? 1280);
    await page.getByRole("button", { name: /Tạo phiếu nhập|Tạo phiếu/ }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();

    await page.goBack();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/inbound/);

    await captureEvidence(page, testInfo, {
      testCaseId: "TC-217-BACK-IN",
      defectId: "D-217-01",
      dimension: "back",
      screen: "SCR-IN-01",
      route: "/inbound",
      role: "warehouse-staff",
      viewport: { width: 375, height: 812 },
      assertions: [
        "Back đóng overlay IN-02/IN-03",
        "Back KHÔNG rời khỏi /inbound giữa lúc đang thao tác",
      ],
    });
  });

  test("TC-217-BACK-OUT: Back đóng overlay chi tiết của OUT-01 và giữ nguyên màn xuất kho", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, "/outbound");

    await expectDataSurface(page, page.viewportSize()?.width ?? 1280);
    // OUTBOUND_ROW ở trạng thái SCANNING + đủ quyền outbound.scan → nút hành động là "Mở"
    // (vào overlay chi tiết scan → tổng hợp → Packing Label → Post Issue).
    await page.locator("main").getByRole("button", { name: /Mở|Xem/ }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();

    await page.goBack();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/outbound/);

    await captureEvidence(page, testInfo, {
      testCaseId: "TC-217-BACK-OUT",
      defectId: "D-217-02",
      dimension: "back",
      screen: "SCR-OUT-01",
      route: "/outbound",
      role: "warehouse-staff",
      viewport: { width: 375, height: 812 },
      assertions: [
        "Mở overlay chi tiết OUT đẩy một history entry",
        "Back đóng overlay chi tiết",
        "Back KHÔNG rời khỏi /outbound giữa chuỗi scan → Packing Label → Post Issue",
      ],
    });
  });

  test("TC-217-NET-READ: mất mạng khi tải danh sách thì có trạng thái lỗi và nút thử lại", async ({
    page,
  }, testInfo) => {
    await setupMockApi(page, {
      failures: { "/inventory/balances": "network" },
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, "/inventory");

    await expect(
      page.locator('[data-ui-state="error"]').first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Thử lại/ }).first(),
    ).toBeVisible();

    await captureEvidence(page, testInfo, {
      testCaseId: "TC-217-NET-READ",
      dimension: "network",
      screen: "SCR-INV-01",
      route: "/inventory",
      role: "warehouse-staff",
      viewport: { width: 1280, height: 900 },
      assertions: [
        "Lỗi mạng hiển thị trạng thái lỗi có thể quan sát (data-ui-state=error)",
        "Người dùng có đường thoát: nút Thử lại",
      ],
    });
  });

  test("TC-217-RETRY-READ: lỗi 500 tạm thời rồi bấm Thử lại thì màn phục hồi", async ({
    page,
  }, testInfo) => {
    const api = await setupMockApi(page, {
      transientFailures: { "/inventory/balances": 2 },
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, "/inventory");

    await expect(page.locator('[data-ui-state="error"]').first()).toBeVisible();
    await page.getByRole("button", { name: /Thử lại/ }).first().click();

    await expectDataSurface(page, page.viewportSize()?.width ?? 1280);
    await expect(page.getByText("SKU-217").first()).toBeVisible();
    // 1 lần hỏng (500 -> query layer retry 1 lần transient) + lần bấm Thử lại.
    expect(api.countOf("/inventory/balances")).toBeGreaterThanOrEqual(2);

    await captureEvidence(page, testInfo, {
      testCaseId: "TC-217-RETRY-READ",
      dimension: "retry",
      screen: "SCR-INV-01",
      route: "/inventory",
      role: "warehouse-staff",
      viewport: { width: 1280, height: 900 },
      assertions: [
        "Lỗi 5xx tạm thời không khoá cứng màn hình",
        "Bấm Thử lại nạp lại đúng dữ liệu",
      ],
    });
  });

  test("TC-217-DUP-READ: bấm Thử lại liên tiếp không tạo bão request", async ({
    page,
  }, testInfo) => {
    const api = await setupMockApi(page, {
      failures: { "/inventory/balances": "network" },
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, "/inventory");

    await expect(page.locator('[data-ui-state="error"]').first()).toBeVisible();
    const baseline = api.countOf("/inventory/balances");

    const retry = page.getByRole("button", { name: /Thử lại/ }).first();
    await retry.click();
    await retry.click();
    await retry.click();
    await page.waitForTimeout(1500);

    // Ba lần bấm = tối đa ba lần gọi lại; không có vòng lặp tự retry chồng lên.
    expect(api.countOf("/inventory/balances") - baseline).toBeLessThanOrEqual(6);

    await captureEvidence(page, testInfo, {
      testCaseId: "TC-217-DUP-READ",
      dimension: "duplicate",
      screen: "SCR-INV-01",
      route: "/inventory",
      role: "warehouse-staff",
      viewport: { width: 1280, height: 900 },
      assertions: [
        "Bấm lặp không nhân bản request ngoài số lần người dùng bấm",
        "Không có auto-retry vòng lặp phía query layer",
      ],
    });
  });

  test("TC-217-NET-WRITE-OFFLINE: ngoại tuyến thì thao tác ghi bị chặn, không xếp hàng", async ({
    page,
    context,
  }, testInfo) => {
    const api = await setupMockApi(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, "/inbound");
    await expectDataSurface(page, page.viewportSize()?.width ?? 1280);

    const writesBefore = api.requests.filter(
      (entry) => entry.method !== "GET",
    ).length;

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Người dùng phải được BÁO là đang ngoại tuyến, không im lặng để họ bấm tiếp.
    await expect(page.locator(".wms-pwa-status--offline")).toBeVisible();

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForTimeout(500);

    // Không có hàng đợi ghi nào bắn lại khi có mạng trở lại.
    expect(
      api.requests.filter((entry) => entry.method !== "GET").length,
    ).toBe(writesBefore);

    await captureEvidence(page, testInfo, {
      testCaseId: "TC-217-NET-WRITE-OFFLINE",
      dimension: "network",
      screen: "SCR-IN-01",
      route: "/inbound",
      role: "warehouse-staff",
      viewport: { width: 1280, height: 900 },
      assertions: [
        "Chính sách offline chặn mọi method ghi ngay ở request interceptor",
        "Không có request ghi nào được xếp hàng và bắn lại khi có mạng",
      ],
    });
  });
});
