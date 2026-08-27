import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { ForgotPasswordPage } from "@/modules/auth/pages/ForgotPasswordPage";
import { authService } from "@/modules/auth/services/auth.service";

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: {
    forgotPassword: vi.fn(),
    verifyOtp: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

const EMAIL = "nhanvien@gmail.com";
const NEW_PASSWORD_INPUT = "NewCntt@2026";

async function goToOtpStep(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(authService.forgotPassword).mockResolvedValue(null);
  await user.type(screen.getByLabelText(/email/i), EMAIL);
  await user.click(screen.getByRole("button", { name: /gửi mã otp/i }));
  await screen.findByLabelText(/mã otp/i);
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gửi OTP rồi chuyển sang bước nhập mã", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await goToOtpStep(user);

    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: EMAIL });
    expect(
      screen.getByRole("button", { name: /xác nhận/i }),
    ).toBeInTheDocument();
  });

  it("OTP sai hiển thị lỗi và không chuyển bước", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.verifyOtp).mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: "Mã OTP không đúng hoặc đã hết hạn." } },
    });
    renderWithProviders(<ForgotPasswordPage />);
    await goToOtpStep(user);

    await user.type(screen.getByLabelText(/mã otp/i), "000000");
    await user.click(screen.getByRole("button", { name: /xác nhận/i }));

    expect(
      await screen.findByText(/mã otp không đúng hoặc đã hết hạn/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/mật khẩu mới/i)).not.toBeInTheDocument();
  });

  it("OTP đúng chuyển sang bước đặt mật khẩu mới và gọi resetPassword đúng payload", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.verifyOtp).mockResolvedValue({
      reset_token: "reset-token-abc",
      expires_in: 600,
    });
    vi.mocked(authService.resetPassword).mockResolvedValue(null);
    renderWithProviders(<ForgotPasswordPage />);
    await goToOtpStep(user);

    await user.type(screen.getByLabelText(/mã otp/i), "123456");
    await user.click(screen.getByRole("button", { name: /xác nhận/i }));

    await screen.findByLabelText(/^mật khẩu mới$/i);

    await user.type(screen.getByLabelText(/^mật khẩu mới$/i), NEW_PASSWORD_INPUT);
    await user.type(
      screen.getByLabelText(/xác nhận mật khẩu mới/i),
      NEW_PASSWORD_INPUT,
    );
    await user.click(screen.getByRole("button", { name: /đặt lại mật khẩu/i }));

    expect(authService.resetPassword).toHaveBeenCalledWith({
      email: EMAIL,
      reset_token: "reset-token-abc",
      new_password: NEW_PASSWORD_INPUT,
      new_password_confirmation: NEW_PASSWORD_INPUT,
    });
  });

  it("mật khẩu xác nhận không khớp báo lỗi, không gọi resetPassword", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.verifyOtp).mockResolvedValue({
      reset_token: "reset-token-abc",
      expires_in: 600,
    });
    renderWithProviders(<ForgotPasswordPage />);
    await goToOtpStep(user);
    await user.type(screen.getByLabelText(/mã otp/i), "123456");
    await user.click(screen.getByRole("button", { name: /xác nhận/i }));
    await screen.findByLabelText(/^mật khẩu mới$/i);

    await user.type(screen.getByLabelText(/^mật khẩu mới$/i), "NewCntt@2026");
    await user.type(
      screen.getByLabelText(/xác nhận mật khẩu mới/i),
      "KhacHan@2026",
    );
    await user.click(screen.getByRole("button", { name: /đặt lại mật khẩu/i }));

    expect(
      await screen.findByText(/mật khẩu xác nhận không khớp/i),
    ).toBeInTheDocument();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it("hiện nút 'Gửi lại mã OTP' sau khi mã hết hạn, không hiện trước đó", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    vi.mocked(authService.forgotPassword).mockResolvedValue(null);
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/email/i), EMAIL);
    await user.click(screen.getByRole("button", { name: /gửi mã otp/i }));
    await screen.findByLabelText(/mã otp/i);

    expect(
      screen.queryByRole("button", { name: /gửi lại mã otp/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(
      await screen.findByRole("button", { name: /gửi lại mã otp/i }),
    ).toBeInTheDocument();
  });
});
