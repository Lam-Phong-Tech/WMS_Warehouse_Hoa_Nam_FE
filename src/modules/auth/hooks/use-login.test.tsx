import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
  role_id: "role-warehouse",
  role_name: "Quản lý kho",
  scope_type: "kho",
  org_unit_id: null,
  org_unit_name: null,
  department_id: null,
  department_name: null,
  warehouse_id: null,
  warehouse_name: "WH-HN-01",
  context_type: "WAREHOUSE",
  context_id: "WH-HN-01",
  scope_ref: "WH-HN-01",
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

function renderHarness(
  children: ReactNode,
  entry: { pathname: string; search?: string; state?: unknown } = {
    pathname: ROUTES.LOGIN,
    state: {
      from: { pathname: ROUTES.INBOUND, search: "?status=DRAFT" },
    },
  },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const LOGIN_OK = {
  // WWHN-SEC-08: login tra ve union co discriminant.
  kind: "authenticated" as const,
  access_token: "access-token",
  token_type: "bearer" as const,
  expires_in: 3600,
  available_contexts: [CONTEXT],
  user: { id: 1, name: "Quang", email: EMAIL, code: "HN-FE-01" },
};

describe("useLogin WWHN-165", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true });
  });

  // P1 bảo mật 10/09/2026: chỉ access token vào bộ nhớ JS; refresh token nằm trong
  // cookie HttpOnly nên FE không có gì để commit ngoài access token.
  it("khôi phục protected URL sau login và chỉ commit access token", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      // WWHN-SEC-08: login tra ve union co discriminant.
      kind: "authenticated" as const,
      access_token: "access-token",
      token_type: "bearer",
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
    expect(useAuthStore.getState().currentContext).toEqual(CONTEXT);
  });

  it("nhiều warehouse context không tự gửi payload role_id legacy", async () => {
    const secondContext = {
      ...CONTEXT,
      role_id: "role-warehouse-2",
      warehouse_name: "WH-HN-02",
      context_id: "WH-HN-02",
      scope_ref: "WH-HN-02",
    };
    vi.mocked(authService.login).mockResolvedValue({
      // WWHN-SEC-08: login tra ve union co discriminant.
      kind: "authenticated" as const,
      access_token: "access-token",
      token_type: "bearer",
      expires_in: 3600,
      available_contexts: [CONTEXT, secondContext],
      user: { id: 1, name: "Quang", email: EMAIL, code: "HN-FE-01" },
    });

    renderHarness(
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginHarness />} />
        <Route path={ROUTES.INBOUND} element={<div>Protected shell</div>} />
      </Routes>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Protected shell")).toBeInTheDocument();
    expect(authService.switchContext).not.toHaveBeenCalled();
    expect(useAuthStore.getState().contexts).toEqual([CONTEXT, secondContext]);
    expect(useAuthStore.getState().token).toBe("access-token");
  });

  it("khôi phục attempted URL từ ?redirect= khi phiên hết hạn giữa chừng", async () => {
    vi.mocked(authService.login).mockResolvedValue(LOGIN_OK);

    renderHarness(
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginHarness />} />
        <Route path={ROUTES.INBOUND} element={<div>Inbound restored</div>} />
      </Routes>,
      {
        pathname: ROUTES.LOGIN,
        search: `?redirect=${encodeURIComponent(`${ROUTES.INBOUND}?status=DRAFT`)}`,
      },
    );
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Inbound restored")).toBeInTheDocument();
  });

  it("từ chối ?redirect= không phải path nội bộ (chống open-redirect)", async () => {
    vi.mocked(authService.login).mockResolvedValue(LOGIN_OK);

    renderHarness(
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginHarness />} />
        <Route path={ROUTES.DASHBOARD} element={<div>Dashboard home</div>} />
        <Route path={ROUTES.INBOUND} element={<div>Inbound restored</div>} />
      </Routes>,
      {
        pathname: ROUTES.LOGIN,
        search: `?redirect=${encodeURIComponent("//evil.example.com/phish")}`,
      },
    );
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
  });

  it("login lỗi không tạo authenticated state", async () => {
    vi.mocked(authService.login).mockRejectedValue(new Error("login failed"));

    renderHarness(
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginHarness />} />
        <Route path={ROUTES.INBOUND} element={<div>Protected shell</div>} />
      </Routes>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Login failed")).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
