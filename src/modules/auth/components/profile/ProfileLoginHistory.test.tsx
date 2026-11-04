import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { profileService } from "../../services/profile.service";
import { ProfileLoginHistory } from "./ProfileLoginHistory";

const ended = {
  id: "ended-phone",
  auth_session_id: "phone-login",
  session_id: "phone-login",
  is_current: false,
  can_revoke: false,
  device_label: "Điện thoại Android",
  user_agent: "Chrome/140 Android Mobile",
  ip_address: null,
  platform: "Android",
  client_type: "web" as const,
  metadata_source: "stored",
  last_active_at: "2026-11-04T14:00:00Z",
  last_active_semantics: "LOGIN_OR_TOKEN_REFRESH_NOT_EACH_API_REQUEST",
  started_at: "2026-11-04T13:00:00Z",
  expires_at: "2026-12-04T13:00:00Z",
  status: "SIGNED_OUT" as const,
  ended_at: "2026-11-04T14:30:00Z",
};
beforeEach(() => vi.restoreAllMocks());

it("shows a signed-out phone login with dates and no revoke action, then pages to expired logins", async () => {
  const get = vi
    .spyOn(profileService, "getDeviceHistory")
    .mockResolvedValueOnce({
      data: [ended],
      meta: { current_page: 1, last_page: 2, total: 2 },
    })
    .mockResolvedValueOnce({
      data: [
        { ...ended, id: "expired", session_id: "expired", status: "EXPIRED" },
      ],
      meta: { current_page: 2, last_page: 2, total: 2 },
    });
  renderWithProviders(<ProfileLoginHistory userId="self" />);
  expect(await screen.findByText("Đã đăng xuất")).toBeVisible();
  expect(screen.getByText("Điện thoại Android")).toBeVisible();
  expect(screen.getByText("Chrome · Android")).toBeVisible();
  expect(screen.getByText("Đăng nhập")).toBeVisible();
  expect(screen.getByText("Kết thúc")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /Đăng xuất/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  expect(await screen.findByText("Hết hạn")).toBeVisible();
  expect(get).toHaveBeenLastCalledWith(2);
});

it("hides an empty login history", async () => {
  const get = vi.spyOn(profileService, "getDeviceHistory").mockResolvedValue({
    data: [],
    meta: { current_page: 1, last_page: 1, total: 0 },
  });
  renderWithProviders(<ProfileLoginHistory userId="self" />);
  await waitFor(() => expect(get).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByRole("heading", { name: "Lịch sử đăng nhập" }),
  ).not.toBeInTheDocument();
});

it("uses the phone illustration for a scanner app without platform metadata", async () => {
  vi.spyOn(profileService, "getDeviceHistory").mockResolvedValue({
    data: [
      {
        ...ended,
        device_label: null,
        platform: null,
        client_type: "app",
        user_agent: "App Scanner",
      },
    ],
    meta: { current_page: 1, last_page: 1, total: 1 },
  });
  const { container } = renderWithProviders(
    <ProfileLoginHistory userId="self" />,
  );
  expect(await screen.findByText("Điện thoại")).toBeVisible();
  expect(
    container.querySelector('[data-device-kind="phone"]'),
  ).toBeInTheDocument();
});

it("can retry a history error independently", async () => {
  vi.spyOn(profileService, "getDeviceHistory")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({
      data: [ended],
      meta: { current_page: 1, last_page: 1, total: 1 },
    });
  renderWithProviders(<ProfileLoginHistory userId="self" />);
  fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("Đã đăng xuất")).toBeVisible();
});
