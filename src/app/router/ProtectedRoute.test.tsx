import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProtectedRoute } from "@/app/router/ProtectedRoute";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";

const useMeMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/auth/hooks/use-me", () => ({
  useMe: useMeMock,
}));

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.ORG_UNITS]}>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<div>Login Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.ORG_UNITS} element={<div>Org Units Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true });
    useMeMock.mockReturnValue({
      data: undefined,
      error: null,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("not bootstrapped -> shows loading and does not redirect", () => {
    useAuthStore.setState({ isBootstrapped: false, isAuthenticated: false });
    renderProtectedRoute();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    expect(screen.queryByText("Org Units Page")).not.toBeInTheDocument();
  });

  it("anonymous -> redirects to /login", () => {
    useAuthStore.setState({ isAuthenticated: false });
    renderProtectedRoute();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Org Units Page")).not.toBeInTheDocument();
  });

  it("authenticated but profile is not loaded -> shows loading, no Outlet", () => {
    useAuthStore.setState({ isAuthenticated: true, isProfileLoaded: false });
    renderProtectedRoute();
    expect(screen.queryByText("Org Units Page")).not.toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });

  it("/auth/me error before profile load -> fail-closed with retry, no Outlet", async () => {
    const refetch = vi.fn();
    useMeMock.mockReturnValue({
      data: undefined,
      error: new Error("GET /auth/me failed"),
      isError: true,
      refetch,
    });
    useAuthStore.setState({ isAuthenticated: true, isProfileLoaded: false });

    renderProtectedRoute();

    expect(screen.queryByText("Org Units Page")).not.toBeInTheDocument();
    expect(
      screen.getByText("Khong the tai ho so va phan quyen"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Thử lại/u }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("authenticated and profile loaded -> renders Outlet", () => {
    useAuthStore.setState({ isAuthenticated: true, isProfileLoaded: true });
    renderProtectedRoute();
    expect(screen.getByText("Org Units Page")).toBeInTheDocument();
  });
});
