import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import { MemoryRouter } from "react-router-dom";

import { MfaSetupPage } from "@/modules/auth/pages/MfaSetupPage";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMfaRecoveryStore } from "@/shared/store/mfa-recovery.store";

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: {
    mfaStatus: vi.fn(),
    mfaEnroll: vi.fn(),
    mfaConfirm: vi.fn(),
    mfaDisable: vi.fn(),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,ZmFrZQ==") },
}));

const SECRET = "JBSWY3DPEHPK3PXP";
const RECOVERY = ["AAAAA-11111", "BBBBB-22222"];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MfaSetupPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MfaSetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: "test-access",
      user: {
        id: "mfa-user",
        user_id: "mfa-user",
        name: "MFA User",
        email: "mfa@example.com",
        code: "MFA",
      },
      profile: null,
      authEpoch: 1,
    });
    useMfaRecoveryStore.getState().clear();
    window.localStorage.clear();
    window.sessionStorage.clear();

    vi.mocked(authService.mfaStatus).mockResolvedValue({
      enabled: false,
      pending: false,
      required_for_role: true,
      enforced: false,
      must_enroll_now: false,
      recovery_codes_remaining: 0,
    });
    vi.mocked(authService.mfaEnroll).mockResolvedValue({
      secret: SECRET,
      otpauth_uri: `otpauth://totp/WMS:admin?secret=${SECRET}`,
      digits: 6,
      period: 30,
    });
    vi.mocked(authService.mfaConfirm).mockResolvedValue({
      recovery_codes: RECOVERY,
    });
  });

  it("đăng ký rồi xác nhận thì hiện mã khôi phục", async () => {
    renderPage();

    expect(
      screen.getByRole("link", { name: /quay lại hồ sơ/i }),
    ).toHaveAttribute("href", "/profile");

    await userEvent.click(
      await screen.findByRole("button", { name: /bắt đầu đăng ký/i }),
    );

    // Bí mật hiển thị dạng chữ để người dùng nhập tay khi không quét được QR.
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
    const qr = await screen.findByRole("img", {
      name: "Mã QR đăng ký xác thực hai bước",
    });
    expect(qr).toHaveAttribute("src", "data:image/png;base64,ZmFrZQ==");
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      `otpauth://totp/WMS:admin?secret=${SECRET}`,
      { width: 220, margin: 2 },
    );

    await userEvent.type(screen.getByLabelText("Mã xác thực"), "123456");
    await userEvent.click(
      screen.getByRole("button", { name: /xác nhận và bật/i }),
    );

    for (const code of RECOVERY) {
      expect(await screen.findByText(code)).toBeInTheDocument();
    }
    expect(authService.mfaConfirm).toHaveBeenCalledWith("123456");
    expect(
      screen.queryByRole("button", { name: /bắt đầu đăng ký/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("img", { name: "Mã QR đăng ký xác thực hai bước" }),
    ).toBeNull();
  });

  it("preserves one-time codes across fail-closed refresh revalidation, then clears on a new login", async () => {
    let finish!: (data: { recovery_codes: string[] }) => void;
    vi.mocked(authService.mfaConfirm).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /bắt đầu đăng ký/i }),
    );
    await userEvent.type(await screen.findByLabelText("Mã xác thực"), "123456");
    await userEvent.click(
      screen.getByRole("button", { name: /xác nhận và bật/i }),
    );
    view.unmount();
    await act(async () => {
      useAuthStore.getState().setToken("rotated-access-token");
      finish({ recovery_codes: RECOVERY });
      await Promise.resolve();
    });
    renderPage();
    expect(await screen.findByText(RECOVERY[0])).toBeInTheDocument();
    act(() =>
      useAuthStore.getState().setAuth({
        token: "new-login",
        user: {
          id: "mfa-user",
          user_id: "mfa-user",
          name: "MFA User",
          email: "mfa@example.com",
          code: "MFA",
        },
      }),
    );
    expect(screen.queryByText(RECOVERY[0])).toBeNull();
    expect(useMfaRecoveryStore.getState().codes).toBeNull();
  });

  /**
   * Mã khôi phục là 8 chìa khoá dự phòng vào tài khoản. Lưu chúng vào
   * localStorage "cho tiện" biến chúng thành 8 chuỗi nằm sẵn trên máy — đúng thứ
   * mà XSS tìm. Test này khoá lại điều đó, vì nếu ai thêm dòng lưu trữ thì giao
   * diện trông vẫn y hệt và không có cách nào phát hiện bằng mắt.
   */
  it("KHÔNG lưu mã khôi phục hay bí mật TOTP vào storage của trình duyệt", async () => {
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /bắt đầu đăng ký/i }),
    );
    await userEvent.type(await screen.findByLabelText("Mã xác thực"), "123456");
    await userEvent.click(
      screen.getByRole("button", { name: /xác nhận và bật/i }),
    );
    await screen.findByText(RECOVERY[0]);

    const dumped = [
      JSON.stringify({ ...window.localStorage }),
      JSON.stringify({ ...window.sessionStorage }),
    ].join("|");

    expect(dumped).not.toContain(SECRET);
    for (const code of RECOVERY) {
      expect(dumped).not.toContain(code);
    }
  });

  /**
   * WWHN-SEC-13: `otpauth_uri` là chuỗi server trả về được gắn thẳng vào href.
   * Chỉ scheme otpauth:// được phép thành liên kết — một BE bị chiếm (hoặc một
   * proxy chèn giữa) trả `javascript:` không được phép biến thành nút bấm chạy
   * script trong phiên người dùng.
   */
  it("chỉ render liên kết đăng ký khi otpauth_uri đúng scheme otpauth://", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /bắt đầu đăng ký/i }),
    );
    await screen.findByText(SECRET);
    expect(document.querySelector('a[href^="otpauth://"]')).not.toBeNull();

    vi.mocked(authService.mfaEnroll).mockResolvedValue({
      secret: SECRET,
      otpauth_uri: "javascript:alert(1)",
      digits: 6,
      period: 30,
    });
    renderPage();
    const enrollButtons = await screen.findAllByRole("button", {
      name: /bắt đầu đăng ký/i,
    });
    await userEvent.click(enrollButtons[enrollButtons.length - 1]);
    await screen.findAllByText(SECRET);

    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(
      screen.getAllByRole("img", { name: "Mã QR đăng ký xác thực hai bước" }),
    ).toHaveLength(1);
    expect(QRCode.toDataURL).toHaveBeenCalledTimes(1);
  });
});
