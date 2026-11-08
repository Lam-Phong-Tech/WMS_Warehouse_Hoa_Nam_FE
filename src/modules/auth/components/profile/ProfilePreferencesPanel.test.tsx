import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { ProfilePreferencesPanel } from "./ProfilePreferencesPanel";
import { preferenceFixture } from "../../pages/profile.fixture";
const common = {
  onReload: vi.fn(),
  onDirtyChange: vi.fn(),
  homeOptions: [{ value: "dashboard", label: "Tổng quan" }],
};
describe("ProfilePreferencesPanel protected drafts", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("explains quiet prompts and refreshes permission changed in browser settings", async () => {
    let permission: NotificationPermission = "default";
    const requestPermission = vi.fn(
      async () => "default" as NotificationPermission,
    );
    vi.stubGlobal("Notification", {
      get permission() {
        return permission;
      },
      requestPermission,
    });
    renderWithProviders(
      <ProfilePreferencesPanel
        {...common}
        preferences={preferenceFixture}
        mode="notifications"
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cấp quyền" }));
    expect(await screen.findByText(/Nếu không thấy hộp thoại/)).toBeVisible();
    permission = "granted";
    fireEvent(window, new Event("focus"));
    expect(
      await screen.findByText("Đã cấp quyền", { exact: true }),
    ).toBeVisible();
    expect(
      screen.queryByText(/Nếu không thấy hộp thoại/),
    ).not.toBeInTheDocument();
  });
  it("shows an externally blocked permission without requesting it again", async () => {
    let permission: NotificationPermission = "default";
    const requestPermission = vi.fn();
    vi.stubGlobal("Notification", {
      get permission() {
        return permission;
      },
      requestPermission,
    });
    renderWithProviders(
      <ProfilePreferencesPanel
        {...common}
        preferences={preferenceFixture}
        mode="notifications"
        onSave={vi.fn()}
      />,
    );
    permission = "denied";
    fireEvent.click(screen.getByRole("button", { name: "Cấp quyền" }));
    expect(
      await screen.findByText("Trình duyệt đang chặn thông báo", {
        exact: true,
      }),
    ).toBeVisible();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Kiểm tra lại quyền" }),
    ).toBeVisible();
  });
  it("keeps appearance drafts when saving fails instead of applying local choices as saved", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network"));
    renderWithProviders(
      <ProfilePreferencesPanel
        {...common}
        preferences={preferenceFixture}
        mode="appearance"
        onSave={save}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tối" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(
      await screen.findByText(/Chưa lưu được thay đổi/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tối" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(preferenceFixture.theme).toBe("light");
    expect(common.onDirtyChange).toHaveBeenCalledWith(true);
  });
  it("keeps the opening version when a background refresh arrives during editing", async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ ...preferenceFixture, theme: "dark", version: 2 });
    const { rerender } = renderWithProviders(
      <ProfilePreferencesPanel
        {...common}
        preferences={preferenceFixture}
        mode="appearance"
        onSave={save}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tối" }));
    rerender(
      <ProfilePreferencesPanel
        {...common}
        preferences={{ ...preferenceFixture, theme: "system", version: 9 }}
        mode="appearance"
        onSave={save}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ theme: "dark", accent: "ocean" }, 1),
    );
  });
  it("protects mandatory account notifications while allowing real email category changes", async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ ...preferenceFixture, version: 2 });
    renderWithProviders(
      <ProfilePreferencesPanel
        {...common}
        preferences={preferenceFixture}
        mode="notifications"
        onSave={save}
      />,
    );
    const required = screen.getByRole("switch", {
      name: "Hoạt động tài khoản · Trong ứng dụng",
    });
    expect(required).toBeChecked();
    expect(required).toBeDisabled();
    fireEvent.click(
      screen.getByRole("switch", { name: "Bảo hành & linh kiện · Email" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.objectContaining({
            account: { in_app: true, email: false },
            warranty: { in_app: true, email: true },
          }),
        }),
        1,
      ),
    );
  });
});
