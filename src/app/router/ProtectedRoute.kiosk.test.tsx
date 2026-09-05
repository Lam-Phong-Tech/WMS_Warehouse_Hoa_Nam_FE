/**
 * CHẾ ĐỘ MÁY QUÉT (VITE_SCANNER_KIOSK_MODE) — bản đối chứng của
 * ProtectedRoute.test.tsx: cùng hai tình huống lỗi HẠ TẦNG, nhưng khi cờ bật
 * thì không dựng cửa sổ chặn nữa mà tự thử lại ngầm.
 *
 * Test này giữ đúng ranh giới: cờ CHỈ đổi cách hiện lỗi hạ tầng, KHÔNG nới
 * lỏng xác thực — phiên bị chối thật vẫn phải về màn đăng nhập.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "@/app/router/ProtectedRoute";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";

const { useMeMock, bootstrapAuthMock } = vi.hoisted(() => ({
  useMeMock: vi.fn(),
  bootstrapAuthMock: vi.fn(),
}));

vi.mock("@/modules/auth/hooks/use-me", () => ({ useMe: useMeMock }));
vi.mock("@/app/bootstrap-auth", () => ({ bootstrapAuth: bootstrapAuthMock }));
vi.mock("@/shared/cache/use-persisted-cache", () => ({
  usePersistedQueryCache: () => true,
}));

// Cờ đọc một lần lúc dựng runtimeConfig -> mock nguyên module config.
vi.mock("@/shared/config/env", async () => {
  const actual = await vi.importActual<typeof import("@/shared/config/env")>(
    "@/shared/config/env",
  );
  return {
    ...actual,
    runtimeConfig: { ...actual.runtimeConfig, scannerKioskMode: true },
  };
});

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.INVENTORY]}>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<div>Login Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.INVENTORY} element={<div>Inventory Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute · chế độ máy quét", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true, bootstrapError: null });
    useMeMock.mockReturnValue({
      data: undefined,
      error: null,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("lỗi hạ tầng lúc khôi phục phiên: không dựng cửa sổ chặn, tự thử lại ngầm", async () => {
    vi.useFakeTimers();
    useAuthStore.setState({
      isAuthenticated: false,
      bootstrapError: new Error("Network Error"),
    });
    renderProtectedRoute();

    expect(
      screen.queryByText("Không thể khôi phục phiên làm việc"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(5000);
    expect(bootstrapAuthMock).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("lỗi /auth/me: không dựng cửa sổ chặn, tự gọi lại", async () => {
    vi.useFakeTimers();
    const refetch = vi.fn();
    useAuthStore.setState({ isAuthenticated: true, isProfileLoaded: false });
    useMeMock.mockReturnValue({
      data: undefined,
      error: new Error("Network Error"),
      isError: true,
      refetch,
    });
    renderProtectedRoute();

    expect(
      screen.queryByText("Không tải được hồ sơ người dùng"),
    ).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(5000);
    expect(refetch).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("phiên bị chối thật vẫn về màn đăng nhập — cờ không nới lỏng xác thực", async () => {
    useAuthStore.setState({
      isAuthenticated: false,
      bootstrapError: null,
    });
    renderProtectedRoute();
    await waitFor(() =>
      expect(screen.getByText("Login Page")).toBeInTheDocument(),
    );
  });
});
