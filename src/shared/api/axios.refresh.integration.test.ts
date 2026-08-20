import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.unmock("axios");
vi.unmock("@/shared/api/axios");

import MockAdapter from "axios-mock-adapter";

/**
 * Integration test cho refresh flow ở tầng axios adapter: request đi qua toàn
 * bộ interceptor chain; chỉ network transport được giả lập.
 */

const { setTokenMock, logoutMock, clearStorageMock } = vi.hoisted(() => ({
  setTokenMock: vi.fn(),
  logoutMock: vi.fn(),
  clearStorageMock: vi.fn(),
}));

vi.mock("@/shared/store/auth.store", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/store/auth.store")
  >("@/shared/store/auth.store");
  return {
    ...actual,
    useAuthStore: {
      ...actual.useAuthStore,
      getState: () => ({ logout: logoutMock, setToken: setTokenMock }),
      persist: { clearStorage: clearStorageMock },
    },
  };
});

import { api } from "@/shared/api/axios";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { memoryStorage } from "@/shared/lib/memory-storage";

const EXPIRED_ACCESS_TOKEN_PLACEHOLDER = "<EXPIRED_ACCESS_TOKEN>";
const FRESH_ACCESS_TOKEN_PLACEHOLDER = "<FRESH_ACCESS_TOKEN>";

describe("axios refresh interceptor — integration (mock ở tầng HTTP adapter)", () => {
  let mock: MockAdapter;
  const originalLocation = window.location;

  beforeEach(() => {
    mock = new MockAdapter(api);
    setTokenMock.mockReset();
    logoutMock.mockReset();
    clearStorageMock.mockReset();
    memoryStorage.clear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, pathname: "/employees", assign: vi.fn() },
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it("access token hết hạn (401) + refresh hợp lệ → tự refresh, thu hồi state cũ và retry thành công", async () => {
    memoryStorage.setItem(EXPIRED_ACCESS_TOKEN_PLACEHOLDER);

    let employeesCallCount = 0;
    mock.onGet("/employees").reply((config) => {
      employeesCallCount += 1;
      if (
        config.headers?.Authorization ===
        `Bearer ${FRESH_ACCESS_TOKEN_PLACEHOLDER}`
      ) {
        return [
          200,
          { success: true, data: [{ id: 1, name: "Nguyen Van A" }] },
        ];
      }
      return [401, { success: false, message: "Token expired" }];
    });

    mock.onPost(API_ENDPOINTS.REFRESH).reply(200, {
      success: true,
      data: {
        access_token: FRESH_ACCESS_TOKEN_PLACEHOLDER,
        token_type: "bearer",
        expires_in: 900,
      },
    });

    const res = await api.get("/employees");

    expect(employeesCallCount).toBe(2);
    expect(res.status).toBe(200);
    expect(res.data.data).toEqual([{ id: 1, name: "Nguyen Van A" }]);
    expect(memoryStorage.getToken()).toBe(FRESH_ACCESS_TOKEN_PLACEHOLDER);
    expect(setTokenMock).toHaveBeenCalledWith(FRESH_ACCESS_TOKEN_PLACEHOLDER);
  });

  it("access token hết hạn + refresh cũng 401 → logout, redirect login, không retry", async () => {
    memoryStorage.setItem(EXPIRED_ACCESS_TOKEN_PLACEHOLDER);

    mock.onGet("/employees").reply(401, {
      success: false,
      message: "Token expired",
    });
    mock.onPost(API_ENDPOINTS.REFRESH).reply(401, {
      success: false,
      message: "Refresh token invalid or expired",
    });

    await expect(api.get("/employees")).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(clearStorageMock).toHaveBeenCalledTimes(1);
    // WWHN-165/QA2-LOGIN-001: về /login, kèm ?redirect= giữ attempted URL để
    // đăng nhập lại quay về đúng chỗ — assertion chấp nhận cả dạng có/không
    // redirect param, miễn là đích luôn là /login (không retry request cũ).
    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(
      expect.stringMatching(/^\/login(\?redirect=|$)/),
    );
    expect(memoryStorage.getToken()).toBe(EXPIRED_ACCESS_TOKEN_PLACEHOLDER);
  });

  it("nhiều request 401 đồng thời → một refresh, cả hai retry thành công", async () => {
    memoryStorage.setItem(EXPIRED_ACCESS_TOKEN_PLACEHOLDER);

    let refreshCallCount = 0;
    mock.onPost(API_ENDPOINTS.REFRESH).reply(() => {
      refreshCallCount += 1;
      return [
        200,
        {
          success: true,
          data: {
            access_token: FRESH_ACCESS_TOKEN_PLACEHOLDER,
            token_type: "bearer",
            expires_in: 900,
          },
        },
      ];
    });
    mock
      .onGet("/employees")
      .reply((config) =>
        config.headers?.Authorization ===
        `Bearer ${FRESH_ACCESS_TOKEN_PLACEHOLDER}`
          ? [200, { success: true, data: [] }]
          : [401, { success: false, message: "Token expired" }],
      );
    mock
      .onGet("/departments")
      .reply((config) =>
        config.headers?.Authorization ===
        `Bearer ${FRESH_ACCESS_TOKEN_PLACEHOLDER}`
          ? [200, { success: true, data: [] }]
          : [401, { success: false, message: "Token expired" }],
      );

    const [res1, res2] = await Promise.all([
      api.get("/employees"),
      api.get("/departments"),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(refreshCallCount).toBe(1);
    expect(setTokenMock).toHaveBeenCalledTimes(1);
    expect(setTokenMock).toHaveBeenCalledWith(FRESH_ACCESS_TOKEN_PLACEHOLDER);
  });
});
