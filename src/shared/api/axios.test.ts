import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { logoutMock, clearStorageMock, setTokenMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  clearStorageMock: vi.fn(),
  setTokenMock: vi.fn(),
}));

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: {
    getState: () => ({ logout: logoutMock, setToken: setTokenMock }),
    persist: { clearStorage: clearStorageMock },
  },
}));

const { memoryStorageMock } = vi.hoisted(() => ({
  memoryStorageMock: {
    getToken: vi.fn(() => null),
    setItem: vi.fn(),
  },
}));

vi.mock("@/shared/lib/memory-storage", () => ({
  memoryStorage: memoryStorageMock,
}));

import { api } from "@/shared/api/axios";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { ROUTES } from "@/shared/constants/routes";

interface TestAxiosError {
  isAxiosError: true;
  name: string;
  message: string;
  toJSON: ReturnType<typeof vi.fn>;
  response: { status: number; data: unknown };
  config: {
    url: string;
    headers: Record<string, string>;
    _isRetryAfterRefresh: boolean;
  };
  _isNoPermission?: boolean;
  _isConflictError?: boolean;
  _isValidationError?: boolean;
}

function rejectedHandler() {
  const handlers = (
    api.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>;
    }
  ).handlers;
  const handler = handlers.find((item) => item?.rejected);
  if (!handler) throw new Error("Missing response interceptor");
  return handler.rejected;
}

function makeError(
  status: number,
  url: string,
  data: unknown = {},
  retry = false,
): TestAxiosError {
  return {
    isAxiosError: true,
    name: "AxiosError",
    message: `HTTP ${status}`,
    toJSON: vi.fn(),
    response: { status, data },
    config: { url, headers: {}, _isRetryAfterRefresh: retry },
  };
}

