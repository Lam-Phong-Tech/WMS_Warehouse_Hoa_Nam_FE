import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { authService } from "../services/auth.service";
vi.mock("@/modules/auth/services/auth.service", () => ({ authService: { forgotPassword: vi.fn(), verifyOtp: vi.fn(), resetPassword: vi.fn() } }));
const EMAIL = "operator@example.test";
const TEST_PASSWORD = ["Uat", "Reset", "42", "!"].join("-");
async function goToOtpStep(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(authService.forgotPassword).mockResolvedValue(null);
  await user.type(screen.getByLabelText(/email/i), EMAIL);
  await user.click(screen.getByRole("button", { name: /gửi mã otp/i }));
  await screen.findByLabelText(/mã otp/i);
}
async function goToPasswordStep(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(authService.verifyOtp).mockResolvedValue({ reset_token: "reset-token-abc", expires_in: 600 });
  await goToOtpStep(user);
  await user.type(screen.getByLabelText(/mã otp/i), "123456");
  await user.click(screen.getByRole("button", { name: /xác nhận/i }));
  await screen.findByLabelText(/^mật khẩu mới$/i);
}
describe("TC_UI_LOGIN_10 — recovery UI without breaking the existing OTP API", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });
  it("sends the supported email OTP request; never pretends to send a reset link", async () => {
    const user = userEvent.setup(); renderWithProviders(<ForgotPasswordPage />);
    await goToOtpStep(user);
    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: EMAIL });
    expect(screen.getByRole("button", { name: /xác nhận/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gửi liên kết/i })).not.toBeInTheDocument();
  });
  it("keeps the OTP step on an invalid verification code", async () => {
    vi.mocked(authService.verifyOtp).mockRejectedValue({ isAxiosError: true, response: { status: 422 } });
    const user = userEvent.setup(); renderWithProviders(<ForgotPasswordPage />);
    await goToOtpStep(user);
    await user.type(screen.getByLabelText(/mã otp/i), "000000");
    await user.click(screen.getByRole("button", { name: /xác nhận/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^mật khẩu mới$/i)).not.toBeInTheDocument();
  });
  it("shows the reset title and saves only with a server-verified reset token", async () => {
    vi.mocked(authService.resetPassword).mockResolvedValue(null);
    const user = userEvent.setup(); renderWithProviders(<ForgotPasswordPage />);
    await goToPasswordStep(user);
    expect(screen.getByRole("heading", { name: "Đặt lại mật khẩu" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^mật khẩu mới$/i), TEST_PASSWORD);
    await user.type(screen.getByLabelText(/xác nhận mật khẩu mới/i), TEST_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu" }));
    await waitFor(() => expect(authService.resetPassword).toHaveBeenCalledWith({ email: EMAIL, reset_token: "reset-token-abc",
      new_password: TEST_PASSWORD, new_password_confirmation: TEST_PASSWORD }));
  });
  it("rejects mismatching confirmation without a reset request", async () => {
    const user = userEvent.setup(); renderWithProviders(<ForgotPasswordPage />);
    await goToPasswordStep(user);
    await user.type(screen.getByLabelText(/^mật khẩu mới$/i), TEST_PASSWORD);
    await user.type(screen.getByLabelText(/xác nhận mật khẩu mới/i), `${TEST_PASSWORD}different`);
    await user.click(screen.getByRole("button", { name: "Lưu mật khẩu" }));
    expect(await screen.findByText(/mật khẩu xác nhận không khớp/i)).toBeInTheDocument();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });
  it("preserves OTP expiry/resend behaviour", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    renderWithProviders(<ForgotPasswordPage />); await goToOtpStep(user);
    expect(screen.queryByRole("button", { name: /gửi lại mã otp/i })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60 * 1000); });
    expect(await screen.findByRole("button", { name: /gửi lại mã otp/i })).toBeInTheDocument();
  });
});
