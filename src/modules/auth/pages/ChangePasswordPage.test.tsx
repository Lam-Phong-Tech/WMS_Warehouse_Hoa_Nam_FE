import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { createMockAxiosError } from "@/shared/api/api-error";
import { useAuthStore } from "@/shared/store/auth.store";
import { profileFixture } from "./profile.fixture";
import { ChangePasswordPage } from "./ChangePasswordPage";
import { authService } from "../services/auth.service";

vi.mock("../services/auth.service", () => ({
  authService: { changePassword: vi.fn() },
}));

function fillForm(values: {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
}) {
  fireEvent.change(screen.getByLabelText(/^Mật khẩu hiện tại/), {
    target: { value: values.currentPassword },
  });
  fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/), {
    target: { value: values.newPassword },
  });
  fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu mới/), {
    target: { value: values.newPasswordConfirmation },
  });
}

describe("ChangePasswordPage", () => {
  beforeAll(ensureEnglishMessages);
  afterEach(() => act(() => useLanguageStore.getState().setLanguage("vi")));
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: "change-password-test",
      user: {
        ...profileFixture,
        username: "u-11a24255-3967-4dd5-b3ca-2178b714ec5c",
        email: "danghong2003@example.test",
      },
      profile: profileFixture,
      isAuthenticated: true,
      isProfileLoaded: true,
      permissionCodes: [],
      isSuperAdmin: false,
      currentContext: null,
    });
  });

  it("updates already visible client validation when the language changes", async () => {
    renderWithProviders(<ChangePasswordPage />);
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
    expect(
      await screen.findByText("Vui lòng nhập mật khẩu hiện tại"),
    ).toBeInTheDocument();
    act(() => useLanguageStore.getState().setLanguage("en"));
    expect(
      await screen.findByText("Please enter your current password"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Vui lòng nhập mật khẩu hiện tại"),
    ).not.toBeInTheDocument();
    act(() => useLanguageStore.getState().setLanguage("vi"));
    expect(
      await screen.findByText("Vui lòng nhập mật khẩu hiện tại"),
    ).toBeInTheDocument();
  });

  it("keeps new password inputs at 64 characters", () => {
    renderWithProviders(<ChangePasswordPage />);

    expect(screen.getByLabelText(/^Mật khẩu mới/)).toHaveAttribute(
      "maxlength",
      "64",
    );
    expect(screen.getByLabelText(/^Xác nhận mật khẩu mới/)).toHaveAttribute(
      "maxlength",
      "64",
    );
  });

  it("puts a server confirmation error under the confirmation input", async () => {
    const message = "Mật khẩu xác nhận không khớp với mật khẩu mới";
    vi.mocked(authService.changePassword).mockRejectedValue(
      createMockAxiosError({
        status: 422,
        data: {
          message,
          errors: { new_password_confirmation: [message] },
        },
      }),
    );

    renderWithProviders(<ChangePasswordPage />);
    fillForm({
      currentPassword: "Strong#Pass2026",
      newPassword: "Another#Pass2026",
      newPasswordConfirmation: "Another#Pass2026",
    });
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

    const confirmation = screen.getByLabelText(/^Xác nhận mật khẩu mới/);
    await waitFor(() =>
      expect(confirmation).toHaveAttribute("aria-invalid", "true"),
    );
    const helperId = confirmation
      .getAttribute("aria-describedby")
      ?.split(" ")
      .find((id) =>
        document.getElementById(id)?.textContent?.includes(message),
      );
    expect(helperId).toBeDefined();
    act(() => useLanguageStore.getState().setLanguage("en"));
    expect(
      await screen.findByText(
        "Password confirmation does not match",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    act(() => useLanguageStore.getState().setLanguage("vi"));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
