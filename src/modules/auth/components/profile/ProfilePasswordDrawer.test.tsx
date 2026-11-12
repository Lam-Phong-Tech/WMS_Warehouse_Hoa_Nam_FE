import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { useAuthStore } from "@/shared/store/auth.store";
import { createMockAxiosError } from "@/shared/api/api-error";
import { profileFixture } from "../../pages/profile.fixture";
import { authService } from "../../services/auth.service";
import { ProfilePasswordDrawer } from "./ProfilePasswordDrawer";

vi.mock("../../services/auth.service", () => ({
  authService: { changePassword: vi.fn() },
}));

const CURRENT_PASSWORD = ["Wrong", "Pass", "2026"].join("#");
const NEW_PASSWORD = ["Another", "Pass", "2026"].join("#");

function fillDrawer(values: {
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

describe("ProfilePasswordDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: "password-drawer-test",
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

  it("validates against the signed-in account and caps inputs at 64 characters", async () => {
    renderWithProviders(<ProfilePasswordDrawer onClose={vi.fn()} />);

    expect(screen.getByLabelText(/^Mật khẩu mới/)).toHaveAttribute(
      "maxlength",
      "64",
    );
    expect(screen.getByLabelText(/^Xác nhận mật khẩu mới/)).toHaveAttribute(
      "maxlength",
      "64",
    );

    fillDrawer({
      currentPassword: "Strong#Pass2026",
      newPassword: "Danghong2003@123",
      newPasswordConfirmation: "Danghong2003@123",
    });
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

    expect(
      await screen.findByText("Mật khẩu mới không được chứa tên đăng nhập"),
    ).toBeInTheDocument();
    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  it("puts a server field error under its input without a duplicate banner", async () => {
    vi.mocked(authService.changePassword).mockRejectedValue(
      createMockAxiosError({
        status: 422,
        data: {
          message: "Thông tin đổi mật khẩu không hợp lệ.",
          errors: {
            current_password: ["Mật khẩu hiện tại không chính xác"],
          },
        },
      }),
    );

    renderWithProviders(<ProfilePasswordDrawer onClose={vi.fn()} />);
    fillDrawer({
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      newPasswordConfirmation: NEW_PASSWORD,
    });
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

    expect(
      await screen.findByText("Mật khẩu hiện tại không chính xác"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(authService.changePassword).mock.calls[0]?.[0]).toEqual({
        current_password: CURRENT_PASSWORD,
        new_password: NEW_PASSWORD,
        new_password_confirmation: NEW_PASSWORD,
      }),
    );
    expect(
      screen.queryByText("Thông tin đổi mật khẩu không hợp lệ."),
    ).not.toBeInTheDocument();
  });
});
