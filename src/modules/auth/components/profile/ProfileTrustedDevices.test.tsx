import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileTrustedDevices } from "./ProfileTrustedDevices";
import { profileService } from "../../services/profile.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { renderWithProviders } from "@/test/test-utils";
import { profileFixture as me } from "../../pages/profile.fixture";

describe("ProfileTrustedDevices", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      token: "trusted-device-test-token",
      user: me,
      profile: me,
      isAuthenticated: true,
      isProfileLoaded: true,
      permissionCodes: [],
      isSuperAdmin: false,
      currentContext: null,
    });
  });

  it("lists a signed-out trusted device and revokes the current device with confirmation", async () => {
    vi.spyOn(profileService, "getTrustedDevices").mockResolvedValue({
      data: [
        {
          id: "t1",
          device_label: "Windows - Chrome",
          platform: "Windows",
          client_type: "web",
          is_current: false,
          trusted_at: "2026-11-01T00:00:00Z",
          last_used_at: null,
          expires_at: "2026-12-01T00:00:00Z",
          can_revoke: true,
        },
        {
          id: "t2",
          device_label: "Windows - Edge",
          platform: "Windows",
          client_type: "web",
          is_current: true,
          trusted_at: "2026-11-10T00:00:00Z",
          last_used_at: "2026-11-10T00:00:00Z",
          expires_at: "2026-12-10T00:00:00Z",
          can_revoke: true,
        },
      ],
    });
    vi.spyOn(profileService, "revokeTrustedDevice").mockResolvedValue({
      revoked: true,
      was_current: true,
      revoked_session_count: 1,
    });

    renderWithProviders(<ProfileTrustedDevices />);
    expect(await screen.findByText("Windows - Chrome")).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: /thu hồi/i })[1],
    );
    expect(await screen.findByRole("dialog")).toHaveTextContent(/đăng xuất/i);
    await userEvent.click(screen.getByRole("button", { name: /thu hồi/i }));
    await waitFor(() =>
      expect(profileService.revokeTrustedDevice).toHaveBeenCalledWith("t2"),
    );
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
  });
});
