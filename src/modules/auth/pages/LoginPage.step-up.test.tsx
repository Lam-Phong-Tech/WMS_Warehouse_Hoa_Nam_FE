import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("LoginPage step-up verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    rememberLoginThrottle(null);
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true });
  });

  it("shows the step-up panel without publishing a token", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      kind: "step_up_required",
      step_up_required: true,
      step_up_token: "s",
      method: "email",
      masked_email: "a***@b.test",
      expires_in: 300,
    });
    renderLogin();
    await submitCredentials();
    expect(
      await screen.findByText(/xác minh thiết bị/i),
    ).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("verifies the step-up code, waits for explicit Continue sign in, and submits step_up_token", async () => {
    vi.mocked(authService.login)
      .mockResolvedValueOnce({
        kind: "step_up_required",
        step_up_required: true,
        step_up_token: "step-tok-1",
        method: "email",
        masked_email: "a***@b.test",
        expires_in: 300,
      })
      .mockResolvedValueOnce(AUTHENTICATED);
    vi.mocked(authService.verifyStepUp).mockResolvedValue({
      step_up_verified: true,
      password_attempts_left: 3,
      expires_in: 300,
    });

    renderLogin();
    await submitCredentials();

    const inputs = await screen.findAllByRole("textbox", {
      name: /^Mã xác minh [1-6]$/,
    });
    for (const [index, digit] of "123456".split("").entries()) {
      await userEvent.type(inputs[index], digit);
    }
    await userEvent.click(screen.getByRole("button", { name: /xác nhận mã/i }));

    await waitFor(() =>
      expect(authService.verifyStepUp).toHaveBeenCalledWith(
        "step-tok-1",
        "123456",
      ),
    );
    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBeNull();

    const continueBtn = await screen.findByRole("button", {
      name: /tiếp tục đăng nhập/i,
    });
    await userEvent.click(continueBtn);

    await waitFor(() => expect(authService.login).toHaveBeenCalledTimes(2));
    expect(vi.mocked(authService.login).mock.calls[1][0]).toMatchObject({
      email: "operator@example.test",
      step_up_token: "step-tok-1",
    });
    expect(useAuthStore.getState().token).toBe("access-token");
  });
});
