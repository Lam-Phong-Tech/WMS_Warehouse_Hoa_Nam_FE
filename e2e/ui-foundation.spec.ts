/**
 * Part 2 Vuexy sync — computed-style contract + visual golden của foundation.
 *
 * Đo số đo THẬT trên trình duyệt (điều jsdom không đảm bảo) đối chiếu
 * DEC-UI-BASELINE-01: primary #7367F0, button 38px/radius 6/chữ 15,
 * body Public Sans-stack 15px, canvas #F8F7FA.
 *
 * Điều kiện golden: viewport cố định 1280x900, locale vi, animation settle
 * (chờ networkidle + timeout ngắn), light theme.
 *
 * Route /ui-foundation là DEV-only → spec chạy với dev server (webServer của
 * playwright.config chạy `npm run dev`). Trang nằm sau ProtectedRoute nên spec
 * bơm session mock qua route interception của /auth/me nếu cần — ở đây dùng
 * cách đơn giản: điều hướng thẳng; nếu bị redirect /login thì đo login (cũng
 * là foundation surface) và fail có chủ đích nếu thiếu marker.
 */
import { expect, test } from "@playwright/test";
import { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN } from "./support/mock-tokens";

const VIEWPORT = { width: 1280, height: 900 };

test.use({ viewport: VIEWPORT, locale: "vi-VN", colorScheme: "light" });

// Đăng nhập mock: chặn network auth để ProtectedRoute cho qua mà không cần BE.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "ok",
        data: {
          access_token: MOCK_ACCESS_TOKEN,
          refresh_token: MOCK_REFRESH_TOKEN,
          token_type: "Bearer",
          expires_in: 900,
        },
        meta: { request_id: "e2e", timestamp: new Date().toISOString() },
      }),
    }),
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "ok",
        // /auth/me trả user object TRỰC TIẾP trong data (auth.service.ts:204).
        data: {
          id: 1,
          username: "e2e.foundation",
          full_name: "E2E Foundation",
          email: "e2e@example.com",
          status: "ACTIVE",
          roles: [{ role_code: "SUPER_ADMIN", role_name: "Super Admin" }],
          permissions: [],
        },
        meta: { request_id: "e2e", timestamp: new Date().toISOString() },
      }),
    }),
  );
  // Các API khác (notifications...) trả rỗng để trang không treo loading.
  await page.route("**/api/v1/notifications**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "ok",
        data: { items: [], unread_count: 0 },
        meta: { request_id: "e2e", timestamp: new Date().toISOString() },
      }),
    }),
  );
});

async function gotoFoundation(page: import("@playwright/test").Page) {
  await page.goto("/ui-foundation");
  await expect(page.getByTestId("ui-foundation-root")).toBeVisible({
    timeout: 15_000,
  });
  // settle animation/motion trước khi đo/chụp
  await page.waitForTimeout(600);
}

test("computed styles khớp baseline DEC-UI-BASELINE-01", async ({ page }) => {
  await gotoFoundation(page);

  // Body: font Public Sans-stack + canvas #F8F7FA
  const body = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    return {
      fontFamily: s.fontFamily,
      canvasVar: root.getPropertyValue("--wms-bg-canvas").trim(),
      primaryVar: root.getPropertyValue("--wms-primary").trim(),
    };
  });
  expect(body.fontFamily).toContain("Public Sans");
  expect(body.canvasVar).toBe("#f8f7fa");
  expect(body.primaryVar).toBe("#7367f0");

  // Button filled: bg #7367F0, cao 38, radius 6, chữ 15/500
  const btn = page.getByTestId("btn-filled");
  const btnStyle = await btn.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      bg: s.backgroundColor,
      height: el.getBoundingClientRect().height,
      radius: s.borderRadius,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      fontFamily: s.fontFamily,
    };
  });
  expect(btnStyle.bg).toBe("rgb(115, 103, 240)");
  expect(Math.round(btnStyle.height)).toBe(38);
  expect(btnStyle.radius).toBe("6px");
  expect(btnStyle.fontSize).toBe("15px");
  expect(btnStyle.fontWeight).toBe("500");
  expect(btnStyle.fontFamily).toContain("Public Sans");

  // TextField: radius 6 + chữ 15
  const input = page
    .getByTestId("field-default")
    .locator("input")
    .first();
  const inputStyle = await input.evaluate((el) => {
    const root = el.closest(".MuiOutlinedInput-root") as HTMLElement;
    const rs = getComputedStyle(root);
    const is = getComputedStyle(el);
    return {
      radius: rs.borderRadius,
      fontSize: is.fontSize,
      height: root.getBoundingClientRect().height,
    };
  });
  expect(inputStyle.radius).toBe("6px");
  expect(inputStyle.fontSize).toBe("15px");
  expect(Math.round(inputStyle.height)).toBeGreaterThanOrEqual(36);
  expect(Math.round(inputStyle.height)).toBeLessThanOrEqual(40);

  // Status badge success: nền soft + chữ successText
  const badge = page.getByText("ĐÃ DUYỆT");
  const badgeStyle = await badge.evaluate((el) => {
    const chip = el.closest(".MuiChip-root") as HTMLElement;
    const s = getComputedStyle(chip);
    return { bg: s.backgroundColor, color: getComputedStyle(el).color };
  });
  expect(badgeStyle.bg).toBe("rgba(40, 199, 111, 0.16)");
  expect(badgeStyle.color).toBe("rgb(22, 122, 69)"); // #167A45

  // Swatch primary đúng màu token
  const swatch = page.getByTestId("swatch-primary");
  await expect(swatch).toHaveCSS("background-color", "rgb(115, 103, 240)");
});

test("dialog mở đúng radius/motion contract rồi đóng sạch", async ({ page }) => {
  await gotoFoundation(page);
  await page.getByTestId("open-dialog").click();
  const paper = page.locator(".MuiDialog-paper");
  await expect(paper).toBeVisible();
  await page.waitForTimeout(400); // settle Grow enter (280ms)
  await expect(paper).toHaveCSS("border-radius", "6px");
  await page.getByRole("button", { name: "Xác nhận" }).click();
  await expect(paper).toHaveCount(0, { timeout: 5_000 });
});

test("visual golden — foundation catalog", async ({ page }) => {
  await gotoFoundation(page);
  await expect(page.getByTestId("ui-foundation-root")).toHaveScreenshot(
    "ui-foundation-catalog.png",
    { maxDiffPixelRatio: 0.02, animations: "disabled" },
  );
});
