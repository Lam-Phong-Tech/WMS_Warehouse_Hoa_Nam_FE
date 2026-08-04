import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  rehydrateMock,
  clearStorageMock,
  setTokenMock,
  logoutMock,
  setStateMock,
} = vi.hoisted(() => ({
  rehydrateMock: vi.fn(),
  clearStorageMock: vi.fn(),
  setTokenMock: vi.fn(),
  logoutMock: vi.fn(),
  setStateMock: vi.fn(),
}));

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: {
    persist: {
      rehydrate: rehydrateMock,
      clearStorage: clearStorageMock,
    },
    getState: () => ({ setToken: setTokenMock, logout: logoutMock }),
    setState: setStateMock,
  },
}));

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: { refresh: refreshMock },
}));

import { bootstrapAuth } from "@/app/bootstrap-auth";

describe("bootstrapAuth WWHN-165", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rehydrateMock.mockResolvedValue(undefined);
    clearStorageMock.mockResolvedValue(undefined);
  });

  it("401 hết phiên -> clear local session, không tạo bootstrapError", async () => {
    const error = {
      isAxiosError: true,
      response: { status: 401, data: { message: "Unauthenticated" } },
      toJSON: vi.fn(),
      name: "AxiosError",
      message: "Unauthenticated",
    };
    refreshMock.mockRejectedValue(error);

    await bootstrapAuth();

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(clearStorageMock).toHaveBeenCalledTimes(1);
    expect(setTokenMock).not.toHaveBeenCalled();
    expect(setStateMock).toHaveBeenCalledWith({
      isBootstrapped: true,
    });
    expect(setStateMock).not.toHaveBeenCalledWith({ bootstrapError: error });
  });

  it("network/5xx -> fail-closed bootstrapError, không giả thành anonymous", async () => {
    const error = new Error("Network Error");
    refreshMock.mockRejectedValue(error);

    await bootstrapAuth();

    expect(logoutMock).not.toHaveBeenCalled();
    expect(clearStorageMock).not.toHaveBeenCalled();
    expect(setStateMock).toHaveBeenCalledWith({ bootstrapError: error });
    expect(setStateMock).toHaveBeenCalledWith({ isBootstrapped: true });
  });

  it("refresh thành công -> setToken và hoàn tất bootstrap", async () => {
    refreshMock.mockResolvedValue({ access_token: "new-token" });

    await bootstrapAuth();

    expect(setTokenMock).toHaveBeenCalledWith("new-token");
    expect(setStateMock).toHaveBeenCalledWith({ isBootstrapped: true });
  });

  it("single-flight: hai caller chỉ tạo một refresh request", async () => {
    let resolveRefresh!: (value: { access_token: string }) => void;
    refreshMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const first = bootstrapAuth();
    const second = bootstrapAuth();
    resolveRefresh({ access_token: "single-flight-token" });
    await Promise.all([first, second]);

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(setTokenMock).toHaveBeenCalledWith("single-flight-token");
  });
});
