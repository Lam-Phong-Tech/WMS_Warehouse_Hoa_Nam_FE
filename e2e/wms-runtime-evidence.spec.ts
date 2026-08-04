import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "tablet-1024x768", width: 1024, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

test.use({ video: "on", trace: "on", screenshot: "on" });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "No active CI session",
        error: { code: "UNAUTHENTICATED" },
        request_id: "CI-REFRESH-401",
      }),
    });
  });
});

for (const viewport of viewports) {
  test(`login responsive evidence ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Hoa Nam" })).toBeVisible();
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

test("controlled login API error includes visible retry-safe state", async ({
  page,
}, testInfo) => {
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "Thông tin đăng nhập không hợp lệ",
        error: { code: "VALIDATION_ERROR" },
        request_id: "CI-LOGIN-422",
      }),
    });
  });

  await page.goto("/login");
  await page.locator('input[name="email"]').fill("qa-evidence@gmail.com");
  await page.locator('input[name="password"]').fill("invalid-ci-password");

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
    password: "invalid-ci-password",
  });
  await expect(page.getByText("Thông tin đăng nhập không hợp lệ")).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();

  await page.screenshot({
    path: testInfo.outputPath("login-api-error-422.png"),
    fullPage: true,
  });
});
