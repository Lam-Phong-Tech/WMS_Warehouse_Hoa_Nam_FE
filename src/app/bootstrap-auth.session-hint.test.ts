import Cookies from "js-cookie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: { refresh: refreshMock },
  meResponseFromRefreshUser: vi.fn(() => null),
}));

const USER = {
  id: "u-hint",
  email: "operator@example.test",
  name: "Kho",
  code: "HN-01",
};

/**
 * Dấu vết phiên (cookie `erp-auth`) phải còn nguyên tới lúc bootstrap đọc nó.
 *
 * Middleware `persist` của zustand ghi state xuống cookie ở MỌI lần setState, kể cả
 * trước khi hydrate. Bootstrap từng gọi `setState({ isBootstrapped: false })` TRƯỚC
 * `rehydrate()` — cookie bị ghi đè bằng `user: null` của bộ nhớ ngay trước khi được
 * đọc, nên mở /login khi còn phiên hợp lệ thì không bao giờ thử khôi phục phiên.
 *
 * Mỗi test nạp module mới để store trong bộ nhớ trống đúng như lúc vừa tải trang,
 * còn cookie thì mang dấu vết của lần đăng nhập trước.
 */
describe("bootstrapAuth · dấu vết phiên trên trang công khai", () => {
  let originalPathname: string;

  beforeEach(() => {
    vi.resetModules();
    refreshMock.mockReset();
    originalPathname = window.location.pathname;
    (window.location as { pathname: string }).pathname = "/login";
    Cookies.set(
      "erp-auth",
      JSON.stringify({ state: { user: USER, contexts: [] }, version: 0 }),
      { path: "/" },
    );
  });

  afterEach(() => {
    (window.location as { pathname: string }).pathname = originalPathname;
    Cookies.remove("erp-auth", { path: "/" });
  });

  it("mở /login khi còn dấu vết phiên: vẫn thử khôi phục phiên bằng refresh", async () => {
    refreshMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });
    const { bootstrapAuth } = await import("@/app/bootstrap-auth");

    await bootstrapAuth();

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("refresh thành công: dấu vết phiên vẫn còn trong cookie", async () => {
    refreshMock.mockResolvedValue({ access_token: "restored-token" });
    const { bootstrapAuth } = await import("@/app/bootstrap-auth");
    const { useAuthStore } = await import("@/shared/store/auth.store");

    await bootstrapAuth();

    expect(useAuthStore.getState().token).toBe("restored-token");
    expect(Cookies.get("erp-auth")).toContain("operator@example.test");
  });

  it("máy sạch mở /login: không gọi refresh nào", async () => {
    Cookies.remove("erp-auth", { path: "/" });
    const { bootstrapAuth } = await import("@/app/bootstrap-auth");

    await bootstrapAuth();

    expect(refreshMock).not.toHaveBeenCalled();
  });
});
