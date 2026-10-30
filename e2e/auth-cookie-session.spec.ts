import { expect, test } from "@playwright/test";

/** Run with E2E_BASE_URL and AUTH_E2E_USERNAME/PASSWORD against a seeded FE/BE deployment. */
const username = process.env.AUTH_E2E_USERNAME;
const password = process.env.AUTH_E2E_PASSWORD;

test("login, F5 refresh, and logout use only the HttpOnly refresh cookie", async ({
  page,
  context,
}) => {
  test.skip(
    !username || !password,
    "Set AUTH_E2E_USERNAME and AUTH_E2E_PASSWORD for a seeded backend",
  );
  test.setTimeout(90_000);
  await page.goto("/login");
  await page.getByLabel(/Tên đăng nhập|Username/i).fill(username!);
  await page.locator('input[name="password"]').fill(password!);

  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/auth/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Đăng nhập|Sign in/i }).click();
  const login = await loginResponse;
  expect(login.status()).toBe(200);
  const loginData = (await login.json()).data;
  expect(loginData.access_token).toBeTruthy();
  expect(loginData).not.toHaveProperty("refresh_token");

  await expect(page).toHaveURL(/\/dashboard\?screen=MAP-01/, {
    timeout: 60_000,
  });
  await expect(
    page.getByText(/Xác nhận phiên đăng nhập|Confirm work session/i).first(),
  ).toBeVisible();

  const cookie = (await context.cookies()).find(
    (item) => item.name === "wms_refresh_token",
  );
  expect(cookie).toMatchObject({ httpOnly: true, path: "/api/v1/auth" });

  const refreshResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/auth/refresh") &&
      response.request().method() === "POST",
  );
  await page.reload();
  const refresh = await refreshResponse;
  expect(refresh.status()).toBe(200);
  expect(refresh.request().postDataJSON()).toEqual({});
  const refreshData = (await refresh.json()).data;
  expect(refreshData.access_token).toBeTruthy();
  expect(refreshData).not.toHaveProperty("refresh_token");
  const rotatedCookie = (await context.cookies()).find(
    (item) => item.name === "wms_refresh_token",
  );
  expect(rotatedCookie?.value).toBeTruthy();
  expect(rotatedCookie?.value).not.toBe(cookie?.value);
  await expect(
    page.getByText(/Xác nhận phiên đăng nhập|Confirm work session/i).first(),
  ).toBeVisible();

  const logoutResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/auth/logout") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Đăng xuất|Log out/i }).click();
  const logout = await logoutResponse;
  expect(logout.status()).toBe(200);
  expect(logout.request().postDataJSON()).toEqual({});
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  expect(
    (await context.cookies()).find((item) => item.name === "wms_refresh_token"),
  ).toBeUndefined();
});
