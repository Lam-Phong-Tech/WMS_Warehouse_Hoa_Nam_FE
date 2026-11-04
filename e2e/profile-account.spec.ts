import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  PROFILE_NAME,
  PROFILE_PASSWORD,
  MFA_SECRET,
  RECOVERY_CODES,
} from "./fixtures/profile-account-values";

const screenshotRoot = "test-results/profile-account";

test("desktop Chrome without installation metadata displays an office computer", async ({
  page,
}) => {
  await openFixture(page);
  const seed = await page.evaluate(() => {
    for (const device of window.__profileState.devices) {
      device.device_label = null;
      device.platform = null;
      device.client_type = null;
      for (const session of device.sessions) {
        session.device_label = null;
        session.platform = null;
        session.client_type = null;
      }
    }
    return window.__profileState;
  });
  await page.addInitScript((state) => {
    window.__profileSeed = state;
  }, seed);
  await page.reload();
  await page
    .getByRole("button", { name: "Quản lý thiết bị", exact: true })
    .click();
  const card = page.locator(".hn-personal-device-card").first();
  await expect(
    card.getByRole("heading", { name: "Máy tính văn phòng", exact: true }),
  ).toBeVisible();
  await expect(card).toContainText("Windows");
  await expect(card).toContainText("Chrome");
  await expect(card).toContainText("Thiết bị hiện tại");
  await expect(page.locator(".hn-personal-policy")).toHaveCount(0);
  await page.screenshot({
    path: `${screenshotRoot}/desktop-chrome-office-computer.png`,
  });
});

test("profile MFA enrolls locally, reveals recovery codes once and disables with real credentials", async ({
  page,
}) => {
  await openFixture(page, { width: 320 });
  await section(page, "Bảo mật");
  await page
    .getByRole("button", { name: "Bắt đầu đăng ký", exact: true })
    .click();
  let drawer = page.getByRole("dialog", { name: /^Xác thực hai bước/ });
  await drawerGeometry(page, drawer);
  await page.evaluate(() => {
    window.__profileFaults.push({
      method: "POST",
      url: "/auth/mfa/enroll",
      status: 503,
      code: "FIXTURE_UNAVAILABLE",
    });
  });
  await drawer
    .getByRole("button", { name: "Bắt đầu đăng ký", exact: true })
    .click();
  await expect(
    drawer.getByRole("alert").filter({ hasText: "Lỗi kiểm tra cục bộ" }),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "Bắt đầu đăng ký", exact: true })
    .click();
  const qr = drawer.getByRole("img", {
    name: "Mã QR đăng ký xác thực hai bước",
    exact: true,
  });
  await expect(qr).toBeVisible();
  expect(await qr.getAttribute("src")).toMatch(/^data:image\/png/);
  await expect(drawer.getByText(MFA_SECRET, { exact: true })).toBeVisible();
  await drawer.getByLabel("Mã xác thực", { exact: false }).fill("000000");
  await drawer
    .getByRole("button", { name: "Xác nhận và bật", exact: true })
    .click();
  await expect(
    drawer.getByRole("alert").filter({ hasText: "Mã xác thực không đúng" }),
  ).toBeVisible();
  await drawer.getByLabel("Mã xác thực", { exact: false }).fill("123456");
  await page.evaluate(() => {
    window.__profileDelays.push({
      method: "POST",
      url: "/auth/mfa/confirm",
      milliseconds: 5000,
    });
  });
  await drawer
    .getByRole("button", { name: "Xác nhận và bật", exact: true })
    .click();
  await expect(
    drawer.getByRole("button", { name: "Đóng", exact: true }).first(),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__profileState.mfa.enabled), {
      timeout: 15000,
    })
    .toBe(true);
  for (const code of RECOVERY_CODES)
    await expect(drawer.getByText(code, { exact: true })).toBeVisible();
  await drawerGeometry(page, drawer);
  await page.screenshot({
    path: `${screenshotRoot}/mfa-recovery-320-light.png`,
  });
  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
      cookie: decodeURIComponent(document.cookie),
    }),
  );
  for (const secret of [MFA_SECRET, ...RECOVERY_CODES])
    expect(storage).not.toContain(secret);
  await drawer
    .getByRole("button", { name: "Đóng", exact: true })
    .first()
    .click();
  let recovery = page.getByRole("dialog", {
    name: "Mã khôi phục",
    exact: true,
  });
  await expect(recovery).toBeVisible();
  await recovery
    .getByRole("button", { name: "Tiếp tục lưu mã", exact: true })
    .click();
  await expect(
    drawer.getByText(RECOVERY_CODES[0], { exact: true }),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "Đóng", exact: true })
    .first()
    .click();
  recovery = page.getByRole("dialog", { name: "Mã khôi phục", exact: true });
  await recovery
    .getByRole("button", { name: "Đã lưu mã khôi phục", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  drawer = page.getByRole("dialog", { name: /^Xác thực hai bước/ });
  await expect(
    drawer.getByText(RECOVERY_CODES[0], { exact: true }),
  ).toHaveCount(0);
  await drawer
    .getByRole("button", { name: "Tắt xác thực hai bước", exact: true })
    .click();
  await drawer
    .getByLabel("Mật khẩu hiện tại", { exact: false })
    .fill("WrongPassword!2026");
  await drawer.getByLabel("Mã xác thực", { exact: false }).fill("123456");
  await drawer
    .getByRole("button", { name: "Tắt xác thực hai bước", exact: true })
    .click();
  await expect(
    drawer
      .getByRole("alert")
      .filter({ hasText: "Thông tin xác thực không đúng" }),
  ).toBeVisible();
  await drawer
    .getByLabel("Mật khẩu hiện tại", { exact: false })
    .fill(PROFILE_PASSWORD);
  await drawer
    .getByLabel("Mã xác thực", { exact: false })
    .fill(RECOVERY_CODES[1]);
  await drawer
    .getByRole("button", { name: "Tắt xác thực hai bước", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__profileState.mfa.enabled))
    .toBe(false);
  expect(
    await page.evaluate(
      () =>
        window.__profileRequests
          .filter((entry) => entry.url === "/auth/mfa/disable")
          .at(-1)?.payload?.code,
    ),
  ).toBe(RECOVERY_CODES[1]);
  await closeDrawer(page, drawer);
  expect(
    await page.evaluate(() => window.__profileGlobalSnapshot().hasToken),
  ).toBe(true);
});

