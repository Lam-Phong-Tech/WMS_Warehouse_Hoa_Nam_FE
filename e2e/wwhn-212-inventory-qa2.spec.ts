import { expect, test, type Page, type Route } from "@playwright/test";
import {
  MOCK_ACCESS_TOKEN as ACCESS_TOKEN,
  MOCK_REFRESH_TOKEN,
} from "./support/mock-tokens";

test.use({ video: "on", trace: "on", screenshot: "on" });

type ApiOptions = {
  balance403Once?: boolean;
  balance401?: boolean;
};

type ApiHarness = {
  inventoryUrls: string[];
  balanceCalls: () => number;
  refreshCalls: () => number;
  meCalls: () => number;
};

const balance = {
  id: "bal-211",
  warehouse_id: "wh-a",
  sku_code: "SKU-211",
  product_name: "Sản phẩm WWHN-211",
  product_type: "PRODUCT",
  warehouse_name: "Kho A",
  stock_status: "normal",
  available_qty: 8,
  on_hand_qty: 10,
  reserved_qty: 2,
  item_subledger_count: 1,
  container_subledger_count: 1,
  reconciliation_status: "MATCH",
  updated_at: "2026-08-16T03:00:00Z",
};

const movement = {
  id: "mv-211",
  movement_no: "MV-211",
  occurred_at: "2026-08-16T03:00:00Z",
  movement_type: "RECEIPT",
  warehouse_id: "wh-a",
  warehouse_name: "Kho A",
  sku_code: "SKU-211",
  qty_delta: 10,
  document_code: "IN-211",
  document_type: "INBOUND",
  status: "POSTED",
};

async function installApi(
  page: Page,
  permissions: string[],
  options: ApiOptions = {},
): Promise<ApiHarness> {
  const inventoryUrls: string[] = [];
  let balanceCalls = 0;
  let refreshCalls = 0;
  let meCalls = 0;

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const rawUrl = request.url();
    const url = new URL(rawUrl);
    const path = url.pathname.replace(/^\/api\/v1\/?/, "/");

    // Keep auth bootstrap byte-for-byte compatible with the already passing
    // wms-runtime-evidence.spec.ts contract. WWHN-212 tests inventory behavior,
    // not a second bespoke authentication protocol.
    if (rawUrl.endsWith("/auth/refresh")) {
      refreshCalls += 1;
      if (options.balance401 && refreshCalls > 1) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Phiên đăng nhập đã hết hạn",
            error_code: "UNAUTHENTICATED",
            errors: [],
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
            access_token: ACCESS_TOKEN,
            refresh_token: MOCK_REFRESH_TOKEN,
            token_type: "bearer",
            expires_in: 3600,
          },
          meta: { request_id: "WWHN-212-REFRESH-200" },
        }),
      });
      return;
    }

    if (rawUrl.endsWith("/auth/me")) {
      meCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 212,
            name: "WWHN-212 QA User",
            email: "wwhn212.qa@gmail.com",
            code: "WWHN-212-QA",
            is_super_admin: false,
            permissions,
            active_context: {
              role_id: 212,
              role_name: "QA limited role",
              scope_type: "he_thong",
              org_unit_id: null,
              department_id: null,
              warehouse_id: null,
              permission_codes: permissions,
            },
            available_contexts: [
              {
                role_id: 212,
                role_name: "QA limited role",
                scope_type: "he_thong",
                org_unit_id: null,
                department_id: null,
                warehouse_id: null,
                permission_codes: permissions,
              },
            ],
          },
          meta: { request_id: "WWHN-212-ME-200" },
        }),
      });
      return;
    }

    if (path === "/inventory/balances") {
      inventoryUrls.push(rawUrl);
      balanceCalls += 1;
      if (options.balance401) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Chưa xác thực",
            error_code: "UNAUTHENTICATED",
            errors: [],
          }),
        });
        return;
      }
      if (options.balance403Once && balanceCalls === 1) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Kho yêu cầu nằm ngoài data scope hiện hành.",
            error_code: "ACCESS_DENIED",
            errors: [],
            error: { code: "ACCESS_DENIED", details: [] },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [balance],
          meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
        }),
      });
      return;
    }

    if (path === "/inventory/balances/bal-211/subledger") {
      inventoryUrls.push(rawUrl);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            balance_id: "bal-211",
            product_id: "product-211",
            warehouse_id: "wh-a",
            items: [{ id: "item-211", sku_code: "SKU-211" }],
            containers: [{ id: "box-211", container_code: "BOX-211" }],
            item_count: 1,
            container_count: 1,
          },
        }),
      });
      return;
    }

    if (path === "/stock-movements") {
      inventoryUrls.push(rawUrl);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [movement],
          meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
        }),
      });
      return;
    }

    if (path === "/stock-movements/mv-211") {
      inventoryUrls.push(rawUrl);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: movement }),
      });
      return;
    }

    if (path === "/stock-movements/mv-211/trace-source") {
      inventoryUrls.push(rawUrl);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            movement,
            source: {
              source_type: "INBOUND",
              document_code: "IN-211",
              status: "POSTED",
              actor_name: "QA2",
            },
            timeline: [{ from_status: "DRAFT", to_status: "POSTED" }],
            request_id: "req-211",
          },
        }),
      });
      return;
    }

    if (path === "/stock-movements/trace-by-code") {
      inventoryUrls.push(rawUrl);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            physical_code: {
              code_value: url.searchParams.get("code"),
              carrier_type: "QR",
              status: "ACTIVE",
            },
            resolved_type: "ITEM",
            resolved_id: "item-211",
            resolved_object: {
              sku_code: "SKU-211",
              sku_name: "Sản phẩm WWHN-211",
            },
            movements: [movement],
            container_items: [],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {} }),
    });
  });

  return {
    inventoryUrls,
    balanceCalls: () => balanceCalls,
    refreshCalls: () => refreshCalls,
    meCalls: () => meCalls,
  };
}

