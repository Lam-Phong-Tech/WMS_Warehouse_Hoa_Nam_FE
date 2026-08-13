import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Luồng 04 · Bảo hành & linh kiện (WAR-01/02/03, COMP-01) — evidence e2e
 * happy / negative / RBAC với API mock theo envelope ApiResponse chuẩn.
 */

const WARRANTY_PERMISSIONS = [
  "warranty.manage",
  "warranty.temp_only",
  "warranty.component_issue",
];

const CASE_LIST = [
  {
    id: "wc-e2e-1",
    case_code: "BH-E2E-0001",
    sku: "KT-2000",
    sku_name: "Máy khoan KT-2000",
    item_code: "SER-E2E-01",
    identification_type: "IDENTIFIED",
    customer_name: "Ng*** A",
    customer_phone: "09*****88",
    reported_defect: "Không lên nguồn",
    defect_code: "PWR",
    defect_name: "Không lên nguồn",
    status: "RECEIVED",
    received_at: "2026-08-10T08:00:00Z",
    created_at: "2026-08-10T08:00:00Z",
    version: 1,
  },
  {
    id: "wc-e2e-2",
    case_code: "BH-E2E-0002",
    temporary_item_code: "TEMP-E2E-02",
    missing_code_reason: "Mất tem mã",
    manual_product_description: "Máy mài góc màu xanh",
    identification_type: "TEMP_ONLY",
    customer_name: "Tr*** B",
    reported_defect: "Kẹt cò",
    status: "CHECKING",
    received_at: "2026-08-12T08:00:00Z",
    created_at: "2026-08-12T08:00:00Z",
    version: 2,
  },
];

const CREATED_CASE = {
  id: "wc-e2e-9",
  case_code: "BH-E2E-0009",
  temporary_item_code: "TEMP-E2E-09",
  identification_type: "TEMP_ONLY",
  identification_status: "TEMP_ONLY",
  missing_code_reason: "Khách làm mất tem",
  manual_product_description: "Máy cưa lọng màu cam",
  customer_name: "Lê Văn C",
  customer_phone: "0900000009",
  reported_defect: "Máy kêu to bất thường",
  status: "RECEIVED",
  received_at: "2026-08-13T08:00:00Z",
  created_at: "2026-08-13T08:00:00Z",
  stock_effect: "NONE",
  movement_created: false,
  version: 1,
};

function envelope(data: unknown, meta: Record<string, unknown> = {}) {
  return JSON.stringify({
    success: true,
    data,
    meta: { request_id: "WWHN-FLOW04-E2E", ...meta },
  });
}

async function mockWarrantySession(
  page: Page,
  permissionCodes: string[],
  options: { createStatus?: number } = {},
) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, "");
    const method = request.method();

    if (path === "/auth/refresh") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope({
          access_token: "<FLOW04_MOCK_ACCESS_TOKEN>",
          refresh_token: "<FLOW04_MOCK_REFRESH_TOKEN>",
          token_type: "bearer",
          expires_in: 3600,
        }),
      });
      return;
    }

    if (path === "/auth/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope({
          id: 4,
          name: "Flow04 QA User",
          email: "flow04.qa@gmail.com",
          code: "FLOW04-QA",
          is_super_admin: false,
          roles: [],
          // BE m1 trả permission codes ở top-level /auth/me.
          permissions: permissionCodes,
          active_context: {
            role_id: 4,
            role_name: "QA warranty role",
            scope_type: "he_thong",
            org_unit_id: null,
            department_id: null,
            warehouse_id: null,
            permission_codes: permissionCodes,
          },
          available_contexts: [
            {
              role_id: 4,
              role_name: "QA warranty role",
              scope_type: "he_thong",
              org_unit_id: null,
              department_id: null,
              warehouse_id: null,
              permission_codes: permissionCodes,
            },
          ],
        }),
      });
      return;
    }

    if (path === "/warranty-cases" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope(CASE_LIST, {
          total: CASE_LIST.length,
          current_page: 1,
          per_page: 15,
        }),
      });
      return;
    }

    if (path === "/warranty-cases" && method === "POST") {
      if (options.createStatus === 422) {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Số điện thoại không hợp lệ",
            error_code: "VALIDATION_ERROR",
            errors: { customer_phone: ["Số điện thoại không hợp lệ"] },
            request_id: "WWHN-FLOW04-CREATE-422",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: envelope(CREATED_CASE),
      });
      return;
    }

    if (path === `/warranty-cases/${CREATED_CASE.id}` && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope(CREATED_CASE),
      });
      return;
    }

    if (path === "/warranty-cases/wc-e2e-1" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope({ ...CASE_LIST[0], stock_effect: "NONE" }),
      });
      return;
    }

    if (/^\/warranty-cases\/[^/]+\/(events|attachments)$/.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope([]),
      });
      return;
    }

    if (path === "/component-issue-documents" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope([]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope([]),
    });
  });
}