test("profile MFA load errors retry safely and required MFA cannot be disabled", async ({
  page,
}) => {
  await openFixture(page, {
    width: 390,
    devicesError: true,
    mfaError: true,
    mfa: "required",
  });
  await section(page, "Bảo mật");
  await expect(
    page.getByText(
      "Không tải được trạng thái xác thực. Vui lòng tải lại trang.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => {
    window.__profileMfaUnavailable = false;
  });
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: /^Xác thực hai bước/ });
  await drawerGeometry(page, drawer);
  await expect(
    drawer.getByRole("button", { name: "Tắt xác thực hai bước", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `${screenshotRoot}/mfa-required-390-light.png`,
  });
  expect(
    await page.evaluate(() =>
      window.__profileRequests.filter((entry) => entry.method !== "GET"),
    ),
  ).toEqual([]);
});
const layouts = [
  { width: 1440, theme: "light" },
  { width: 1024, theme: "light" },
  { width: 768, theme: "light" },
  { width: 390, theme: "light" },
  { width: 320, theme: "light" },
  { width: 390, theme: "dark" },
] as const;
const sections = [
  "Hồ sơ",
  "Bảo mật",
  "Thông báo",
  "Giao diện",
  "Khác",
] as const;

async function openFixture(
  page: Page,
  {
    width = 1440,
    theme = "light",
    multiple = false,
    mfa = "",
    browser = "default",
    devicesError = false,
    mfaError = false,
  }: {
    width?: number;
    theme?: "light" | "dark";
    multiple?: boolean;
    mfa?: string;
    browser?: NotificationPermission;
    devicesError?: boolean;
    mfaError?: boolean;
  } = {},
) {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript(
    ({ mode, permission }) => {
      localStorage.setItem("hoa-nam-theme", mode);
      window.__profileNotificationPermission = permission;
      window.__profileNotificationRequests = 0;
      if (typeof Notification !== "undefined") {
        Object.defineProperty(Notification, "permission", {
          configurable: true,
          get: () => window.__profileNotificationPermission ?? "default",
        });
        Notification.requestPermission = async () => {
          window.__profileNotificationRequests =
            (window.__profileNotificationRequests ?? 0) + 1;
          window.__profileNotificationPermission = "granted";
          return "granted";
        };
      }
    },
    { mode: theme, permission: browser },
  );
  const params = new URLSearchParams({ theme });
  if (multiple) params.set("multiple", "1");
  if (mfa) params.set("mfa", mfa);
  if (devicesError) params.set("devicesError", "1");
  if (mfaError) params.set("mfaError", "1");
  await page.goto(`/e2e/fixtures/profile-account.html?${params}`);
  await expect(
    page.getByRole("heading", { name: "Tài khoản của tôi", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__profileRequests.some(
          (entry) => entry.url === "/auth/preferences",
        ),
      ),
    )
    .toBe(true);
}
async function section(page: Page, label: (typeof sections)[number]) {
  const tab = page.getByRole("tab", { name: label, exact: true });
  if (await tab.isVisible()) await tab.click();
  else {
    await page
      .getByRole("combobox", { name: "Cài đặt tài khoản", exact: true })
      .click();
    await page.getByRole("option", { name: label, exact: true }).click();
  }
  const titles = {
    "Hồ sơ": "Tài khoản của tôi",
    "Bảo mật": "Bảo mật tài khoản",
    "Thông báo": "Thông báo",
    "Giao diện": "Giao diện",
    Khác: "Tùy chọn khác",
  };
  await expect(
    page.getByRole("heading", { name: titles[label], exact: true, level: 1 }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function drawerGeometry(page: Page, drawer: Locator) {
  await expect(drawer).toBeVisible();
  await expect
    .poll(async () => {
      const bounds = await drawer.boundingBox();
      return bounds ? Math.round(bounds.x + bounds.width) : null;
    })
    .toBe(page.viewportSize()!.width);
  expect(
    await drawer.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true);
  expect(
    await drawer.evaluate((node) =>
      Array.from(node.querySelectorAll<HTMLElement>("section,dl,dd,form"))
        .filter(
          (entry) =>
            entry.getBoundingClientRect().width > 0 &&
            entry.scrollWidth > entry.clientWidth + 2,
        )
        .map((entry) => ({
          tag: entry.tagName,
          className: entry.className,
          width: entry.clientWidth,
          scroll: entry.scrollWidth,
        })),
    ),
  ).toEqual([]);
  await noOverflow(page);
}
async function closeDrawer(page: Page, drawer: Locator) {
  await drawer
    .getByRole("button", { name: "Đóng", exact: true })
    .first()
    .click();
  await expect(drawer).not.toBeVisible();
  await noOverflow(page);
}

async function choose(page: Page, label: string, option: string) {
  const control = page.getByRole("combobox", { name: label, exact: true });
  const searchable = await control.evaluate((node) => node.tagName === "INPUT");
  await control.click();
  if (searchable) await control.fill(option);
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function savePreferences(page: Page) {
  const before = await page.evaluate(
    () => window.__profileState.preferences.version,
  );
  await page
    .locator(".hn-personal-settings > .hn-personal-actions")
    .getByRole("button", { name: "Lưu thay đổi", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__profileState.preferences.version))
    .toBe(before + 1);
}

test("profile preferences persist from server and apply globally without changing security semantics", async ({
  page,
}) => {
  await openFixture(page);
  await page
    .getByRole("tab", { name: "Tùy chọn tài khoản", exact: true })
    .click();
  await choose(page, "Định dạng ngày", "YYYY-MM-DD");
  await choose(page, "Múi giờ", "Asia/Tokyo");
  await choose(page, "Trang mở mặc định", "Tra cứu tồn kho");
  await savePreferences(page);
  await expect
    .poll(() => page.evaluate(() => window.__profileGlobalSnapshot().datetime))
    .toBe("2026-11-03 12:15");
  await section(page, "Giao diện");
  await page.getByRole("button", { name: "Tối", exact: true }).click();
  await savePreferences(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const probe = page.getByTestId("profile-global-probe");
  // Sample the settled theme color, rather than an intermediate transition frame.
  await probe.evaluate(async (node) => {
    await Promise.all(
      node
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
  });
  const beforeAccent = await probe
    .locator("button")
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  const semantic = await probe
    .getByText("Lỗi dùng chung", { exact: true })
    .evaluate((node) => getComputedStyle(node).color);
  await page.getByRole("button", { name: "Indigo", exact: true }).click();
  await savePreferences(page);
  await expect(page.locator("html")).toHaveAttribute(
    "data-account-accent",
    "indigo",
  );
  expect(
    await probe
      .locator("button")
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe(beforeAccent);
  expect(
    await probe
      .getByText("Lỗi dùng chung", { exact: true })
      .evaluate((node) => getComputedStyle(node).color),
  ).toBe(semantic);
  await section(page, "Khác");
  await page.getByRole("button", { name: "Lớn", exact: true }).click();
  await page.getByRole("button", { name: "Gọn", exact: true }).click();
  await page.getByLabel("Giảm chuyển động", { exact: true }).check();
  await savePreferences(page);
  await expect(page.locator("html")).toHaveAttribute(
    "data-account-font-size",
    "large",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-account-density",
    "compact",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-account-reduced-motion",
    "true",
  );
  expect(
    await probe
      .locator("td")
      .evaluate((node) => getComputedStyle(node).fontSize),
  ).toBe("16px");
  expect(
    await probe
      .locator("td")
      .evaluate((node) => getComputedStyle(node).paddingTop),
  ).toBe("8px");
  const duration = await probe.locator("button").evaluate((node) =>
    Math.max(
      ...getComputedStyle(node)
        .transitionDuration.split(",")
        .map(
          (value) =>
            parseFloat(value) * (value.trim().endsWith("ms") ? 1 : 1000),
        ),
    ),
  );
  expect(duration).toBeLessThanOrEqual(0.02);
  await page.screenshot({
    path: `${screenshotRoot}/global-preferences-1440-dark.png`,
  });
  await page.evaluate(() => {
    window.name = JSON.stringify({
      profileFixtureServer: window.__profileState,
    });
  });
  await page.addInitScript(() => {
    try {
      const seed = JSON.parse(window.name);
      if (seed.profileFixtureServer)
        window.__profileSeed = seed.profileFixtureServer;
    } catch {
      /* First navigation has no server snapshot. */
    }
    localStorage.removeItem("hoa-nam-theme");
    localStorage.removeItem("erp-language");
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Tài khoản của tôi", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__profileRequests.some(
          (entry) => entry.url === "/auth/preferences",
        ),
      ),
    )
    .toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-account-font-size",
    "large",
  );
  await expect
    .poll(() => page.evaluate(() => window.__profileGlobalSnapshot().datetime))
    .toBe("2026-11-03 12:15");
  await section(page, "Khác");
  await page
    .getByRole("button", { name: "Khôi phục mặc định", exact: true })
    .click();
  const reset = page.getByRole("dialog", {
    name: "Khôi phục tùy chọn mặc định?",
    exact: true,
  });
  await reset
    .getByRole("button", { name: "Khôi phục mặc định", exact: true })
    .click();
  await savePreferences(page);
  expect(
    await page.evaluate(() => ({
      theme: window.__profileState.preferences.theme,
      accent: window.__profileState.preferences.accent,
      timezone: window.__profileState.preferences.timezone,
      date_format: window.__profileState.preferences.date_format,
      notifications: window.__profileState.preferences.notifications,
      font_size: window.__profileState.preferences.font_size,
      density: window.__profileState.preferences.density,
      reduced_motion: window.__profileState.preferences.reduced_motion,
    })),
  ).toMatchObject({
    theme: "dark",
    accent: "indigo",
    timezone: "Asia/Tokyo",
    date_format: "YYYY-MM-DD",
    font_size: "medium",
    density: "comfortable",
    reduced_motion: false,
    notifications: { account: { in_app: true, email: false } },
  });
  await section(page, "Hồ sơ");
  await page
    .getByRole("tab", { name: "Tùy chọn tài khoản", exact: true })
    .click();
  await choose(page, "Ngôn ngữ", "English");
  await savePreferences(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(
    await page.evaluate(() =>
      window.__profileRequests
        .filter((entry) => entry.method !== "GET")
        .every(
          (entry) =>
            entry.method === "PATCH" && entry.url === "/auth/preferences",
        ),
    ),
  ).toBe(true);
});

test("profile notification security rules, browser permission and failed save preserve user choices", async ({
  page,
}) => {
  await openFixture(page, { width: 390, browser: "denied" });
  await section(page, "Thông báo");
  const mandatory = page.getByLabel("Hoạt động tài khoản · Trong ứng dụng", {
    exact: true,
  });
  await expect(mandatory).toBeChecked();
  await expect(mandatory).toBeDisabled();
  const email = page.getByLabel("Tồn kho & đối soát · Email", { exact: true });
  await email.check();
  await page.evaluate(() => {
    window.__profileFaults.push({
      method: "PATCH",
      url: "/auth/preferences",
      status: 500,
      code: "FIXTURE_SAVE_FAILED",
    });
  });
  const save = page
    .locator(".hn-personal-settings > .hn-personal-actions")
    .getByRole("button", { name: "Lưu thay đổi", exact: true });
  await save.click();
  await expect(
    page.getByText("Chưa lưu được thay đổi. Nội dung vừa nhập vẫn được giữ.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(email).toBeChecked();
  expect(
    await page.evaluate(
      () => window.__profileState.preferences.notifications.inventory.email,
    ),
  ).toBe(false);
  await page.screenshot({
    path: `${screenshotRoot}/notification-save-error-390-light.png`,
  });
  await savePreferences(page);
  expect(
    await page.evaluate(() => window.__profileState.preferences.notifications),
  ).toMatchObject({ inventory: { email: true }, account: { in_app: true } });
  await expect(
    page.getByText("Trình duyệt đang chặn thông báo", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Kiểm tra lại quyền", exact: true })
    .click();
  expect(await page.evaluate(() => window.__profileNotificationRequests)).toBe(
    0,
  );
  await page.evaluate(() => {
    window.__profileNotificationPermission = "granted";
  });
  await page
    .getByRole("button", { name: "Kiểm tra lại quyền", exact: true })
    .click();
  await expect(
    page.getByText("Đã cấp quyền", { exact: true }).first(),
  ).toBeVisible();
  await page.evaluate(() => {
    window.__profileNotificationPermission = "default";
  });
  await page
    .getByRole("button", { name: "Kiểm tra lại quyền", exact: true })
    .click();
  await page.getByRole("button", { name: "Cấp quyền", exact: true }).click();
  expect(await page.evaluate(() => window.__profileNotificationRequests)).toBe(
    1,
  );
  await expect(mandatory).toBeChecked();
  await expect(mandatory).toBeDisabled();
  await noOverflow(page);
});

async function confirmRevoke(page: Page) {
  const confirm = page.getByRole("dialog", {
    name: "Xác nhận kết thúc phiên?",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  const color = await confirm
    .getByRole("button", { name: "Kết thúc phiên", exact: true })
    .evaluate((node) =>
      (getComputedStyle(node).backgroundColor.match(/[\d.]+/g) ?? [])
        .slice(0, 3)
        .map(Number),
    );
  expect(color[0]).toBeGreaterThan(color[1]);
  expect(color[0]).toBeGreaterThan(color[2]);
  await confirm
    .getByRole("button", { name: "Kết thúc phiên", exact: true })
    .click();
  await expect(confirm).not.toBeVisible();
}

test("profile password validation keeps secrets local and follows existing forced relogin policy", async ({
  page,
}) => {
  await openFixture(page, { width: 320 });
  await section(page, "Bảo mật");
  await page.getByRole("button", { name: "Đổi mật khẩu", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: /^Đổi mật khẩu/ });
  await drawerGeometry(page, drawer);
  await drawer.getByLabel(/^Mật khẩu hiện tại/).fill("WrongPassword!2026");
  await drawer.getByLabel(/^Mật khẩu mới/).fill("ProfileNewPassword!2027");
  await drawer
    .getByLabel(/^Xác nhận mật khẩu mới/)
    .fill("MismatchPassword!2027");
  await drawer
    .getByRole("button", { name: "Đổi mật khẩu", exact: true })
    .click();
  await expect(drawer.getByText(/không khớp/).first()).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__profileRequests.some(
        (entry) => entry.url === "/auth/change-password",
      ),
    ),
  ).toBe(false);
  await drawer
    .getByLabel(/^Xác nhận mật khẩu mới/)
    .fill("ProfileNewPassword!2027");
  await drawer
    .getByRole("button", { name: "Đổi mật khẩu", exact: true })
    .click();
  await expect(
    drawer.getByText("Mật khẩu hiện tại không đúng", { exact: true }).first(),
  ).toBeVisible();
  await drawer.getByLabel(/^Mật khẩu hiện tại/).fill(PROFILE_PASSWORD);
  await drawerGeometry(page, drawer);
  await page.screenshot({ path: `${screenshotRoot}/password-320-light.png` });
  await drawer
    .getByRole("button", { name: "Đổi mật khẩu", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Đăng nhập lại", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__profileGlobalSnapshot()),
  ).toMatchObject({ hasToken: false, authenticated: false });
  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(storage).not.toContain("ProfileNewPassword!2027");
  expect(storage).not.toContain(PROFILE_PASSWORD);
});

test("profile edit, email reauthentication, avatar crop and discard use real local contracts", async ({
  page,
}) => {
  await openFixture(page);
  const edit = page.getByRole("button", {
    name: "Chỉnh sửa hồ sơ",
    exact: true,
  });
  await edit.click();
  let editor = page.getByRole("dialog", { name: /^Chỉnh sửa hồ sơ/ });
  await expect(editor.getByLabel("Tên đăng nhập", { exact: true })).toHaveCount(
    0,
  );
  await expect(editor.getByLabel("Phòng ban", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await editor.getByLabel("Số điện thoại", { exact: true }).fill("0912345678");
  await editor.getByRole("button", { name: "Đóng", exact: true }).click();
  let discard = page.getByRole("dialog", {
    name: "Bỏ thay đổi chưa lưu?",
    exact: true,
  });
  await expect(discard).toBeVisible();
  await discard
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  await expect(editor.getByLabel("Số điện thoại", { exact: true })).toHaveValue(
    "0912345678",
  );
  await editor.getByRole("button", { name: "Đóng", exact: true }).click();
  discard = page.getByRole("dialog", {
    name: "Bỏ thay đổi chưa lưu?",
    exact: true,
  });
  await discard
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__profileRequests.filter((entry) => entry.method !== "GET"),
    ),
  ).toEqual([]);
  await edit.click();
  editor = page.getByRole("dialog", { name: /^Chỉnh sửa hồ sơ/ });
  await editor
    .getByLabel("Họ và tên", { exact: false })
    .fill("Nguyễn Minh Anh — đã cập nhật");
  await editor
    .getByLabel("Email", { exact: false })
    .fill("profile.updated@example.com");
  await editor
    .getByLabel("Mật khẩu hiện tại", { exact: false })
    .fill("WrongPassword!2026");
  await editor
    .getByRole("button", { name: "Lưu thay đổi", exact: true })
    .click();
  await expect(
    editor.getByText("Mật khẩu hiện tại không đúng", { exact: true }).first(),
  ).toBeVisible();
  await expect(editor.getByLabel("Email", { exact: false })).toHaveValue(
    "profile.updated@example.com",
  );
  await editor
    .getByLabel("Mật khẩu hiện tại", { exact: false })
    .fill(PROFILE_PASSWORD);
  await editor.getByRole("button", { name: "Thay ảnh", exact: true }).click();
  const avatar = page.getByRole("dialog", { name: /^Thay ảnh/ });
  await drawerGeometry(page, avatar);
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 160;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#005b7d";
    context.fillRect(0, 0, 240, 160);
    context.fillStyle = "#93deef";
    context.fillRect(50, 30, 140, 100);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await avatar.getByLabel("Chọn ảnh khác", { exact: true }).setInputFiles({
    name: "fixture-avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(encoded, "base64"),
  });
  await expect(
    avatar.getByRole("img", { name: "Xem trước ảnh đại diện", exact: true }),
  ).toBeVisible();
  await avatar
    .getByRole("slider", { name: "Thu phóng", exact: true })
    .press("End");
  await page.screenshot({
    path: `${screenshotRoot}/avatar-crop-1440-light.png`,
  });
  await avatar.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(avatar).not.toBeVisible();
  const dimensions = await editor
    .getByRole("img", { name: "Ảnh đại diện", exact: true })
    .evaluate(async (image) => {
      const bitmap = await createImageBitmap(
        await (await fetch((image as HTMLImageElement).src)).blob(),
      );
      const result = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return result;
    });
  expect(dimensions).toEqual({ width: 512, height: 512 });
  await editor
    .getByRole("button", { name: "Lưu thay đổi", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  const upload = await page.evaluate(() =>
    window.__profileRequests.find(
      (entry) => entry.method === "POST" && entry.url === "/auth/me/avatar",
    ),
  );
  expect(upload).toMatchObject({
    headers: { "If-Match": "7" },
    payload: {
      display_name: "Nguyễn Minh Anh — đã cập nhật",
      email: "profile.updated@example.com",
      current_password: PROFILE_PASSWORD,
      avatar: { name: "avatar.jpg", type: "image/jpeg" },
    },
  });
  expect(Object.keys(upload!.payload!).sort()).toEqual([
    "avatar",
    "current_password",
    "display_name",
    "email",
    "phone",
  ]);
  await expect
    .poll(() =>
      page.evaluate(() => window.__profileGlobalSnapshot().displayName),
    )
    .toBe("Nguyễn Minh Anh — đã cập nhật");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__profileRequests.some(
          (entry) => entry.method === "GET" && entry.url === "/auth/me/avatar",
        ),
      ),
    )
    .toBe(true);
});

for (const { width, theme } of layouts) {
  test(`profile ${width} ${theme}: five responsive sections and own profile`, async ({
    page,
  }) => {
    await openFixture(page, { width, theme });
    const root = page.locator(".fixture-profile-main");
    await expect(
      root.getByText(PROFILE_NAME, { exact: true }).first(),
    ).toBeVisible();
    await noOverflow(page);
    await expect(
      root.getByRole("tab", { name: "Thiết bị & phiên" }),
    ).toHaveCount(0);
    await expect(
      root.getByRole("button", { name: "Quản lý thiết bị" }),
    ).toBeVisible();
    await expect(
      root
        .locator(".hn-personal-detail-list dt")
        .filter({ hasText: "Tên đăng nhập" }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `${screenshotRoot}/overview-${width}-${theme}.png`,
    });
    const edit = root.getByRole("button", {
      name: "Chỉnh sửa hồ sơ",
      exact: true,
    });
    await edit.click();
    const editor = page.getByRole("dialog", { name: /^Chỉnh sửa hồ sơ/ });
    await drawerGeometry(page, editor);
    await expect(editor.getByLabel("Họ và tên", { exact: false })).toHaveValue(
      PROFILE_NAME,
    );
    await expect(
      editor.getByRole("combobox", { name: /Vai trò|Phòng ban|Phạm vi/ }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `${screenshotRoot}/editor-${width}-${theme}.png`,
    });
    await closeDrawer(page, editor);
    await expect(edit).toBeFocused();
    for (const name of sections.slice(1)) {
      await section(page, name);
      await noOverflow(page);
      if (name === "Bảo mật")
        await expect(root.getByText(/Xác thực hai bước/).first()).toBeVisible();
      if (name === "Thông báo")
        await expect(
          root.getByLabel("Hoạt động tài khoản · Trong ứng dụng", {
            exact: true,
          }),
        ).toBeDisabled();
      await page.screenshot({
        path: `${screenshotRoot}/${sections.indexOf(name)}-${width}-${theme}.png`,
      });
    }
    expect(
      await page.evaluate(() =>
        window.__profileRequests.filter(
          (entry) => !["GET"].includes(entry.method),
        ),
      ),
    ).toEqual([]);
  });
}
