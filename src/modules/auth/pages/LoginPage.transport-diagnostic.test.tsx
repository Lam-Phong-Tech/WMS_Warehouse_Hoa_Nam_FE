import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import { authService } from "../services/auth.service";
import { rememberLoginThrottle } from "../utils/login-feedback";
import { useAuthStore } from "@/shared/store/auth.store";
vi.unmock("axios");
vi.mock("@/modules/auth/services/auth.service", () => ({ authService: { login: vi.fn(), verifyMfa: vi.fn() } }));
function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><LoginPage /></MemoryRouter></QueryClientProvider>);
}
async function fill() {
  await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "operator@example.test");
  await userEvent.type(screen.getByLabelText("Mật khẩu"), ["Test", "Password", "2026"].join("-"));
}
const failure = (status: number, data: unknown = {}, headers: unknown = {}) => ({
  isAxiosError: true, response: { status, data, headers }, message: "INTERNAL_DIAGNOSTIC",
});
describe("AUTH UAT — transport banners, no diagnostic leaks and no password replay", () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); rememberLoginThrottle(null);
    useAuthStore.getState().logout(); useAuthStore.setState({ isBootstrapped: true });
  });
  afterEach(() => { vi.restoreAllMocks(); rememberLoginThrottle(null); });
  it.each([failure(500), failure(503), { isAxiosError: true, code: "ERR_NETWORK", message: "ERR_NETWORK/network", wmsTransport: { summary: "PRIVATE_TECHNICAL_DETAILS" } }])
    ("TC_UI_LOGIN_08: shows the service banner and retry, without automatically resending", async (error) => {
      vi.mocked(authService.login).mockRejectedValue(error);
      renderLogin(); await fill(); await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Chưa thể đăng nhập lúc này");
      expect(alert).toHaveTextContent("Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.");
      expect(screen.getByRole("button", { name: "Thử lại" })).toBeEnabled();
      expect(document.body).not.toHaveTextContent(/ERR_NETWORK|PRIVATE_TECHNICAL_DETAILS|INTERNAL_DIAGNOSTIC|probe:/);
      expect(screen.queryByTestId("login-transport-diagnostic")).not.toBeInTheDocument();
      expect(authService.login).toHaveBeenCalledTimes(1);
    });
  it("TC_VAL_01: puts the credentials banner between password and forgot password", async () => {
    vi.mocked(authService.login).mockRejectedValue(failure(401, { message: "different backend wording" }));
    renderLogin(); await fill(); await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Tên đăng nhập hoặc mật khẩu chưa đúng");
    expect(screen.getByLabelText("Mật khẩu").compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alert.compareDocumentPosition(screen.getByRole("link", { name: /quên mật khẩu/i })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("TC_UI_LOGIN_03: keeps fields and prevents double-submit while showing the pending button", async () => {
    vi.mocked(authService.login).mockReturnValue(new Promise(() => {}));
    renderLogin(); await fill();
    const field = screen.getByLabelText("Tên đăng nhập");
    const form = field.closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(await screen.findByRole("button", { name: "Đang đăng nhập…" })).toBeDisabled();
    await waitFor(() => expect(authService.login).toHaveBeenCalledTimes(1));
    expect(field).toHaveValue("operator@example.test");
    expect(screen.queryByText(/đang xác thực tài khoản/i)).not.toBeInTheDocument();
  });
  it("TC_UI_LOGIN_04: detects offline without queuing credentials", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    renderLogin(); await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Không có kết nối mạng");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(authService.login).not.toHaveBeenCalled();
  });
  it("TC_UI_LOGIN_05: timeout is unknown, locks the form and does not offer another login", async () => {
    vi.mocked(authService.login).mockRejectedValue({ isAxiosError: true, code: "ECONNABORTED" });
    renderLogin(); await fill(); await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa xác định được kết quả đăng nhập");
    expect(screen.getByLabelText("Tên đăng nhập")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /thử lại|đăng nhập/i })).not.toBeInTheDocument();
    fireEvent.submit(screen.getByLabelText("Tên đăng nhập").closest("form")!);
    expect(authService.login).toHaveBeenCalledTimes(1);
  });
  it("TC_UI_LOGIN_06: changing identity and Enter cannot remove an active server lock", async () => {
    vi.mocked(authService.login).mockRejectedValue(failure(429, {}, { "Retry-After": "60" }));
    renderLogin(); await fill(); await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Bạn đã thử đăng nhập quá nhiều lần");
    await userEvent.clear(screen.getByLabelText("Tên đăng nhập"));
    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "other-user");
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Tên đăng nhập").closest("form")!);
    expect(authService.login).toHaveBeenCalledTimes(1);
  });
  it("TC_UI_LOGIN_07: clears the password and returns to a clean form without another request", async () => {
    vi.mocked(authService.login).mockRejectedValue(failure(403, { error_code: "ACCESS_DENIED" }));
    renderLogin(); await fill(); await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tài khoản hiện không thể đăng nhập");
    expect(screen.getByLabelText("Mật khẩu")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Quay lại đăng nhập" }));
    expect(screen.getByLabelText("Tên đăng nhập")).toHaveValue("");
    expect(screen.getByLabelText("Tên đăng nhập")).toBeEnabled();
    expect(authService.login).toHaveBeenCalledTimes(1);
  });
});
