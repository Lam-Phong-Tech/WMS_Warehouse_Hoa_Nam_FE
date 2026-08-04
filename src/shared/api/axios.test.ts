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
    getRefreshToken: vi.fn<() => string | null>(() => null),
    setItem: vi.fn(),
    setRefreshToken: vi.fn(),
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

  afterEach(() => vi.restoreAllMocks());

  it("login/refresh 401 để caller quyết định, không redirect side-effect", async () => {
    const rejected = rejectedHandler();
    const loginError = makeError(401, API_ENDPOINTS.LOGIN);
    const refreshError = makeError(401, API_ENDPOINTS.REFRESH);

    await expect(rejected(loginError)).rejects.toBe(loginError);
    await expect(rejected(refreshError)).rejects.toBe(refreshError);
    expect(logoutMock).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("401 resource -> refresh, revoke stale profile via setToken, retry once", async () => {
    memoryStorageMock.getRefreshToken.mockReturnValue("refresh-token");
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

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(setTokenMock).toHaveBeenCalledWith("new-token");
    expect(error.config.headers.Authorization).toBe("Bearer new-token");
    expect(requestSpy).toHaveBeenCalledWith(error.config);
  });

  it("refresh network/5xx không phá phiên và trả đúng lỗi hạ tầng", async () => {
    const refreshError = makeError(503, API_ENDPOINTS.REFRESH);
    vi.spyOn(api, "post").mockRejectedValue(refreshError);
    const originalError = makeError(401, "/inventory-balances");

    await expect(rejectedHandler()(originalError)).rejects.toBe(refreshError);
    expect(logoutMock).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("refresh 401 xác nhận hết phiên -> logout và redirect", async () => {
    const refreshError = makeError(401, API_ENDPOINTS.REFRESH);
    vi.spyOn(api, "post").mockRejectedValue(refreshError);
    const originalError = makeError(401, "/inventory-balances");

    await expect(rejectedHandler()(originalError)).rejects.toBe(refreshError);
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(clearStorageMock).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(ROUTES.LOGIN);
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
