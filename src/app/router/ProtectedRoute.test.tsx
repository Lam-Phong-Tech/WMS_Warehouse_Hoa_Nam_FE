import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("ProtectedRoute WWHN-165", () => {
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

  it("bootstrap đang chạy -> loading, không redirect", () => {
    useAuthStore.setState({ isBootstrapped: false, isAuthenticated: false });
    renderProtectedRoute();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    expect(screen.queryByText("Inventory Page")).not.toBeInTheDocument();
  });

  it("bootstrap network/5xx -> fail-closed có retry, không redirect login", async () => {
    useAuthStore.setState({
      isAuthenticated: false,
      bootstrapError: new Error("Network Error"),
    });
    renderProtectedRoute();

    expect(
      screen.getByText("Không thể khôi phục phiên làm việc"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Thử lại/u }));
    expect(bootstrapAuthMock).toHaveBeenCalledTimes(1);
  });

  it("anonymous hợp lệ -> redirect login và không render outlet", () => {
    useAuthStore.setState({ isAuthenticated: false });
    renderProtectedRoute();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Inventory Page")).not.toBeInTheDocument();
  });

  it("/auth/me lỗi trước profile -> fail-closed có retry", async () => {
    const refetch = vi.fn();
    useMeMock.mockReturnValue({
      data: undefined,
      error: new Error("GET /auth/me failed"),
      isError: true,
      refetch,
    });
    useAuthStore.setState({ isAuthenticated: true, isProfileLoaded: false });
    renderProtectedRoute();

    expect(
      screen.getByText("Không thể tải hồ sơ và phân quyền"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Inventory Page")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Thử lại/u }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("profile đã load -> render outlet", () => {
    useAuthStore.setState({ isAuthenticated: true, isProfileLoaded: true });
    renderProtectedRoute();
    expect(screen.getByText("Inventory Page")).toBeInTheDocument();
  });
});
