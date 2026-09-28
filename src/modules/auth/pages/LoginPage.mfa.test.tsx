import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import { authService } from "../services/auth.service";
import { SessionConfirmationGate } from "../components/SessionConfirmationGate";
import { rememberLoginThrottle } from "../utils/login-feedback";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
vi.mock("@/modules/auth/services/auth.service", () => ({ authService: { login: vi.fn(), verifyMfa: vi.fn(), logout: vi.fn() } }));
const CONTEXT = { role_id: "r1", role_name: "SUPER_ADMIN", scope_type: "GLOBAL",
  org_unit_id: null, org_unit_name: null, department_id: null, department_name: null,
  warehouse_id: null, warehouse_name: null, context_type: null, context_id: null, scope_ref: "" };
function VerifiedGate() {
  const user = useAuthStore((s) => s.user);
  const contexts = useAuthStore((s) => s.contexts);
  return user ? <SessionConfirmationGate user={user} contexts={contexts} /> : null;
}
function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[ROUTES.LOGIN]}><Routes>
    <Route path={ROUTES.LOGIN} element={<LoginPage />} />
    <Route element={<VerifiedGate />}><Route path={ROUTES.DASHBOARD} element={<div>Dashboard home</div>} /></Route>
  </Routes></MemoryRouter></QueryClientProvider>);
}
async function submitCredentials() {
  await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "operator@example.test");
  await userEvent.type(screen.getByLabelText("Mật khẩu"), ["Test", "Password", "2026"].join("-"));
  await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
}
describe("Login MFA security and AUTH-02 confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); rememberLoginThrottle(null);
    useAuthStore.getState().logout(); useAuthStore.setState({ isBootstrapped: true });
    vi.mocked(authService.login).mockResolvedValue({ kind: "mfa_required", mfa_required: true, mfa_token: "challenge-token", expires_in: 300 });
  });
  it("does not publish a token or protected content before MFA is verified", async () => {
    renderLogin(); await submitCredentials();
    expect(await screen.findAllByRole("textbox", { name: /^Mã xác thực [1-6]$/ })).toHaveLength(6);
    expect(useAuthStore.getState().token).toBeNull();
    expect(screen.queryByText("Dashboard home")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bắt đầu làm việc" })).not.toBeInTheDocument();
  });
  it("requires Start work after MFA while preserving the verified token and destination", async () => {
    vi.mocked(authService.verifyMfa).mockResolvedValue({ kind: "authenticated", access_token: "access-token",
      token_type: "bearer", expires_in: 3600, available_contexts: [CONTEXT],
      user: { id: 1, name: "Operator", email: "operator@example.test", code: "HN-01" } });
    renderLogin(); await submitCredentials();
    const fields = await screen.findAllByRole("textbox", { name: /^Mã xác thực [1-6]$/ });
    for (const [index, digit] of "123456".split("").entries()) await userEvent.type(fields[index], digit);
    await userEvent.click(screen.getByRole("button", { name: /xác nhận/i }));
    await waitFor(() => expect(authService.verifyMfa).toHaveBeenCalledWith("challenge-token", "123456"));
    const start = await screen.findByRole("button", { name: "Bắt đầu làm việc" });
    expect(useAuthStore.getState().token).toBe("access-token");
    expect(screen.queryByText("Dashboard home")).not.toBeInTheDocument();
    await userEvent.click(start);
    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
  });
});
