import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
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
  beforeAll(async () => {
    await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
  });
  afterEach(() => act(() => useLanguageStore.getState().setLanguage("vi")));
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

  it.each(["en", "zh"] as const)(
    "updates already visible client validation when the language changes to %s",
    async (language) => {
      renderWithProviders(<ProfilePasswordDrawer onClose={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
      expect(
        await screen.findByText("Vui lòng nhập mật khẩu hiện tại"),
      ).toBeInTheDocument();
      act(() => useLanguageStore.getState().setLanguage(language));
      expect(
        await screen.findByText(
          language === "zh"
            ? "请输入您当前的密码"
            : "Please enter your current password",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          language === "zh" ? "请输入新密码" : "Please enter your new password",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          language === "zh" ? "请确认密码" : "Please confirm the password",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Vui lòng nhập mật khẩu hiện tại"),
      ).not.toBeInTheDocument();
      act(() => useLanguageStore.getState().setLanguage("vi"));
      expect(
        await screen.findByText("Vui lòng nhập mật khẩu hiện tại"),
      ).toBeInTheDocument();
    },
  );

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
    act(() => useLanguageStore.getState().setLanguage("en"));
    expect(
      await screen.findByText("The current password is incorrect."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Mật khẩu hiện tại không chính xác"),
    ).not.toBeInTheDocument();
    act(() => useLanguageStore.getState().setLanguage("vi"));
    expect(
      await screen.findByText("Mật khẩu hiện tại không chính xác"),
    ).toBeInTheDocument();
  });
});
