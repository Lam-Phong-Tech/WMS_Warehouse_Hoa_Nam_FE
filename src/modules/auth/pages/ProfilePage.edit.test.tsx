import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAxiosError } from "axios";
import { ProfilePage } from "./ProfilePage";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { profileKeys } from "../types/profile.types";
import { profileService } from "../services/profile.service";
import { authService } from "../services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { renderWithProviders } from "@/test/test-utils";
import { profileFixture as me, preferenceFixture } from "./profile.fixture";
vi.mock("@/shared/data/reference-queries", () => ({
  useWarehouseDirectory: () => ({ data: [] }),
}));
vi.mock("../components/MfaSettingsDrawer", () => ({
  MfaSettingsDrawer: () => null,
}));

describe("ProfilePage personal editing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(isAxiosError).mockReturnValue(false);
    useAuthStore.setState({
      token: "profile-test",
      user: me,
      profile: me,
      isAuthenticated: true,
      isProfileLoaded: true,
      permissionCodes: [],
      isSuperAdmin: false,
      currentContext: null,
    });
    vi.spyOn(profileService, "getMe").mockResolvedValue(me);
    vi.spyOn(profileService, "getPreferences").mockResolvedValue(
      preferenceFixture,
    );
    vi.spyOn(profileService, "getDevices").mockResolvedValue({
      data: [],
      meta: { account_session_policy: { enabled: true } },
    });
    vi.spyOn(authService, "mfaStatus").mockResolvedValue({
      enabled: false,
      pending: false,
      required_for_role: false,
      enforced: false,
      must_enroll_now: false,
      recovery_codes_remaining: 0,
    });
  });
  it("opens the profile for the retired sessions link without device navigation", async () => {
    renderWithProviders(<ProfilePage />, ["/profile?section=sessions"]);
    expect(
      await screen.findByRole("heading", { name: "Tài khoản của tôi" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("tab", { name: "Thiết bị & phiên" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Quản lý thiết bị" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Không có phiên đăng nhập khác" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Kết thúc các phiên khác" }),
    ).not.toBeInTheDocument();
  });
  it("validates phone, saves with the opening version and refreshes identity", async () => {
    const update = vi.spyOn(profileService, "updateMe").mockResolvedValue({
      ...me,
      name: "Tên mới",
      display_name: "Tên mới",
      phone: "0912345678",
      version: 4,
    });
    renderWithProviders(<ProfilePage />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    const drawer = screen.getByRole("dialog", { name: /Chỉnh sửa hồ sơ/ });
    fireEvent.change(
      await within(drawer).findByRole("textbox", { name: /Họ và tên/ }),
      { target: { value: "Tên mới" } },
    );
    fireEvent.change(
      within(drawer).getByRole("textbox", { name: /Số điện thoại/ }),
      { target: { value: "123" } },
    );
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Lưu thay đổi" }),
    );
    expect(
      await screen.findByText(/Số điện thoại phải gồm 10 chữ số/),
    ).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    fireEvent.change(
      within(drawer).getByRole("textbox", { name: /Số điện thoại/ }),
      { target: { value: "0912345678" } },
    );
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Lưu thay đổi" }),
    );
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        { display_name: "Tên mới", phone: "0912345678" },
        3,
      ),
    );
    await waitFor(() =>
      expect(useAuthStore.getState().profile?.display_name).toBe("Tên mới"),
    );
  });
  it("requires reauthentication only when email changes and keeps stale drafts", async () => {
    vi.mocked(isAxiosError).mockReturnValue(true);
    const update = vi.spyOn(profileService, "updateMe").mockRejectedValue(
      Object.assign(new Error("stale"), {
        isAxiosError: true,
        response: { status: 412 },
      }),
    );
    renderWithProviders(<ProfilePage />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    const drawer = screen.getByRole("dialog", { name: /Chỉnh sửa hồ sơ/ });
    fireEvent.change(
      await within(drawer).findByRole("textbox", { name: /Email/ }),
      {
        target: { value: "new@example.test" },
      },
    );
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Lưu thay đổi" }),
    );
    expect(update).not.toHaveBeenCalled();
    fireEvent.change(within(drawer).getByLabelText(/Mật khẩu hiện tại/), {
      target: { value: "Current!Pass" },
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Lưu thay đổi" }),
    );
    expect(
      await within(drawer).findByText(/Thông tin đã thay đổi ở nơi khác/),
    ).toBeInTheDocument();
    expect(
      await within(drawer).findByRole("textbox", { name: /Email/ }),
    ).toHaveValue("new@example.test");
    expect(
      within(drawer).getByRole("button", { name: "Lưu thay đổi" }),
    ).toBeDisabled();
    expect(useAuthStore.getState().profile?.email).toBe(me.email);
  });
  it("does not apply an old account's delayed profile save after account switch", async () => {
    let finish!: (value: typeof me) => void;
    const update = vi.spyOn(profileService, "updateMe").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderWithProviders(<ProfilePage />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    const drawer = screen.getByRole("dialog", { name: /Chỉnh sửa hồ sơ/ });
    fireEvent.change(
      await within(drawer).findByRole("textbox", { name: /Họ và tên/ }),
      { target: { value: "Old draft" } },
    );
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Lưu thay đổi" }),
    );
    await waitFor(() => expect(update).toHaveBeenCalled());
    const next = {
      ...me,
      id: "user-2",
      user_id: "user-2",
      email: "second@example.test",
      display_name: "Second account",
      name: "Second account",
    };
    vi.mocked(profileService.getMe).mockResolvedValue(next);
    await act(async () => {
      useAuthStore
        .getState()
        .setAuth({ token: "second-session", user: next, contexts: [] });
      useAuthStore.getState().setProfile(next);
      finish({
        ...me,
        display_name: "Old draft",
        name: "Old draft",
        version: 4,
      });
    });
    await waitFor(() =>
      expect(useAuthStore.getState().profile?.user_id).toBe("user-2"),
    );
    expect(useAuthStore.getState().profile?.display_name).toBe(
      "Second account",
    );
    expect(
      screen.queryByRole("dialog", { name: /Chỉnh sửa hồ sơ/ }),
    ).not.toBeInTheDocument();
  });

  it("does not let an older profile GET overwrite a successful versioned save", async () => {
    let client!: QueryClient;
    function CaptureClient() {
      client = useQueryClient();
      return null;
    }
    renderWithProviders(
      <>
        <CaptureClient />
        <ProfilePage />
      </>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    const drawer = screen.getByRole("dialog", { name: /Chỉnh sửa hồ sơ/ });
    fireEvent.change(
      await within(drawer).findByRole("textbox", { name: /Họ và tên/ }),
      { target: { value: "Canonical updated profile" } },
    );
    let finishOld!: (value: typeof me) => void;
    vi.mocked(profileService.getMe).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    let pendingRead!: Promise<unknown>;
    await act(async () => {
      pendingRead = client
        .refetchQueries({ queryKey: ["auth", "me"] })
        .catch(() => undefined);
    });
    const canonical = {
      ...me,
      display_name: "Canonical updated profile",
      name: "Canonical updated profile",
      version: (me.version ?? 1) + 1,
    };
    vi.spyOn(profileService, "updateMe").mockResolvedValue(canonical);
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Lưu thay đổi" }),
    );
    await waitFor(() =>
      expect(useAuthStore.getState().profile?.version).toBe(canonical.version),
    );
    await act(async () => {
      finishOld(me);
      await pendingRead;
    });
    expect(useAuthStore.getState().profile?.version).toBe(canonical.version);
    expect(
      client.getQueryData(["auth", "me", useAuthStore.getState().token]),
    ).toEqual(canonical);
  });

  it("does not let an older in-flight preferences GET overwrite a successful save", async () => {
    let client!: QueryClient;
    function CaptureClient() {
      client = useQueryClient();
      return null;
    }
    renderWithProviders(
      <>
        <CaptureClient />
        <ProfilePage />
      </>,
      ["/profile?section=appearance"],
    );
    await screen.findByRole("button", { name: "Tối" });
    fireEvent.click(screen.getByRole("button", { name: "Tối" }));
    let finishOld!: (value: typeof preferenceFixture) => void;
    vi.mocked(profileService.getPreferences).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    let pendingRead!: Promise<unknown>;
    await act(async () => {
      pendingRead = client
        .refetchQueries({ queryKey: profileKeys.preferences("user-1") })
        .catch(() => undefined);
    });
    const canonical = {
      ...preferenceFixture,
      version: 2,
      theme: "dark" as const,
    };
    const save = vi
      .spyOn(profileService, "updatePreferences")
      .mockResolvedValue(canonical);
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ theme: "dark", accent: "ocean" }, 1),
    );
    await waitFor(() =>
      expect(client.getQueryData(profileKeys.preferences("user-1"))).toEqual(
        canonical,
      ),
    );
    await act(async () => {
      finishOld(preferenceFixture);
      await pendingRead;
    });
    expect(client.getQueryData(profileKeys.preferences("user-1"))).toEqual(
      canonical,
    );
  });
});