async function expectBootstrapComplete(api: ApiHarness): Promise<void> {
  await expect.poll(api.refreshCalls, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
  await expect.poll(api.meCalls, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
}

test("WWHN-212 route guard: inventory.view missing redirects direct URL to 403", async ({
  page,
}, testInfo) => {
  const api = await installApi(page, []);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory");
  await expectBootstrapComplete(api);

  await expect(page).toHaveURL(/\/errors\/403$/);
  await expect(
    page.getByText("Không có quyền truy cập", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("route-guard-403.png"),
    fullPage: true,
  });
});

test("WWHN-212 action guard: inventory.view without inventory.trace hides and disables trace", async ({
  page,
}, testInfo) => {
  const api = await installApi(page, ["inventory.view"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory");
  await expectBootstrapComplete(api);

  await expect(page.getByText("SKU-211", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Truy vết mã" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: /Lịch sử dịch chuyển/ }).click();
  await expect(page.getByText("MV-211", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trace" })).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("action-guard-trace.png"),
    fullPage: true,
  });
});

test("WWHN-212 filters + balance subledger + movement trace + physical-code trace follow locked endpoints", async ({
  page,
}, testInfo) => {
  const api = await installApi(page, ["inventory.view", "inventory.trace"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory");
  await expectBootstrapComplete(api);

  await expect(page.getByText("SKU-211", { exact: true })).toBeVisible();
  await page.getByLabel("Tìm tồn kho").fill("SKU-211");
  await page.getByLabel("Lọc trạng thái tồn").selectOption("normal");
  await expect
    .poll(() =>
      api.inventoryUrls.some((raw) => {
        const url = new URL(raw);
        return (
          url.pathname.endsWith("/inventory/balances") &&
          url.searchParams.get("keyword") === "SKU-211" &&
          url.searchParams.get("status") === "normal"
        );
      }),
    )
    .toBe(true);

  await page.getByRole("button", { name: "Mở" }).first().click();
  await expect
    .poll(() =>
      api.inventoryUrls.some((raw) =>
        new URL(raw).pathname.endsWith(
          "/inventory/balances/bal-211/subledger",
        ),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: /Lịch sử dịch chuyển/ }).click();
  await expect(page.getByText("MV-211", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Trace" }).click();
  await expect
    .poll(() => {
      const paths = api.inventoryUrls.map((raw) => new URL(raw).pathname);
      return (
        paths.some((path) => path.endsWith("/stock-movements/mv-211")) &&
        paths.some((path) =>
          path.endsWith("/stock-movements/mv-211/trace-source"),
        )
      );
    })
    .toBe(true);
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: /Tồn kho hiện tại/ }).click();
  await page.getByRole("button", { name: "Truy vết mã" }).click();
  await expect(
    page.getByText("Truy vết chứng từ nguồn (TRACE-01)", { exact: true }),
  ).toBeVisible();
  const codeInput = page.getByLabel("Tra cứu mã vật lý");
  await codeInput.fill("QR-211");
  await codeInput.press("Enter");
  await expect
    .poll(() =>
      api.inventoryUrls.some((raw) => {
        const url = new URL(raw);
        return (
          url.pathname.endsWith("/stock-movements/trace-by-code") &&
          url.searchParams.get("code") === "QR-211"
        );
      }),
    )
    .toBe(true);
  await expect(
    page.getByText("Kết quả tra cứu mã vật lý", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("six-endpoint-flow.png"),
    fullPage: true,
  });
});

test("WWHN-212 backend 403 is visible and retry recovers without navigation leak", async ({
  page,
}, testInfo) => {
  const api = await installApi(page, ["inventory.view"], {
    balance403Once: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory");
  await expectBootstrapComplete(api);

  await expect(
    page.getByText("Không có quyền truy cập", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByText("SKU-211", { exact: true })).toBeVisible();
  expect(api.balanceCalls()).toBeGreaterThanOrEqual(2);
  await expect(page).toHaveURL(/\/inventory$/);
  await page.screenshot({
    path: testInfo.outputPath("api-403-retry-recovered.png"),
    fullPage: true,
  });
});

test("WWHN-212 backend 401 fails closed to login when refresh is rejected", async ({
  page,
}) => {
  const api = await installApi(page, ["inventory.view"], { balance401: true });
  await page.goto("/inventory");
  await expect.poll(api.refreshCalls, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  expect(api.refreshCalls()).toBeGreaterThanOrEqual(2);
});

for (const viewport of [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-375x812", width: 375, height: 812 },
]) {
  test(`WWHN-212 responsive ${viewport.name}`, async ({ page }, testInfo) => {
    const api = await installApi(page, ["inventory.view", "inventory.trace"]);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/inventory");
    await expectBootstrapComplete(api);

    await expect(page.getByText("SKU-211", { exact: true })).toBeVisible();
    const documentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(documentOverflow).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}.png`),
      fullPage: true,
    });
  });
}
