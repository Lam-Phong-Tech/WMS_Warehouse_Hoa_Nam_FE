import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backendProbeOf,
  isBackendUnavailableError,
  isWaitingForBackend,
  probeBackend,
  subscribeBackendWait,
  waitForBackend,
  withBackendRecovery,
  type BackendProbe,
} from "@/shared/api/backend-availability";
import { OFFLINE_MUTATION_CODE } from "@/shared/pwa/offline-policy";

// Cần AxiosError/isAxiosError THẬT (src/test/setup.ts mock axios toàn cục).
vi.unmock("axios");

const HEALTH_URL = "https://api.example.test/api/v1/health";

function networkError(): AxiosError {
  return new AxiosError("Network Error", "ERR_NETWORK");
}

function httpError(status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_RESPONSE",
    undefined,
    undefined,
    {
      status,
      statusText: "",
      headers: {},
      config: {},
      data: {},
    } as AxiosResponse,
  );
}

/** Đồng hồ giả: `sleep` chỉ cộng giờ, nên ngân sách 15–45 s chạy xong tức thì. */
function scripted(results: BackendProbe[], fallback: BackendProbe) {
  let clock = 0;
  const probe = vi.fn(async () => results.shift() ?? fallback);
  return {
    probe,
    elapsed: () => clock,
    options: {
      probe,
      sleep: async (ms: number) => {
        clock += ms;
      },
      now: () => clock,
    },
  };
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

afterEach(() => {
  Reflect.deleteProperty(window.navigator, "onLine");
  vi.unstubAllGlobals();
});

describe("isBackendUnavailableError", () => {
  it("chỉ nhận lỗi kiểu máy chủ chưa sẵn sàng", () => {
    expect(isBackendUnavailableError(networkError())).toBe(true);
    expect(isBackendUnavailableError(httpError(502))).toBe(true);
    expect(isBackendUnavailableError(httpError(503))).toBe(true);

    // 504: request có thể đã được xử lý; 401/422/429/500: đã có câu trả lời.
    for (const status of [401, 422, 429, 500, 504]) {
      expect(isBackendUnavailableError(httpError(status))).toBe(false);
    }
    expect(
      isBackendUnavailableError(
        new AxiosError("timeout of 10000ms exceeded", "ECONNABORTED"),
      ),
    ).toBe(false);
    expect(
      isBackendUnavailableError(
        new AxiosError("offline", OFFLINE_MUTATION_CODE),
      ),
    ).toBe(false);
    expect(isBackendUnavailableError(new Error("Network Error"))).toBe(false);
  });
});

describe("probeBackend", () => {
  it("phân loại theo response của /health", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce({ status: 200 });
    await expect(probeBackend(HEALTH_URL)).resolves.toBe("ready");
    fetchMock.mockResolvedValueOnce({ status: 503 });
    await expect(probeBackend(HEALTH_URL)).resolves.toBe("unavailable");
    // Ứng dụng đã trả lời (vd sai đường dẫn health) — không được chặn đăng nhập.
    fetchMock.mockResolvedValueOnce({ status: 404 });
    await expect(probeBackend(HEALTH_URL)).resolves.toBe("ready");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(probeBackend(HEALTH_URL)).resolves.toBe("unreachable");

    // Request đơn giản: không cookie, không header tự đặt ⇒ không phát preflight.
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(HEALTH_URL);
    expect(init).toMatchObject({
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
    });
    expect(init.headers).toBeUndefined();
  });

  it("trình duyệt báo offline thì không dò", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setOnline(false);

    await expect(probeBackend(HEALTH_URL)).resolves.toBe("offline");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("waitForBackend", () => {
  it("dò tới khi máy chủ trả lời", async () => {
    const run = scripted(
      ["unavailable", "unavailable", "ready"],
      "unavailable",
    );
    await expect(waitForBackend(run.options)).resolves.toBe("ready");
    expect(run.probe).toHaveBeenCalledTimes(3);
  });

  it("chưa lần nào tới được máy chủ: bỏ cuộc theo ngân sách ngắn", async () => {
    const run = scripted([], "unreachable");
    await expect(waitForBackend(run.options)).resolves.toBe("unreachable");
    expect(run.elapsed()).toBeGreaterThan(10_000);
    expect(run.elapsed()).toBeLessThanOrEqual(15_000);
  });

  it("đã thấy gateway trả lời thì chờ theo ngân sách dài", async () => {
    const run = scripted(["unreachable"], "unavailable");
    await expect(waitForBackend(run.options)).resolves.toBe("unavailable");
    expect(run.elapsed()).toBeGreaterThan(15_000);
    expect(run.elapsed()).toBeLessThanOrEqual(45_000);
  });

  it("mất mạng thì dừng ngay", async () => {
    const run = scripted(["offline"], "unavailable");
    await expect(waitForBackend(run.options)).resolves.toBe("offline");
    expect(run.probe).toHaveBeenCalledTimes(1);
  });
});

describe("withBackendRecovery", () => {
  it("máy chủ vừa khởi động lại xong: gửi lại đúng một lần", async () => {
    const run = scripted(["unavailable", "ready"], "unavailable");
    const task = vi
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce("ok");

    await expect(withBackendRecovery(task, run.options)).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("lỗi nghiệp vụ và hết giờ không kích hoạt việc chờ", async () => {
    for (const error of [
      httpError(401),
      httpError(504),
      new AxiosError("timeout", "ECONNABORTED"),
    ]) {
      const run = scripted([], "ready");
      const task = vi.fn().mockRejectedValue(error);

      await expect(withBackendRecovery(task, run.options)).rejects.toBe(error);
      expect(task).toHaveBeenCalledTimes(1);
      expect(run.probe).not.toHaveBeenCalled();
    }
  });

  it("hết ngân sách: ném lại lỗi gốc kèm kết quả dò cuối, không gửi lại", async () => {
    const run = scripted([], "unavailable");
    const error = httpError(503);
    const task = vi.fn().mockRejectedValue(error);

    await expect(withBackendRecovery(task, run.options)).rejects.toBe(error);
    expect(backendProbeOf(error)).toBe("unavailable");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("gửi lại vẫn hỏng thì dừng, không lặp vô hạn", async () => {
    const run = scripted(["ready"], "ready");
    const retryError = networkError();
    const task = vi
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(retryError);

    await expect(withBackendRecovery(task, run.options)).rejects.toBe(
      retryError,
    );
    expect(backendProbeOf(retryError)).toBe("ready");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("báo trạng thái đang chờ cho giao diện trong lúc dò", async () => {
    let release!: (probe: BackendProbe) => void;
    const probe = vi.fn(
      () =>
        new Promise<BackendProbe>((resolve) => {
          release = resolve;
        }),
    );
    const listener = vi.fn();
    const unsubscribe = subscribeBackendWait(listener);
    const task = vi
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce("ok");

    const pending = withBackendRecovery(task, { probe });
    await vi.waitFor(() => expect(isWaitingForBackend()).toBe(true));
    release("ready");

    await expect(pending).resolves.toBe("ok");
    expect(isWaitingForBackend()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
