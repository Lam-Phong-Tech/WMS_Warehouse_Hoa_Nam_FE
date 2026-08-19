import { expect, test, type Page } from "@playwright/test";

// WWHN-325 / FE325-P1-12 — nửa UI-thật của bằng chứng offline fail-closed.
//
// Root cause được phát hiện và sửa cùng commit này: TanStack Query mặc định
// networkMode="online" sẽ PAUSE mutation khi navigator.onLine=false —
// mutationFn không chạy nên guard offline ở axios không kịp chặn, UI kẹt
// "Đang xác thực..." vô hạn, và mutation bị giữ trong cache để TỰ RESUME
// (replay) khi có mạng trở lại. Fix: mutations.networkMode="always" tại
// src/app/providers/query-client.ts + LoginPage hiển thị đúng thông điệp
// OFFLINE_MUTATION_BLOCKED. Spec này là regression proof cho cả hai.
//
// Bằng chứng offline no-network/no-queue/no-replay mức endpoint (receipt/
// issue/reversal/adjustment) và SW update flow runtime nằm ở
// e2e/wwhn-325-pwa-offline.spec.ts; nửa service-layer nằm ở
// src/shared/pwa/wwhn-325-offline-flows.test.ts.

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function trackApiMutations(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (!MUTATION_METHODS.has(request.method().toUpperCase())) return;
    const pathname = new URL(request.url()).pathname;
    if (/^\/api(?:\/|$)/i.test(pathname)) {
      seen.push(`${request.method()} ${pathname}`);
    }
  });
  return seen;
}

test.describe("WWHN-325 offline mutation guard qua UI thật", () => {
  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
  });

  test("login offline: guard chặn trước network, báo đúng thông điệp, không pause/replay sau reconnect", async ({
    context,
    page,
  }) => {
    const mutations = trackApiMutations(page);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    await page
      .getByPlaceholder("admin@gmail.com hoặc admin")
      .fill("qa2-offline@example.com");
    await page.getByPlaceholder("Nhập mật khẩu").fill("Password!123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    // networkMode="always" bắt buộc guard chạy ngay: lỗi hiển thị tức thì,
    // không còn trạng thái paused "Đang xác thực tài khoản..." treo vô hạn.
    await expect(
      page.getByText("Không thể thực hiện thao tác ghi khi đang ngoại tuyến", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.getByText("Đang xác thực tài khoản")).toHaveCount(0);

    expect(
      mutations.filter((entry) => entry.includes("/auth/login")),
      "guard axios phải chặn trước khi request rời trình duyệt",
    ).toEqual([]);

    // Reconnect: mutation đã bị reject hẳn (không nằm trong mutation cache ở
    // trạng thái paused) nên KHÔNG được tự bắn lại /auth/login.
    const before = mutations.length;
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForTimeout(3_000);

    expect(
      mutations.slice(before).filter((entry) => entry.includes("/auth/login")),
      "không được replay login sau khi có mạng lại",
    ).toEqual([]);
  });
});
