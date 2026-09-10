import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installTransportMonitor,
  readTransportLog,
  transportDiagnosticOf,
  unsafeRequestsInFlight,
} from "@/shared/api/transport-monitor";

// src/test/setup.ts mock toàn cục `axios`; ở đây cần adapter/pipeline THẬT của axios,
// chỉ tầng mạng được thay bằng adapter giả trong từng test.
vi.unmock("axios");

type Adapter = (config: InternalAxiosRequestConfig) => Promise<unknown>;

function monitoredInstance(adapter: Adapter) {
  const instance = axios.create({ baseURL: "https://api.example.test/api/v1" });
  instance.defaults.adapter = adapter as never;
  installTransportMonitor(instance);
  return instance;
}

function ok(config: InternalAxiosRequestConfig) {
  return { data: {}, status: 200, statusText: "OK", headers: {}, config };
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the request to fail");
}

describe("transport-monitor", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("đếm request GHI đang bay, trả về 0 khi xong — kể cả khi request hỏng", async () => {
    let release!: () => void;
    let fail!: () => void;
    const instance = monitoredInstance(
      (config) =>
        new Promise((resolve, reject) => {
          if (config.url === "/auth/login") release = () => resolve(ok(config));
          else
            fail = () =>
              reject(new AxiosError("Network Error", "ERR_NETWORK", config));
        }),
    );

    const login = instance.post("/auth/login", {});
    const save = instance.put("/inbound/1", {});
    await vi.waitFor(() => expect(unsafeRequestsInFlight()).toBe(2));

    release();
    await login;
    expect(unsafeRequestsInFlight()).toBe(1);

    fail();
    await failureOf(save);
    expect(unsafeRequestsInFlight()).toBe(0);
  });

  it("GET không tính là request ghi", async () => {
    let release!: () => void;
    const instance = monitoredInstance(
      (config) =>
        new Promise((resolve) => (release = () => resolve(ok(config)))),
    );

    const reading = instance.get("/skus");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unsafeRequestsInFlight()).toBe(0);
    release();
    await reading;
  });

  it("lỗi không có response: gắn bản ghi an toàn lên lỗi và lưu vào sessionStorage", async () => {
    const instance = monitoredInstance((config) =>
      Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config)),
    );

    const error = await failureOf(
      instance.post("/auth/login", {
        email: "secret.person@example.test",
        password: "<Leak-Me-Not-2026>",
      }),
    );
    const diagnostic = transportDiagnosticOf(error);

    expect(diagnostic).toMatchObject({
      code: "ERR_NETWORK",
      reason: "network",
      method: "POST",
      path: "/api/v1/auth/login",
      crossOrigin: true,
      build: "test-build",
    });
    expect(diagnostic?.summary).toMatch(
      /^ERR_NETWORK\/network \| \d+ms \| \+\d+\.\ds \| (online|offline)/,
    );
    // Không một mẩu dữ liệu nào của người dùng lọt vào bản ghi.
    const serialized = JSON.stringify(readTransportLog());
    expect(serialized).not.toContain("secret.person");
    expect(serialized).not.toContain("Leak-Me-Not");
    expect(readTransportLog()).toHaveLength(1);
  });

  it("phân biệt hết thời gian với bị trình duyệt huỷ", async () => {
    const instance = monitoredInstance((config) =>
      Promise.reject(
        config.url === "/slow"
          ? new AxiosError(
              "timeout of 10000ms exceeded",
              "ECONNABORTED",
              config,
            )
          : new AxiosError("Request aborted", "ECONNABORTED", config),
      ),
    );

    expect(
      transportDiagnosticOf(await failureOf(instance.post("/slow")))?.reason,
    ).toBe("timeout");
    expect(
      transportDiagnosticOf(await failureOf(instance.post("/aborted")))?.reason,
    ).toBe("aborted");
  });

  it("lỗi CÓ HTTP response hoặc huỷ chủ động thì không tạo bản ghi", async () => {
    const instance = monitoredInstance((config) =>
      Promise.reject(
        config.url === "/cancel"
          ? new AxiosError("canceled", "ERR_CANCELED", config)
          : new AxiosError(
              "Request failed with status code 401",
              "ERR_BAD_REQUEST",
              config,
              null,
              {
                data: {},
                status: 401,
                statusText: "Unauthorized",
                headers: {},
                config,
              },
            ),
      ),
    );

    expect(
      transportDiagnosticOf(await failureOf(instance.post("/auth/login"))),
    ).toBeNull();
    expect(
      transportDiagnosticOf(await failureOf(instance.post("/cancel"))),
    ).toBeNull();
    expect(readTransportLog()).toEqual([]);
  });

  it("che id trong đường dẫn và chỉ giữ 20 bản ghi gần nhất", async () => {
    const instance = monitoredInstance((config) =>
      Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config)),
    );

    const error = await failureOf(
      instance.get(
        "/inbound/123/items/0f8fad5b-d9cb-469f-a165-70867728950e?q=private",
      ),
    );
    expect(transportDiagnosticOf(error)?.path).toBe(
      "/api/v1/inbound/:id/items/:id",
    );

    for (let index = 0; index < 25; index += 1) {
      await failureOf(instance.get("/skus"));
    }
    expect(readTransportLog()).toHaveLength(20);
  });

  it("gắn hai lần không bọc adapter hai lần", async () => {
    const adapter = vi.fn((config: InternalAxiosRequestConfig) =>
      Promise.resolve(ok(config)),
    );
    const instance = monitoredInstance(adapter);
    installTransportMonitor(instance);

    await instance.post("/auth/login", {});
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(unsafeRequestsInFlight()).toBe(0);
  });
});
