import { expect, test } from "@playwright/test";

test("login illustration follows the form height when a session notice is shown", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.addInitScript(() => {
    sessionStorage.setItem("hn-wms.session-replaced", JSON.stringify({
      device_label: "Android",
      signed_in_at: "2026-11-02T08:25:00Z",
      ip_hint: "14.246.0.xxx",
    }));
  });

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("alert")).toContainText("Tài khoản vừa được đăng nhập trên thiết bị khác", { timeout: 90_000 });

  const shell = page.locator('main[data-auth-baseline="login"]');
  const hero = shell.locator(":scope > div").first();
  const form = shell.locator(":scope > div").nth(1);
  const heroBounds = await hero.boundingBox();
  const formBounds = await form.boundingBox();

  expect(heroBounds).not.toBeNull();
  expect(formBounds).not.toBeNull();
  expect(formBounds!.height).toBeGreaterThan(900);
  expect(Math.abs(heroBounds!.height - formBounds!.height)).toBeLessThan(2);
});