describe("axios auth/session interceptor WWHN-165", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, pathname: "/inventory", assign: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("login/refresh 401 để caller quyết định, không redirect side-effect", async () => {
    const rejected = rejectedHandler();
    const loginError = makeError(401, API_ENDPOINTS.LOGIN);
    const refreshError = makeError(401, API_ENDPOINTS.REFRESH);

    await expect(rejected(loginError)).rejects.toBe(loginError);
    await expect(rejected(refreshError)).rejects.toBe(refreshError);
    expect(logoutMock).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("401 resource -> refresh bằng cookie (body rỗng), revoke stale profile via setToken, retry once", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        success: true,
        data: {
          access_token: "new-token",
          token_type: "bearer",
          expires_in: 900,
        },
      },
    });
    const requestSpy = vi
      .spyOn(api, "request")
      .mockResolvedValue({ data: "ok" });
    const error = makeError(401, "/inventory-balances");

    await rejectedHandler()(error);

    // P1 bảo mật 10/09/2026: không bao giờ gửi refresh token từ JavaScript.
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      API_ENDPOINTS.REFRESH,
      {},
      { withCredentials: true },
    );
    expect(setTokenMock).toHaveBeenCalledWith("new-token");
    expect(error.config.headers.Authorization).toBe("Bearer new-token");
    expect(requestSpy).toHaveBeenCalledWith(error.config);
  });

  it("BE cũ còn trả refresh_token: interceptor chỉ lưu access token", async () => {
    vi.spyOn(api, "post").mockResolvedValue({
      data: {
        success: true,
        data: {
          access_token: "access-only",
          refresh_token: "<must-not-be-stored>",
          token_type: "bearer",
          expires_in: 900,
        },
      },
    });
    vi.spyOn(api, "request").mockResolvedValue({ data: "ok" });

    await rejectedHandler()(makeError(401, "/inventory-balances"));

    expect(memoryStorageMock.setItem).toHaveBeenCalledTimes(1);
    expect(memoryStorageMock.setItem).toHaveBeenCalledWith("access-only");
    expect(JSON.stringify(memoryStorageMock.setItem.mock.calls)).not.toContain(
      "must-not-be-stored",
    );
  });

  it("nhiều request 401 cùng lúc chỉ tạo MỘT refresh (single-flight)", async () => {
    let resolveRefresh!: (value: unknown) => void;
    const postSpy = vi.spyOn(api, "post").mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }) as never,
    );
    vi.spyOn(api, "request").mockResolvedValue({ data: "ok" });

    const first = rejectedHandler()(makeError(401, "/inventory-balances"));
    const second = rejectedHandler()(makeError(401, "/inbound-documents"));
    resolveRefresh({
      data: { success: true, data: { access_token: "shared", token_type: "bearer", expires_in: 900 } },
    });
    await Promise.all([first, second]);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(setTokenMock).toHaveBeenCalledTimes(1);
  });

  it("refresh xếp hàng liên tab qua navigator.locks khi có", async () => {
    const request = vi.fn(
      (_name: string, _options: LockOptions, callback: () => Promise<unknown>) =>
        callback(),
    );
    vi.stubGlobal("navigator", { ...navigator, locks: { request } });
    vi.spyOn(api, "post").mockResolvedValue({
      data: { success: true, data: { access_token: "locked", token_type: "bearer", expires_in: 900 } },
    });
    vi.spyOn(api, "request").mockResolvedValue({ data: "ok" });

    await rejectedHandler()(makeError(401, "/inventory-balances"));

    expect(request).toHaveBeenCalledWith(
      "wms-auth-refresh",
      { mode: "exclusive" },
      expect.any(Function),
    );
  });

  it("refresh network/5xx không phá phiên và trả đúng lỗi hạ tầng", async () => {
    const refreshError = makeError(503, API_ENDPOINTS.REFRESH);
    vi.spyOn(api, "post").mockRejectedValue(refreshError);
    const originalError = makeError(401, "/inventory-balances");

    await expect(rejectedHandler()(originalError)).rejects.toBe(refreshError);
    expect(logoutMock).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("refresh 401 xác nhận hết phiên -> logout và redirect giữ attempted URL", async () => {
    const refreshError = makeError(401, API_ENDPOINTS.REFRESH);
    vi.spyOn(api, "post").mockRejectedValue(refreshError);
    const originalError = makeError(401, "/inventory-balances");

    await expect(rejectedHandler()(originalError)).rejects.toBe(refreshError);
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(clearStorageMock).toHaveBeenCalledTimes(1);
    // WWHN-165/QA2-LOGIN-001: attempted URL đi kèm ?redirect= để login xong
    // quay lại đúng màn đang làm việc.
    expect(window.location.assign).toHaveBeenCalledWith(
      `${ROUTES.LOGIN}?redirect=${encodeURIComponent("/inventory")}`,
    );
  });

  it("redirect login giữ cả search/hash của attempted URL", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: "/inbound",
        search: "?status=DRAFT",
        hash: "#line-2",
        assign: vi.fn(),
      },
    });
    const refreshError = makeError(403, API_ENDPOINTS.REFRESH);
    vi.spyOn(api, "post").mockRejectedValue(refreshError);
    const originalError = makeError(401, "/inbound-documents");

    await expect(rejectedHandler()(originalError)).rejects.toBe(refreshError);
    expect(window.location.assign).toHaveBeenCalledWith(
      `${ROUTES.LOGIN}?redirect=${encodeURIComponent("/inbound?status=DRAFT#line-2")}`,
    );
  });

  it("403/409/422 giữ semantic flag cho UI", async () => {
    const rejected = rejectedHandler();
    const forbidden = makeError(403, "/inventory-balances");
    const conflict = makeError(409, "/inventory-balances");
    const validation = makeError(422, "/inventory-balances");

    await expect(rejected(forbidden)).rejects.toBe(forbidden);
    await expect(rejected(conflict)).rejects.toBe(conflict);
    await expect(rejected(validation)).rejects.toBe(validation);
    expect(forbidden._isNoPermission).toBe(true);
    expect(conflict._isConflictError).toBe(true);
    expect(validation._isValidationError).toBe(true);
  });
});