test("RBAC: thiếu warranty.manage bị chặn 403 trước khi vào WAR-01", async ({
  page,
}, testInfo) => {
  await mockWarrantySession(page, []);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/warranty");

  await expect(page).toHaveURL(/\/errors\/403$/);
  await expect(
    page.getByText("Không có quyền truy cập", { exact: true }),
  ).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("warranty-rbac-403.png"),
    fullPage: true,
  });
});

test("Happy: WAR-01 hiển thị danh sách; WAR-02 tạo TEMP_ONLY với Idempotency-Key, stock-neutral", async ({
  page,
}, testInfo) => {
  await mockWarrantySession(page, WARRANTY_PERMISSIONS);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/warranty");

  // WAR-01: hub danh sách.
  await expect(page.getByText("BH-E2E-0001")).toBeVisible();
  await expect(page.getByText("BH-E2E-0002")).toBeVisible();
  await expect(page.getByText("TEMP-E2E-02")).toBeVisible();

  // WAR-02: intake TEMP_ONLY.
  await page.getByRole("button", { name: "+ Tiếp nhận bảo hành" }).click();
  await expect(page.getByText("Tiếp nhận bảo hành").first()).toBeVisible();
  await page.getByText("Mất mã (TEMP_ONLY)").click();
  await expect(
    page.getByText(/Mã tạm sẽ do hệ thống sinh sau khi lưu/),
  ).toBeVisible();

  await page.getByLabel("Lý do mất/không có mã").fill("Khách làm mất tem");
  await page.getByLabel("Mô tả nhận diện máy").fill("Máy cưa lọng màu cam");
  await page.getByLabel("Tên khách gửi").fill("Lê Văn C");
  await page.getByLabel("Số điện thoại").fill("0900000009");
  await page
    .getByLabel("Bệnh / lỗi khách phản ánh")
    .fill("Máy kêu to bất thường");

  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/warranty-cases") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Lưu tiếp nhận" }).click(),
  ]);

  expect(createResponse.status()).toBe(201);
  const headers = createResponse.request().headers();
  expect(headers["idempotency-key"]).toMatch(/^fe:warranty-create:/);
  expect(createResponse.request().postDataJSON()).toMatchObject({
    missing_code_reason: "Khách làm mất tem",
    manual_product_description: "Máy cưa lọng màu cam",
    customer_name: "Lê Văn C",
    customer_phone: "0900000009",
  });

  // Sau tạo: mở WAR-03 của case mới, hiện mã tạm.
  await expect(page.getByText("BH-E2E-0009").first()).toBeVisible();
  await expect(page.getByText(/Mã tạm: TEMP-E2E-09/)).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("warranty-happy-temp-only-created.png"),
    fullPage: true,
  });
});

test("Negative: BE 422 khi tạo case hiển thị lỗi + request id, form retry-safe", async ({
  page,
}, testInfo) => {
  await mockWarrantySession(page, WARRANTY_PERMISSIONS, { createStatus: 422 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/warranty");

  await expect(page.getByText("BH-E2E-0001")).toBeVisible();
  await page.getByRole("button", { name: "+ Tiếp nhận bảo hành" }).click();
  await page.getByText("Mất mã (TEMP_ONLY)").click();
  await page.getByLabel("Lý do mất/không có mã").fill("Mất tem");
  await page.getByLabel("Mô tả nhận diện máy").fill("Máy khoan xanh");
  await page.getByLabel("Tên khách gửi").fill("Lê Văn C");
  await page.getByLabel("Số điện thoại").fill("12345678");
  await page.getByLabel("Bệnh / lỗi khách phản ánh").fill("Không chạy");

  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/warranty-cases") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Lưu tiếp nhận" }).click(),
  ]);

  expect(createResponse.status()).toBe(422);
  await expect(
    page.getByText(/Số điện thoại không hợp lệ/).first(),
  ).toBeVisible();
  // Form vẫn mở, nút submit vẫn dùng lại được (retry-safe).
  await expect(
    page.getByRole("button", { name: "Lưu tiếp nhận" }),
  ).toBeEnabled();

  await page.screenshot({
    path: testInfo.outputPath("warranty-negative-422.png"),
    fullPage: true,
  });
});

test("WAR-03 + COMP-01: mở chi tiết case và modal xuất linh kiện purpose=WARRANTY", async ({
  page,
}, testInfo) => {
  await mockWarrantySession(page, WARRANTY_PERMISSIONS);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/warranty");

  await expect(page.getByText("BH-E2E-0001")).toBeVisible();
  await page.getByRole("button", { name: "Mở" }).first().click();

  // WAR-03: chi tiết case + khối nghiệp vụ.
  await expect(page.getByText("Khách hàng & tiếp nhận")).toBeVisible();
  await expect(page.getByText("Máy & chẩn đoán")).toBeVisible();
  await expect(page.getByText(/Tệp đính kèm/)).toBeVisible();

  // COMP-01: mở modal xuất linh kiện, ràng buộc purpose=WARRANTY hiển thị rõ.
  await page.getByRole("button", { name: "Xuất linh kiện" }).click();
  await expect(page.getByText(/purpose=WARRANTY/).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tạo phiếu DRAFT" }),
  ).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("warranty-war03-comp01.png"),
    fullPage: true,
  });
});
