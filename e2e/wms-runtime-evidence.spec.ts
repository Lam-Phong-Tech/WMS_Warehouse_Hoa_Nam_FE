import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "tablet-1024x768", width: 1024, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

const ACCESS_TOKEN =
  process.env.E2E_MOCK_ACCESS_TOKEN ?? "<WWHN_148_MOCK_ACCESS_TOKEN>";

test.use({ video: "on", trace: "on", screenshot: "on" });

async function mockRefreshFailure(page: Page) {
  await page.route("**/api/v1/auth/refresh", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "No active CI session",
        error_code: "UNAUTHENTICATED",
        request_id: "WWHN-148-REFRESH-401",
      }),
    });
  });
}

async function mockAuthenticatedSession(
  page: Page,
  permissionCodes: string[] = [],
) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const url = route.request().url();

    if (url.endsWith("/auth/refresh")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            access_token: ACCESS_TOKEN,
            // BE m1 rotate refresh token trong response; thiếu field này
            // auth store coi phiên không hợp lệ và đá về /login.
            refresh_token: "<WWHN_148_MOCK_REFRESH_TOKEN>",
            token_type: "bearer",
            expires_in: 3600,
          },
          meta: { request_id: "WWHN-148-REFRESH-200" },
        }),
      });
      return;
    }

    if (url.endsWith("/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 148,
            name: "WWHN-148 QA User",
            email: "wwhn148.qa@gmail.com",
            code: "WWHN-148-QA",
            is_super_admin: false,
            // BE m1 trả permission codes ở top-level /auth/me.
            permissions: permissionCodes,
            active_context: {
              role_id: 148,
              role_name: "QA limited role",
              scope_type: "he_thong",
              org_unit_id: null,
              department_id: null,
              warehouse_id: null,
              permission_codes: permissionCodes,
            },
            available_contexts: [
              {
                role_id: 148,
                role_name: "QA limited role",
                scope_type: "he_thong",
                org_unit_id: null,
                department_id: null,
                warehouse_id: null,
                permission_codes: permissionCodes,
              },
            ],
          },
          meta: { request_id: "WWHN-148-ME-200" },
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
}

for (const viewport of viewports) {
  test(`login responsive evidence ${viewport.name}`, async ({ page }, testInfo) => {
    await mockRefreshFailure(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/login");

    // Heading login đổi theo redesign 10-11/8.
    await expect(
      page.getByRole("heading", { name: "Đăng nhập hệ thống" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}.png`),
      fullPage: true,
    });
  });
}

test("component-catalog exposes shared UI states for QA2", async ({
  page,
}, testInfo) => {
  await mockAuthenticatedSession(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/component-catalog");

  // Trang hiện có 2 heading trùng tên (h2 shell + h3 antd) -> khóa theo level.
  await expect(
    page.getByRole("heading", { name: "Component catalog", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("Loading", { exact: true })).toBeVisible();
  await expect(page.getByText("Empty", { exact: true })).toBeVisible();
  await expect(page.getByText("Error", { exact: true })).toBeVisible();
  await expect(page.getByText("No permission", { exact: true })).toBeVisible();
  await expect(page.getByText("API error + field errors", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirm action", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disabled until valid" })).toBeDisabled();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath("component-catalog-ui-states.png"),
    fullPage: true,
  });
});

test("limited role is redirected from master-data to errors/403", async ({
  page,
}, testInfo) => {
  await mockAuthenticatedSession(page, []);
  await page.setViewportSize({ width: 1440, height: 900 });
  // Route master-data canonical sau redesign là /master-data/skus.
  await page.goto("/master-data/skus");

  await expect(page).toHaveURL(/\/errors\/403$/);
  await expect(page.getByText("Không có quyền truy cập", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị viên để được cấp quyền phù hợp.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Về trang chủ" })).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("limited-role-403.png"),
    fullPage: true,
  });
});

test("controlled login API error includes visible retry-safe state", async ({
  page,
}, testInfo) => {
  await mockRefreshFailure(page);
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
        request_id: "WWHN-148-LOGIN-422",
      }),
    });
  });

  await page.goto("/login");
  // LoginPage dùng field "identifier" (email hoặc username) sau redesign.
  await page.locator('input[name="identifier"]').fill("qa-evidence@gmail.com");
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
  expect(loginResponse.request().postDataJSON()).toMatchObject({
    email: "qa-evidence@gmail.com",
    password: process.env.QA_EVIDENCE_PASSWORD ?? "<QA_EVIDENCE_PASSWORD>",
  });
  await expect(page.getByText("Thông tin đăng nhập không hợp lệ")).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();

  await page.screenshot({
    path: testInfo.outputPath("login-api-error-422.png"),
    fullPage: true,
  });
});
