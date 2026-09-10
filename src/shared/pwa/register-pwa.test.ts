import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { unsafeRequestsInFlightMock, markPageLeavingMock } = vi.hoisted(() => ({
  unsafeRequestsInFlightMock: vi.fn(() => 0),
  markPageLeavingMock: vi.fn(),
}));

vi.mock("@/shared/api/transport-monitor", () => ({
  unsafeRequestsInFlight: unsafeRequestsInFlightMock,
  markPageLeaving: markPageLeavingMock,
}));

type RegisterPwaModule = typeof import("./register-pwa");

const CLEAR = {
  unsafeRequests: 0,
  userInitiated: false,
  pathname: "/dashboard",
  msSinceTyping: Number.POSITIVE_INFINITY,
  editingFilledField: false,
};

describe("reloadBlocker — khi nào được reload để áp bản mới", () => {
  let reloadBlocker: RegisterPwaModule["reloadBlocker"];
  let TYPING_QUIET_MS: number;

  beforeEach(async () => {
    ({ reloadBlocker, TYPING_QUIET_MS } = await import("./register-pwa"));
  });

  it("không còn lý do gì thì reload được", () => {
    expect(reloadBlocker(CLEAR)).toBeNull();
  });

  it("request ghi đang bay chặn reload — kể cả khi người dùng tự bấm cập nhật", () => {
    expect(reloadBlocker({ ...CLEAR, unsafeRequests: 1 })).toBe(
      "request-in-flight",
    );
    expect(
      reloadBlocker({ ...CLEAR, unsafeRequests: 1, userInitiated: true }),
    ).toBe("request-in-flight");
  });

  it("tự áp bản mới: không reload trên trang nhập thông tin đăng nhập", () => {
    for (const pathname of [
      "/login",
      "/login/",
      "/forgot-password",
      "/reset-password/abc",
      "/change-password",
    ]) {
      expect(reloadBlocker({ ...CLEAR, pathname })).toBe("auth-entry-page");
    }
    expect(reloadBlocker({ ...CLEAR, pathname: "/login-history" })).toBeNull();
  });

  it("tự áp bản mới: không reload khi vừa gõ phím hoặc đang sửa một ô đã có nội dung", () => {
    expect(
      reloadBlocker({ ...CLEAR, msSinceTyping: TYPING_QUIET_MS - 1 }),
    ).toBe("typing");
    expect(
      reloadBlocker({ ...CLEAR, msSinceTyping: TYPING_QUIET_MS }),
    ).toBeNull();
    expect(reloadBlocker({ ...CLEAR, editingFilledField: true })).toBe(
      "editing",
    );
  });

  it("người dùng tự bấm cập nhật: chỉ còn chờ request ghi, không chờ trang/gõ phím", () => {
    expect(
      reloadBlocker({
        ...CLEAR,
        userInitiated: true,
        pathname: "/login",
        msSinceTyping: 0,
        editingFilledField: true,
      }),
    ).toBeNull();
  });
});

describe("registerPwa — controllerchange không reload giữa lúc đang đăng nhập", () => {
  const listeners: Record<string, Array<() => void>> = {};
  let registration: {
    waiting: { postMessage: ReturnType<typeof vi.fn> } | null;
    installing: null;
    addEventListener: ReturnType<typeof vi.fn>;
  };
  let container: {
    controller: object | null;
    register: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
  };
  let reloadMock: ReturnType<typeof vi.fn>;
  let originalPathname: string;

  async function freshModule(): Promise<RegisterPwaModule> {
    vi.resetModules();
    return import("./register-pwa");
  }

  function fireControllerChange() {
    for (const listener of listeners.controllerchange ?? []) listener();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("PROD", true);
    unsafeRequestsInFlightMock.mockReturnValue(0);
    markPageLeavingMock.mockClear();
    for (const key of Object.keys(listeners)) delete listeners[key];
    registration = {
      waiting: null,
      installing: null,
      addEventListener: vi.fn(),
    };
    container = {
      controller: {},
      register: vi.fn(async () => registration),
      addEventListener: vi.fn((type: string, listener: () => void) => {
        (listeners[type] ??= []).push(listener);
      }),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: container,
    });
    reloadMock = window.location.reload as unknown as ReturnType<typeof vi.fn>;
    reloadMock.mockClear();
    originalPathname = window.location.pathname;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    (window.location as { pathname: string }).pathname = originalPathname;
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("lần cài đầu (chưa có controller lúc khởi động) không reload", async () => {
    container.controller = null;
    const { registerPwa } = await freshModule();
    await registerPwa();

    fireControllerChange();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("bản mới được kích hoạt khi request đăng nhập còn bay: chỉ reload sau khi request xong", async () => {
    (window.location as { pathname: string }).pathname = "/dashboard";
    const { registerPwa } = await freshModule();
    await registerPwa();

    unsafeRequestsInFlightMock.mockReturnValue(1);
    fireControllerChange();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(reloadMock).not.toHaveBeenCalled();

    unsafeRequestsInFlightMock.mockReturnValue(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(markPageLeavingMock).toHaveBeenCalled();
  });

  it("tự áp bản mới khi đang ở /login: hoãn tới lúc rời trang đăng nhập", async () => {
    (window.location as { pathname: string }).pathname = "/login";
    const { registerPwa } = await freshModule();
    await registerPwa();

    fireControllerChange();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(reloadMock).not.toHaveBeenCalled();

    (window.location as { pathname: string }).pathname = "/dashboard";
    await vi.advanceTimersByTimeAsync(500);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("người dùng tự bấm 'Cập nhật ngay' trên /login: reload ngay khi worker mới nhận quyền", async () => {
    (window.location as { pathname: string }).pathname = "/login";
    registration.waiting = { postMessage: vi.fn() };
    const { registerPwa, activateWaitingServiceWorker } = await freshModule();
    await registerPwa();

    activateWaitingServiceWorker({ userInitiated: true });
    expect(registration.waiting.postMessage).toHaveBeenCalledWith({
      type: "SKIP_WAITING",
    });

    fireControllerChange();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("nhiều lần controllerchange chỉ lên lịch một lần reload", async () => {
    (window.location as { pathname: string }).pathname = "/dashboard";
    const { registerPwa } = await freshModule();
    await registerPwa();

    fireControllerChange();
    fireControllerChange();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
