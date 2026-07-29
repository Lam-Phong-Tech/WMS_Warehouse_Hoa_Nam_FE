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
  },
}));

const TEST_LOGIN_EMAIL = "operator@hoanam.test";
const TEST_LOGIN_PASSWORD = "<TEST_LOGIN_PASSWORD>";

function LoginHarness() {
  const login = useLogin();
  return (
    <button
      type="button"
      onClick={() =>
        login.mutate({ email: TEST_LOGIN_EMAIL, password: TEST_LOGIN_PASSWORD })
      }
    >
      Login
    </button>
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
            state: {
              from: {
                pathname: ROUTES.INBOUND,
                search: "?status=DRAFT",
                hash: "#scan",
              },
            },
          },
        ]}
      >
        {children}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("useLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true });
  });

  it("khôi phục URL protected route sau khi đăng nhập thành công", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      access_token: "access-token",
      token_type: "Bearer",
      expires_in: 3600,
      available_contexts: [],
      user: {
        id: 1,
        name: "Quang Nguyen",
        email: TEST_LOGIN_EMAIL,
        code: "HN-FE-01",
      },
    });

    renderHarness(
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginHarness />} />
        <Route
          path={ROUTES.INBOUND}
          element={<div>Inbound route restored</div>}
        />
      </Routes>,
    );

    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(
      await screen.findByText("Inbound route restored"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
    expect(useAuthStore.getState().token).toBe("access-token");
  });
});
