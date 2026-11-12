import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  });
});
