import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import { authService } from "../services/auth.service";
import { SessionConfirmationGate } from "../components/SessionConfirmationGate";
import { rememberLoginThrottle } from "../utils/login-feedback";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: {
    login: vi.fn(),
    verifyMfa: vi.fn(),
    verifyStepUp: vi.fn(),
    resendStepUp: vi.fn(),
    verifyDevice: vi.fn(),
    resendDevice: vi.fn(),
    powChallenge: vi.fn(),
    logout: vi.fn(),
  },
}));

const CONTEXT = {
  role_id: "r1",
  role_name: "SUPER_ADMIN",
  scope_type: "GLOBAL",
  org_unit_id: null,
  org_unit_name: null,
  department_id: null,
  department_name: null,
  warehouse_id: null,
  warehouse_name: null,
  context_type: null,
  context_id: null,
  scope_ref: "",
};

const AUTHENTICATED = {
  kind: "authenticated" as const,
  access_token: "access-token",
  token_type: "bearer",
  expires_in: 3600,
  available_contexts: [CONTEXT],
  user: {
    id: 1,
    name: "Operator",
    email: "operator@example.test",
    code: "HN-01",
  },
};

const CHALLENGE = {
  challenge_id: "pow-c-1",
  nonce: "0123456789abcdef0123456789abcdef",
  difficulty: 4,
  algorithm: "sha256-leading-zero-bits",
  expires_in: 120,
};

function VerifiedGate() {
  const user = useAuthStore((s) => s.user);
  const contexts = useAuthStore((s) => s.contexts);
  return user ? (
    <SessionConfirmationGate user={user} contexts={contexts} />
  ) : null;
}

function renderLogin() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route element={<VerifiedGate />}>
            <Route path={ROUTES.HOME} element={<div>Account landing</div>} />
            <Route
              path={ROUTES.DASHBOARD}
              element={<div>Dashboard home</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function submitCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "operator@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), {
    target: { value: ["Test", "Password", "2026"].join("-") },
  });
  await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
}

describe("LoginPage proof-of-work step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    rememberLoginThrottle(null);
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("solves the challenge and retries login once with the pow payload", async () => {
    vi.mocked(authService.login)
      .mockRejectedValueOnce({
        response: {
          status: 428,
          data: {
            error_code: "POW_REQUIRED",
            error: { details: { challenge: CHALLENGE } },
          },
        },
      })
      .mockResolvedValueOnce(AUTHENTICATED);
    renderLogin();
    await submitCredentials();
    expect(
      await screen.findByText(/đang xác minh thiết bị/i),
    ).toBeInTheDocument();
    await waitFor(() => expect(authService.login).toHaveBeenCalledTimes(2));
    expect(vi.mocked(authService.login).mock.calls[1][0].pow).toEqual({
      challenge_id: CHALLENGE.challenge_id,
      solution: expect.any(Number),
    });
  });

  it("falls back once with pow_supported=false when the worker is unavailable", async () => {
    vi.stubGlobal("Worker", undefined);
    vi.mocked(authService.login)
      .mockRejectedValueOnce({
        response: {
          status: 428,
          data: {
            error_code: "POW_REQUIRED",
            error: { details: { challenge: CHALLENGE } },
          },
        },
      })
      .mockResolvedValueOnce(AUTHENTICATED);
    renderLogin();
    await submitCredentials();
    await waitFor(() => expect(authService.login).toHaveBeenCalledTimes(2));
    expect(vi.mocked(authService.login).mock.calls[1][0].pow_supported).toBe(
      false,
    );
  });
});
