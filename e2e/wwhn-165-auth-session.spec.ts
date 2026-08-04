import { expect, test, type Page, type Route } from "@playwright/test";

const SOURCE_SHA = (process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local").slice(
  0,
  12,
);
const APP_ENV = process.env.VITE_APP_ENV ?? "ci";

function safe(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function evidenceName(
  scenario: string,
  role: string,
  viewport: string,
  extension = "png",
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return safe(
    `WWHN-165_${scenario}_env-${APP_ENV}_sha-${SOURCE_SHA}_role-${role}_viewport-${viewport}_${timestamp}.${extension}`,
  );
}

async function mockAuthenticatedSession(
  page: Page,
  permissionCodes: string[],
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
            access_token: "wwhn-165-access-token",
            token_type: "bearer",
            expires_in: 3600,
          },
          meta: { request_id: "WWHN-165-REFRESH-200" },
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
            id: 165,
            name: "WWHN-165 Limited User",
            email: "wwhn165.qa@example.com",
            code: "WWHN-165-QA",
            is_super_admin: false,
            active_context: {
              role_id: 165,
              role_name: "Inventory Viewer",
              scope_type: "kho",
              org_unit_id: null,
              department_id: null,
              warehouse_id: 1,
              permission_codes: permissionCodes,
            },
            available_contexts: [
              {
                role_id: 165,
                role_name: "Inventory Viewer",
                scope_type: "kho",
                org_unit_id: null,
                department_id: null,
                warehouse_id: 1,
                permission_codes: permissionCodes,
              },
            ],
            company: null,
            branch: null,
            department: null,
            position: null,
            role: { id: 165, name: "Inventory Viewer", permissions: [] },
          },
          meta: { request_id: "WWHN-165-ME-200" },
        }),
      });
      return;
    }

    if (url.endsWith("/auth/logout")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: null }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

test.use({ video: "on", trace: "on", screenshot: "on" });

test("bootstrap 503 stays fail-closed and exposes retry", async ({
  page,
}, testInfo) => {
  await page.route("**/api/v1/auth/refresh", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "Auth service temporarily unavailable",
        error_code: "SERVICE_UNAVAILABLE",
        meta: { request_id: "WWHN-165-REFRESH-503" },
      }),
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory");

  await expect(
    page.getByText("Không thể khôi phục phiên làm việc"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Thử lại/u })).toBeVisible();
  await expect(page).toHaveURL(/\/inventory$/);

  await page.screenshot({
    path: testInfo.outputPath(
      evidenceName("bootstrap-503-fail-closed", "anonymous", "1440x900"),
    ),
    fullPage: true,
  });
});

test("limited role navigation is filtered by permission code", async ({
  page,
}, testInfo) => {
  await mockAuthenticatedSession(page, ["inventory.view"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/profile");

  const wmsGroup = page.getByText("Quản lý kho · WMS", { exact: true });
  await expect(wmsGroup).toBeVisible();
  await wmsGroup.click();

  const inventoryRoute = page.getByText("Tồn & truy vết", { exact: true });
  await expect(inventoryRoute).toBeVisible();
  await expect(page.getByText("Danh mục & SKU", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Nhật ký kiểm tra", { exact: true })).toHaveCount(0);

  await inventoryRoute.click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page).not.toHaveURL(/\/errors\/403$/);

  await page.screenshot({
    path: testInfo.outputPath(
      evidenceName("role-navigation", "inventory-viewer", "1440x900"),
    ),
    fullPage: true,
  });
});

test("logout clears protected session and returns to login", async ({
  page,
}, testInfo) => {
  await mockAuthenticatedSession(page, ["inventory.view"]);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/profile");

  await page.getByRole("button", { name: /Menu tài khoản/u }).click();
  await page.getByText("Đăng xuất", { exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath(
      evidenceName("logout", "inventory-viewer", "1024x768"),
    ),
    fullPage: true,
  });
});