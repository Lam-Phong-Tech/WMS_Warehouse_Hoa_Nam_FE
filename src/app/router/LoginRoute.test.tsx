import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { LoginRoute } from "@/app/router/LoginRoute";
import { DASHBOARD_CANONICAL, ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

function renderLoginRoute() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
      <Routes>
        <Route element={<LoginRoute />}>
          <Route path={ROUTES.LOGIN} element={<div>Login form</div>} />
        </Route>
        <Route path={ROUTES.HOME} element={<div>Account landing</div>} />
        <Route
          path={DASHBOARD_CANONICAL.split("?")[0]}
          element={<div>Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginRoute", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: false });
  });

  it("waits for session restoration before showing the login form", () => {
    renderLoginRoute();
    expect(screen.queryByText("Login form")).not.toBeInTheDocument();
  });

  it("shows login for a confirmed anonymous visitor", () => {
    useAuthStore.setState({ isBootstrapped: true });
    renderLoginRoute();
    expect(screen.getByText("Login form")).toBeInTheDocument();
  });

  it("redirects an authenticated visitor to the account landing resolver", () => {
    useAuthStore.setState({ isBootstrapped: true, isAuthenticated: true });
    renderLoginRoute();
    expect(screen.getByText("Account landing")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Login form")).not.toBeInTheDocument();
  });

  it("redirects through the landing resolver after an existing session is restored", () => {
    renderLoginRoute();
    act(() => {
      useAuthStore.setState({ isAuthenticated: true, isBootstrapped: true });
    });
    expect(screen.getByText("Account landing")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Login form")).not.toBeInTheDocument();
  });
});
