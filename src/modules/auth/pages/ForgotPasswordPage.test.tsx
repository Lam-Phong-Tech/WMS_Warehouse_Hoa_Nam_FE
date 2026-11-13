import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { authService } from "../services/auth.service";
import { PasswordRecoveryError } from "../services/password-recovery.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { memoryStorage } from "@/shared/lib/memory-storage";
import {
  readWorkSessionActivity,
  startWorkSession,
} from "@/shared/lib/session-idle";
import { queryClient } from "@/app/providers/query-client";
vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: {
    forgotPassword: vi.fn(),
    verifyOtp: vi.fn(),
    resetPassword: vi.fn(),
  },
}));
const EMAIL = "operator@example.test";
const TEST_PASSWORD = ["Uat", "Reset", "42", "!"].join("-");
const SERVER_PASSWORD_RULE = ["Server", "password", "rule"].join(" ");
async function goToOtpStep(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(authService.forgotPassword).mockResolvedValue(null);
  await user.type(screen.getByLabelText(/email/i), EMAIL);
  await user.click(screen.getByRole("button", { name: /gửi mã xác nhận/i }));
  await screen.findByLabelText(/^mã xác nhận \(6 chữ số\)$/i);
}
async function goToPasswordStep(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(authService.verifyOtp).mockResolvedValue({
    reset_token: "reset-token-abc",
    expires_in: 600,
  });
  await goToOtpStep(user);
  await user.type(screen.getByLabelText(/^mã xác nhận \(6 chữ số\)$/i), "123456");
  await user.click(screen.getByRole("button", { name: /xác nhận/i }));
  await screen.findByLabelText(/^mật khẩu mới$/i);
}
describe("TC_UI_LOGIN_10 — recovery UI without breaking the existing OTP API", () => {
  beforeEach(() => {
    useLanguageStore.getState().setLanguage("vi");
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    act(() => useLanguageStore.getState().setLanguage("vi"));
  });
  it("returns to sign in from the account step without submitting recovery", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<h1>Sign-in destination</h1>} />
      </Routes>,
      ["/forgot-password"],
    );
    const back = screen.getByRole("link", { name: "Quay lại đăng nhập" });
    expect(back).toHaveAttribute("href", "/login");
    await user.click(back);
    expect(screen.getByRole("heading", { name: "Sign-in destination" })).toBeInTheDocument();
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });
  it("updates visible recovery validation after switching language", async () => {
    await ensureEnglishMessages();
    renderWithProviders(<ForgotPasswordPage />);
    fireEvent.submit(screen.getByLabelText(/email/i).closest("form")!);
    expect(await screen.findByText("Vui lòng nhập email")).toBeInTheDocument();
    act(() => useLanguageStore.getState().setLanguage("en"));
    expect(
      await screen.findByText("Please enter your email"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Vui lòng nhập email")).not.toBeInTheDocument();
  });
  it("sends the supported email OTP request; never pretends to send a reset link", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await goToOtpStep(user);
    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: EMAIL });
    expect(
      screen.getByRole("button", { name: /xác nhận/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /gửi liên kết/i }),
    ).not.toBeInTheDocument();
  });
  it("keeps the OTP step on an invalid verification code", async () => {
    vi.mocked(authService.verifyOtp).mockRejectedValue(
      new PasswordRecoveryError("otp", "otp-request-1"),
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await goToOtpStep(user);
    await user.type(screen.getByLabelText(/^mã xác nhận \(6 chữ số\)$/i), "000000");
    await user.click(screen.getByRole("button", { name: /xác nhận/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^mật khẩu mới$/i)).not.toBeInTheDocument();
  });
  it("shows the reset title and saves only with a server-verified reset token", async () => {
    vi.mocked(authService.resetPassword).mockResolvedValue(null);
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await goToPasswordStep(user);
    expect(
      screen.getByRole("heading", { name: "Đặt mật khẩu mới" }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^mật khẩu mới$/i), TEST_PASSWORD);
    await user.type(
      screen.getByLabelText(/xác nhận mật khẩu mới/i),
      TEST_PASSWORD,
    );
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu mới" }));
    await waitFor(() =>
      expect(authService.resetPassword).toHaveBeenCalledWith({
        email: EMAIL,
        reset_token: "reset-token-abc",
        new_password: TEST_PASSWORD,
        new_password_confirmation: TEST_PASSWORD,
      }),
    );
    expect(await screen.findByRole("heading", { name: "Đặt lại mật khẩu thành công" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng nhập bằng mật khẩu mới" })).toBeInTheDocument();
  });
  it("rejects mismatching confirmation without a reset request", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await goToPasswordStep(user);
    await user.type(screen.getByLabelText(/^mật khẩu mới$/i), TEST_PASSWORD);
    await user.type(
      screen.getByLabelText(/xác nhận mật khẩu mới/i),
      `${TEST_PASSWORD}different`,
    );
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu mới" }));
    expect(
      await screen.findByText(/mật khẩu xác nhận không khớp/i),
    ).toBeInTheDocument();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });
  it("preserves OTP expiry/resend behaviour", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    renderWithProviders(<ForgotPasswordPage />);
    await goToOtpStep(user);
    expect(
      screen.getByRole("button", { name: /gửi lại mã/i }),
    ).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    expect(
      await screen.findByRole("button", { name: /gửi mã mới/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^mã xác nhận \(6 chữ số\)$/i)).toBeDisabled();
  });
  it("normalizes email and uses a generic delivery notice", async () => {
    vi.mocked(authService.forgotPassword).mockResolvedValue(null);
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await user.type(
      screen.getByLabelText(/email/i),
      "  Operator@Example.TEST  ",
    );
    await user.click(screen.getByRole("button", { name: /gửi mã xác nhận/i }));
    await screen.findByLabelText(/^mã xác nhận \(6 chữ số\)$/i);
    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: EMAIL });
    expect(screen.getByText(/nếu tài khoản hợp lệ/i)).toBeInTheDocument();
  });
  it("locks 429 until Retry-After expires without replaying the request", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(authService.forgotPassword).mockRejectedValue(
      new PasswordRecoveryError(
        "rate-limit",
        "request-throttle",
        Date.now() + 60000,
      ),
    );
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    renderWithProviders(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText(/email/i), EMAIL);
    await user.click(screen.getByRole("button", { name: /gửi mã xác nhận/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "request-throttle",
    );
    expect(screen.getByRole("button", { name: /gửi mã xác nhận/i })).toBeDisabled();
    await user.clear(screen.getByLabelText(/email/i));
    expect(screen.getByRole("button", { name: /gửi mã xác nhận/i })).toBeDisabled();
    await act(async () => vi.advanceTimersByTimeAsync(61000));
    await user.type(screen.getByLabelText(/email/i), EMAIL);
    expect(screen.getByRole("button", { name: /gửi mã xác nhận/i })).toBeEnabled();
    expect(authService.forgotPassword).toHaveBeenCalledTimes(1);
  });
  it("keeps an unknown 429 locked rather than inventing a timeout", async () => {
    vi.mocked(authService.forgotPassword).mockRejectedValue(
      new PasswordRecoveryError("rate-limit"),
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText(/email/i), EMAIL);
    await user.click(screen.getByRole("button", { name: /gửi mã xác nhận/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /chờ rồi tải lại/i,
    );
    expect(screen.getByRole("button", { name: /gửi mã xác nhận/i })).toBeDisabled();
  });
  it("requires a new code after five invalid OTPs and clears the previous code on resend", async () => {
    vi.mocked(authService.verifyOtp).mockRejectedValue(
      new PasswordRecoveryError("otp"),
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await goToOtpStep(user);
    await user.type(screen.getByLabelText(/^mã xác nhận \(6 chữ số\)$/i), "000000");
    for (let attempt = 1; attempt <= 5; attempt++) {
      await user.click(screen.getByRole("button", { name: /^xác nhận mã$/i }));
      await waitFor(() =>
        expect(authService.verifyOtp).toHaveBeenCalledTimes(attempt),
      );
    }
    expect(screen.getByLabelText(/^mã xác nhận \(6 chữ số\)$/i)).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /^xác nhận mã$/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /gửi lại mã/i }));
    await waitFor(() => expect(screen.getByLabelText(/^mã xác nhận \(6 chữ số\)$/i)).toBeEnabled());
    expect(screen.getByLabelText(/^mã xác nhận \(6 chữ số\)$/i)).toHaveValue("");
    expect(authService.forgotPassword).toHaveBeenCalledTimes(2);
  });
  it("expires the reset token in memory and prevents further password submissions", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    renderWithProviders(<ForgotPasswordPage />);
    await goToPasswordStep(user);
    await user.type(screen.getByLabelText(/^mật khẩu mới$/i), TEST_PASSWORD);
    await act(async () => vi.advanceTimersByTimeAsync(601000));
    expect(screen.getByRole("heading", { name: "Yêu cầu khôi phục không còn hiệu lực" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^mật khẩu mới$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yêu cầu mã mới/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lưu mật khẩu mới" }),
    ).not.toBeInTheDocument();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });
  it("keeps a valid reset token after server password validation", async () => {
    vi.mocked(authService.resetPassword)
      .mockRejectedValueOnce(
        new PasswordRecoveryError("validation", "reset-request", null, {
          new_password: SERVER_PASSWORD_RULE,
        }),
      )
      .mockResolvedValue(null);
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await goToPasswordStep(user);
    await user.type(screen.getByLabelText(/^mật khẩu mới$/i), TEST_PASSWORD);
    await user.type(
      screen.getByLabelText(/xác nhận mật khẩu mới/i),
      TEST_PASSWORD,
    );
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu mới" }));
    expect(await screen.findByText(SERVER_PASSWORD_RULE)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu mới" }));
    await waitFor(() =>
      expect(authService.resetPassword).toHaveBeenCalledTimes(2),
    );
    expect(
      vi.mocked(authService.resetPassword).mock.calls[1][0].reset_token,
    ).toBe("reset-token-abc");
  });
  it("keeps the current step on service failure and never retries in the background", async () => {
    vi.mocked(authService.verifyOtp).mockRejectedValue(
      new PasswordRecoveryError("unavailable", "service-request"),
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await goToOtpStep(user);
    await user.type(screen.getByLabelText(/^mã xác nhận \(6 chữ số\)$/i), "123456");
    await user.click(screen.getByRole("button", { name: /^xác nhận mã$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "service-request",
    );
    expect(screen.getByLabelText(/^mã xác nhận \(6 chữ số\)$/i)).toBeInTheDocument();
    expect(authService.verifyOtp).toHaveBeenCalledTimes(1);
  });
  it("does not restore the reset token or OTP after remount", async () => {
    const user = userEvent.setup();
    const first = renderWithProviders(<ForgotPasswordPage />);
    await goToPasswordStep(user);
    expect(JSON.stringify(window.localStorage)).not.toContain(
      "reset-token-abc",
    );
    expect(JSON.stringify(window.sessionStorage)).not.toContain(
      "reset-token-abc",
    );
    first.unmount();
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByLabelText(/email/i)).toHaveValue("");
    expect(screen.queryByLabelText(/^mật khẩu mới$/i)).not.toBeInTheDocument();
  });
  it("clears the authenticated identity, memory token, work session and cached data after a successful reset", async () => {
    vi.mocked(authService.resetPassword).mockResolvedValue(null);
    useAuthStore
      .getState()
      .setAuth({
        token: "previous-access",
        user: { id: 1, name: "Operator", email: EMAIL, code: "TEST" },
      });
    startWorkSession();
    queryClient.setQueryData(["private-recovery-test"], { private: true });
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await goToPasswordStep(user);
    await user.type(screen.getByLabelText(/^mật khẩu mới$/i), TEST_PASSWORD);
    await user.type(
      screen.getByLabelText(/xác nhận mật khẩu mới/i),
      TEST_PASSWORD,
    );
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu mới" }));
    await waitFor(() =>
      expect(useAuthStore.getState().isAuthenticated).toBe(false),
    );
    expect(useAuthStore.getState().user).toBeNull();
    expect(memoryStorage.getToken()).toBeNull();
    expect(readWorkSessionActivity()).toBeNull();
    expect(queryClient.getQueryData(["private-recovery-test"])).toBeUndefined();
  });
});
