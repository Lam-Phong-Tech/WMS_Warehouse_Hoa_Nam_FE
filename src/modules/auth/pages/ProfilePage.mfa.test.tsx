import { fireEvent, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";
import { authService } from "../services/auth.service";
import { profileService } from "../services/profile.service";
import { auditLogService } from "@/modules/audit-logs/services/audit-logs.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { renderWithProviders } from "@/test/test-utils";
import { profileFixture as me, preferenceFixture } from "./profile.fixture";
vi.mock("@/shared/data/reference-queries", () => ({
  useWarehouseDirectory: () => ({ data: [] }),
}));
vi.mock("../components/MfaSettingsDrawer", () => ({
  MfaSettingsDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mfa-drawer" /> : null,
}));
const status = {
  enabled: false,
  pending: false,
  required_for_role: false,
  enforced: false,
  must_enroll_now: false,
  recovery_codes_remaining: 0,
};
describe("ProfilePage security MFA card", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      token: "mfa-profile-test",
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
      meta: {},
    });
    vi.spyOn(profileService, "getDeviceHistory").mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, total: 0 },
    });
    vi.spyOn(auditLogService, "getMyPermissionHistory").mockResolvedValue({
      data: [],
      meta: {},
    });
  });
  it("shows registered status under Security and opens management without exposing enrollment secrets", async () => {
    vi.spyOn(authService, "mfaStatus").mockResolvedValue({
      ...status,
      enabled: true,
    });
    const enroll = vi.spyOn(authService, "mfaEnroll");
    renderWithProviders(<ProfilePage />, ["/profile?section=security"]);
    expect(await screen.findByText("Đang bật")).toBeInTheDocument();
    expect(
      screen.getByText("Tài khoản của bạn đã đăng ký xác thực hai bước."),
    ).toBeInTheDocument();
    expect(enroll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết" }));
    expect(screen.getByTestId("mfa-drawer")).toBeInTheDocument();
  });
  it("offers setup for a disabled account only after entering Security", async () => {
    vi.spyOn(authService, "mfaStatus").mockResolvedValue(status);
    renderWithProviders(<ProfilePage />);
    expect(
      screen.queryByRole("button", { name: "Bắt đầu đăng ký" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Bảo mật" }));
    expect(
      await screen.findByRole("button", { name: "Bắt đầu đăng ký" }),
    ).toBeInTheDocument();
  });
  it("numbers permission history across pages", async () => {
    vi.spyOn(authService, "mfaStatus").mockResolvedValue(status);
    vi.mocked(auditLogService.getMyPermissionHistory).mockImplementation(
      async (params = {}) => ({
        data: [
          {
            id: `entry-${params.page}`,
            actor_id: null,
            action: "iam.role.assign",
            object_type: "user",
            object_id: "u1",
            reason: `Page ${params.page}`,
            before_data: null,
            after_data: null,
            created_at: "2026-11-04T09:00:00Z",
          },
        ],
        meta: {
          total: 11,
          per_page: 10,
          current_page: params.page ?? 1,
          last_page: 2,
        },
      }),
    );
    renderWithProviders(<ProfilePage />, ["/profile?section=security"]);
    fireEvent.click(screen.getByText("Lịch sử quyền và vai trò"));
    await screen.findByText("Page 1");
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "#" }),
    ).toBeVisible();
    expect(
      within(within(table).getAllByRole("row")[1]).getAllByRole("cell")[0],
    ).toHaveTextContent(/^1$/);
    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    await screen.findByText("Page 2");
    await waitFor(() =>
      expect(
        within(within(table).getAllByRole("row")[1]).getAllByRole("cell")[0],
      ).toHaveTextContent(/^11$/),
    );
  });
});
