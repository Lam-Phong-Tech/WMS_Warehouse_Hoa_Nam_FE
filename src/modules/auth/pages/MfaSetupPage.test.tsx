import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MfaSetupPage } from "@/modules/auth/pages/MfaSetupPage";
import { authService } from "@/modules/auth/services/auth.service";

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: {
    mfaStatus: vi.fn(),
    mfaEnroll: vi.fn(),
    mfaConfirm: vi.fn(),
    mfaDisable: vi.fn(),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const SECRET = "JBSWY3DPEHPK3PXP";
const RECOVERY = ["AAAAA-11111", "BBBBB-22222"];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MfaSetupPage />
    </QueryClientProvider>,
  );
}

describe("MfaSetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    await userEvent.click(
      await screen.findByRole("button", { name: /bắt đầu đăng ký/i }),
    );

    // Bí mật hiển thị dạng chữ để người dùng nhập tay khi không quét được QR.
    expect(await screen.findByText(SECRET)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Mã xác thực"), "123456");
    await userEvent.click(
      screen.getByRole("button", { name: /xác nhận và bật/i }),
    );

    for (const code of RECOVERY) {
      expect(await screen.findByText(code)).toBeInTheDocument();
    }
    expect(authService.mfaConfirm).toHaveBeenCalledWith("123456");
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
      // eslint-disable-next-line no-script-url
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
  });
});
