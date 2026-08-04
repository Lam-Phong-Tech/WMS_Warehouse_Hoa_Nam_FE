import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLogin } from "@/modules/auth/hooks/use-login";
import { authService } from "@/modules/auth/services/auth.service";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: {
    login: vi.fn(),
    switchContext: vi.fn(),
    logout: vi.fn(),
  },
}));

const EMAIL = "operator@gmail.com";
const PASSWORD = "<TEST_LOGIN_PASSWORD>";
const CONTEXT = {
  role_id: 10,
  role_name: "Quản lý kho",
  scope_type: "kho",
  org_unit_id: null,
  org_unit_name: null,
  department_id: null,
  department_name: null,
  warehouse_id: 20,
  warehouse_name: "Kho chính",
};

function LoginHarness() {
  const login = useLogin();
  return (
    <>
      <button
        type="button"
        onClick={() => login.mutate({ email: EMAIL, password: PASSWORD })}
      >
        Login
      </button>
      {login.isError ? <div>Login failed</div> : null}
    </>
  );
}

function renderHarness(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: ROUTES.LOGIN,
            state: { from: { pathname: ROUTES.INBOUND, search: "?status=DRAFT" } },
          },
        ]}
      >
        {children}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("useLogin WWHN-165", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true });
  });

  it("khôi phục protected URL sau login một context", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "Bearer",
      expires_in: 3600,
      available_contexts: [CONTEXT],
      user: { id: 1, name: "Quang", email: EMAIL, code: "HN-FE-01" },
    });

    renderHarness(
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginHarness />} />
        <Route path={ROUTES.INBOUND} element={<div>Inbound restored</div>} />
      </Routes>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Inbound restored")).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe("access-token");
    expect(useAuthStore.getState().currentContext).toBeNull();
  });

  it("nhiều context: switch thất bại thì không mở shell bằng JWT trung gian", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      access_token: "intermediate-token",
      refresh_token: "refresh-token",
      token_type: "Bearer",
      expires_in: 3600,
      available_contexts: [CONTEXT, { ...CONTEXT, role_id: 11 }],
      user: { id: 1, name: "Quang", email: EMAIL, code: "HN-FE-01" },
    });
    vi.mocked(authService.switchContext).mockRejectedValue(
      new Error("switch-context failed"),
    );
    vi.mocked(authService.logout).mockResolvedValue(null);

    renderHarness(
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginHarness />} />
        <Route path={ROUTES.INBOUND} element={<div>Protected shell</div>} />
      </Routes>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Login failed")).toBeInTheDocument();
    await waitFor(() => expect(authService.switchContext).toHaveBeenCalled());
    expect(screen.queryByText("Protected shell")).not.toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("nhiều context: chỉ commit token cuối sau switch thành công", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      access_token: "intermediate-token",
      refresh_token: "refresh-token",
      token_type: "Bearer",
      expires_in: 3600,
      available_contexts: [CONTEXT, { ...CONTEXT, role_id: 11 }],
      user: { id: 1, name: "Quang", email: EMAIL, code: "HN-FE-01" },
    });
    vi.mocked(authService.switchContext).mockResolvedValue({
      access_token: "context-token",
      token_type: "Bearer",
      expires_in: 3600,
    });

    renderHarness(
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginHarness />} />
        <Route path={ROUTES.INBOUND} element={<div>Protected shell</div>} />
      </Routes>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Protected shell")).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe("context-token");
    expect(useAuthStore.getState().isProfileLoaded).toBe(false);
  });
});
