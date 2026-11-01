import { expect, test } from "@playwright/test";

for (const completeRefreshProfile of [true, false]) {
  test(`F5 restores identity without a hint; refresh profile complete=${completeRefreshProfile}`, async ({
    page,
    context,
  }) => {
    const user = {
      id: "restore-browser-user",
      email: "restore@example.test",
      display_name: "Restore operator",
      username: "restore",
      roles: [
        {
          role_id: "super",
          role_code: "SUPER_ADMIN",
          role_name: "Admin",
          scope_ref: null,
        },
      ],
      permissions: Array.from(
        { length: 200 },
        (_, i) => `fixture.permission.${i}`,
      ),
      warehouse_scope_ids: [],
    };
    let refreshCount = 0;
    let profileReads = 0;
    let currentCookie = "initial-cookie";
    const issued = (access: string, profile: unknown) => ({
      success: true,
      data: {
        access_token: access,
        token_type: "bearer",
        expires_in: 3600,
        user: profile,
      },
    });
    await page.route("**/api/v1/auth/**", async (route) => {
      const request = route.request();
      const action = new URL(request.url()).pathname.split("/").at(-1);
      const headers = {
        "content-type": "application/json",
        "cache-control": "no-store, private",
      };
      if (action === "login") {
        await route.fulfill({
          headers: {
            ...headers,
            "set-cookie": `wms_refresh_token=${currentCookie}; HttpOnly; SameSite=Lax; Path=/api/v1/auth`,
          },
          json: issued("access-login", user),
        });
      } else if (action === "refresh") {
        expect(request.postDataJSON()).toEqual({});
        expect(request.headers().cookie).toContain(
          `wms_refresh_token=${currentCookie}`,
        );
        currentCookie = `rotated-cookie-${++refreshCount}`;
        await route.fulfill({
          headers: {
            ...headers,
            "set-cookie": `wms_refresh_token=${currentCookie}; HttpOnly; SameSite=Lax; Path=/api/v1/auth`,
          },
          json: issued(
            `access-refresh-${refreshCount}`,
            completeRefreshProfile ? user : undefined,
          ),
        });
      } else if (action === "me") {
        expect(request.headers().authorization).toMatch(/^Bearer access-/);
        profileReads++;
        await route.fulfill({ headers, json: { success: true, data: user } });
      } else if (action === "logout") {
        expect(request.postDataJSON()).toEqual({});
        await route.fulfill({
          headers: {
            ...headers,
            "set-cookie":
              "wms_refresh_token=; Max-Age=0; HttpOnly; Path=/api/v1/auth",
          },
          json: { success: true, data: null },
        });
      } else {
        await route.fulfill({ status: 404, json: { success: false } });
      }
    });
    await page.goto("/login");
    await page.getByLabel(/Email/i).fill(user.email);
    await page.locator('input[name="password"]').fill("Fixture#Only-2026");
    await page.getByRole("button", { name: /^Đăng nhập$|^Sign in$/i }).click();
    const confirmation = page.getByRole("heading", {
      name: /Xác nhận phiên đăng nhập|Confirm work session/i,
    });
    await expect(confirmation).toBeVisible();
    for (let iteration = 1; iteration <= 2; iteration++) {
      const before = (await context.cookies()).find(
        (cookie) => cookie.name === "wms_refresh_token",
      )!;
      await context.clearCookies({ name: "erp-auth" });
      await page.reload();
      await expect(confirmation).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/dashboard\?screen=MAP-01/);
      const after = (await context.cookies()).find(
        (cookie) => cookie.name === "wms_refresh_token",
      )!;
      expect(after.httpOnly).toBe(true);
      expect(after.value).not.toBe(before.value);
      expect(refreshCount).toBe(iteration);
    }
    if (!completeRefreshProfile) expect(profileReads).toBeGreaterThanOrEqual(2);
    await page.getByRole("button", { name: /Đăng xuất|Log out/i }).click();
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    expect(
      (await context.cookies()).find(
        (cookie) => cookie.name === "wms_refresh_token",
      ),
    ).toBeUndefined();
    await page.reload();
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  });
}

test("a required password change keeps the login token and stays on its form", async ({
  page,
}) => {
  const user = {
    id: "first-login-user",
    email: "first-login@example.test",
    display_name: "First login",
    status: "ACTIVE",
    roles: [
      {
        role_id: "role-1",
        role_code: "STAFF",
        role_name: "Staff",
        scope_ref: null,
      },
    ],
    permissions: [],
    warehouse_scope_ids: [],
  };
  let refreshCount = 0;
  await page.route("**/api/v1/auth/**", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    const headers = {
      "content-type": "application/json",
      "cache-control": "no-store",
    };
    if (action === "login") {
      await route.fulfill({
        headers,
        json: {
          success: true,
          data: {
            access_token: "first-login-access",
            token_type: "bearer",
            expires_in: 3600,
            user,
          },
        },
      });
    } else if (action === "me") {
      await route.fulfill({
        status: 403,
        headers,
        json: {
          success: false,
          error_code: "PASSWORD_CHANGE_REQUIRED",
          message: "Bạn phải đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.",
        },
      });
    } else if (action === "refresh") {
      refreshCount++;
      await route.fulfill({
        status: 422,
        headers,
        json: {
          success: false,
          error_code: "BUSINESS_RULE_ERROR",
          message: "Missing refresh cookie",
        },
      });
    } else {
      await route.fulfill({ status: 404, headers, json: { success: false } });
    }
  });

  await page.goto("/login");
  await page.getByLabel(/Email/i).fill(user.email);
  await page.locator('input[name="password"]').fill("Fixture#Only-2026");
  await page.getByRole("button", { name: /^Đăng nhập$|^Sign in$/i }).click();

  await expect(page).toHaveURL(/\/change-password$/);
  await expect(
    page.getByRole("heading", { name: /Đổi mật khẩu|Change password/i }),
  ).toBeVisible();
  expect(refreshCount).toBe(0);
});
